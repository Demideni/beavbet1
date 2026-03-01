import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { getBeavRankMeta } from "./beavrank";
import { addWalletTx, getOrCreateWallet } from "./wallet";
import { rconExec } from "./cs2Rcon";
import { assertCanStartMatch } from "./arenaAccess";

export type DuelStatus =
  | "open"
  | "active"
  | "reported"
  | "pending_review"
  | "done"
  | "cancelled";

export type DuelRow = {
  id: string;
  game: string;
  mode: string; // "1v1"..."5v5"
  team_size: number;
  stake: number;
  currency: string;
  rake: number;
  status: DuelStatus;
  map: string | null;
  server: string | null;
  server_password: string | null;
  join_link: string | null;
  started_at: number | null;
  ended_at: number | null;
  p1_user_id: string;
  p2_user_id: string | null; // kept for backward-compat 1v1
  winner_user_id: string | null;
  winner_team: number | null;
  p1_ready: number;
  p2_ready: number;
  ready_deadline: number | null;
  live_state: string | null; // lobby | readycheck | ingame
  match_token: string | null;
  result_source: string | null;
  cancel_reason: string | null;
  created_at: number;
  updated_at: number;
};

export type DuelPlayerRow = {
  duel_id: string;
  user_id: string;
  team: number; // 1 or 2
  is_captain: number;
  ready: number;
  joined_at: number;
};

const CS2_MAPS = ["de_mirage", "de_inferno", "de_ancient", "de_nuke", "de_anubis", "de_overpass", "de_vertigo"] as const;

function isValidCs2Map(m: string) {
  return (CS2_MAPS as readonly string[]).includes(m);
}

function genPassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function pickCs2Map() {
  return CS2_MAPS[Math.floor(Math.random() * CS2_MAPS.length)];
}

function parseServers(envVal: string | undefined) {
  const s = String(envVal || "").trim();
  if (!s) return [];
  return s
    .split(/[;\n]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function steamJoinLink(server: string, password?: string | null) {
  // Most reliable for Safari/macOS: use rungameid with launch args
  const args = [`+connect%20${encodeURIComponent(server).replace(/%3A/g, ":")}`];
  if (password) args.push(`+password%20${encodeURIComponent(password)}`);
  return `steam://rungameid/730//${args.join("%20")}`;
}

function ensureWalletRow(userId: string, currency: string) {
  // Centralized wallet helper owns schema/creation.
  return getOrCreateWallet(userId, currency);
}

function debitBalance(db: any, userId: string, currency: string, amount: number, ref: string) {
  const cur = String(currency || "EUR").toUpperCase();
  ensureWalletRow(userId, cur);

  const row = db.prepare("SELECT balance FROM wallets WHERE user_id = ? AND currency = ?").get(userId, cur) as
    | { balance: number }
    | undefined;
  const bal = Number(row?.balance || 0);
  if (bal < amount) return { ok: false as const, error: "INSUFFICIENT_FUNDS" };

  db.prepare("UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE user_id = ? AND currency = ?").run(
    amount,
    Date.now(),
    userId,
    cur
  );

  addWalletTx({
    userId,
    type: "arena_debit",
    amount: -Number(amount),
    currency: cur,
    product: "arena",
    refId: ref,
    meta: { kind: "duel" },
  });

  return { ok: true as const };
}

function creditBalance(db: any, userId: string, currency: string, amount: number, ref: string, meta?: any) {
  const cur = String(currency || "EUR").toUpperCase();
  ensureWalletRow(userId, cur);

  db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE user_id = ? AND currency = ?").run(
    amount,
    Date.now(),
    userId,
    cur
  );

  addWalletTx({
    userId,
    type: "arena_credit",
    amount: Number(amount),
    currency: cur,
    product: "arena",
    refId: ref,
    meta: meta || {},
  });
}

function ensureRating(db: any, userId: string) {
  const now = Date.now();
  const r = db.prepare("SELECT user_id FROM arena_ratings WHERE user_id = ?").get(userId) as { user_id: string } | undefined;
  if (!r) {
    db.prepare(
      // BeavRank стартует с 250 (как стартовый FACEIT/ELO аналог)
      "INSERT INTO arena_ratings (user_id, dam_rank, matches, wins, losses, updated_at) VALUES (?, 250, 0, 0, 0, ?)"
    ).run(userId, now);
  }
}

export function getDamRank(db: any, userId: string) {
  ensureRating(db, userId);
  return (db.prepare("SELECT dam_rank, matches, wins, losses FROM arena_ratings WHERE user_id=?").get(userId) ??
    { dam_rank: 250, matches: 0, wins: 0, losses: 0 }) as { dam_rank: number; matches: number; wins: number; losses: number };
}

/**
 * Called opportunistically on list/ready/join to keep ready-check logic consistent.
 */
function tickCs2Duels(db: any) {
  const now = Date.now();

  // Auto-cancel stale OPEN duels (no opponent accepted) after 30 minutes.
  // This prevents creators from getting stuck with ALREADY_HAS_DUEL.
  const staleCutoff = now - 30 * 60 * 1000;
  const staleOpen = db
    .prepare(
      `SELECT * FROM arena_duels
       WHERE game='cs2' AND status='open' AND (p2_user_id IS NULL OR p2_user_id='')
         AND created_at IS NOT NULL AND created_at < ?`
    )
    .all(staleCutoff) as DuelRow[];

  for (const d of staleOpen) {
    // Cancel and refund the creator (p1) who paid the stake on create.
    db.prepare(
      `UPDATE arena_duels
       SET status='cancelled', cancel_reason=?, ended_at=?, updated_at=?
       WHERE id=? AND status='open'`
    ).run("NO_ACCEPT_TIMEOUT", now, now, d.id);

    creditBalance(db, d.p1_user_id, d.currency, Number(d.stake), d.id, { kind: "refund", reason: "NO_ACCEPT_TIMEOUT" });
  }

  const active = db
    .prepare(
      `SELECT * FROM arena_duels
       WHERE game='cs2' AND status='active'
         AND ready_deadline IS NOT NULL AND ready_deadline < ?`
    )
    .all(now) as DuelRow[];

  for (const d of active) {
    const players = db
      .prepare("SELECT * FROM arena_duel_players WHERE duel_id=?")
      .all(d.id) as DuelPlayerRow[];
    const required = Number(d.team_size || 1) * 2;
    const readyCount = players.reduce((sum, p) => sum + (p.ready ? 1 : 0), 0);

    if (readyCount >= required) continue;

    // Cancel + refund all paid players.
    const upd = db.prepare(
      `UPDATE arena_duels SET status='cancelled', cancel_reason=?, ended_at=?, updated_at=? WHERE id=? AND status='active'`
    );
    upd.run("READY_TIMEOUT", now, now, d.id);

    for (const p of players) {
      creditBalance(db, p.user_id, d.currency, Number(d.stake), d.id, { kind: "refund", reason: "READY_TIMEOUT" });
    }
  }
}

function getDuelPlayers(db: any, duelId: string) {
  return db.prepare("SELECT * FROM arena_duel_players WHERE duel_id=? ORDER BY team, joined_at").all(duelId) as DuelPlayerRow[];
}

function getNick(db: any, userId: string | null | undefined) {
  if (!userId) return null;
  const p = db.prepare("SELECT nickname FROM profiles WHERE user_id=?").get(userId) as { nickname?: string } | undefined;
  return p?.nickname || null;
}

function teamsFill(players: DuelPlayerRow[]) {
  const t1 = players.filter((p) => Number(p.team) === 1);
  const t2 = players.filter((p) => Number(p.team) === 2);
  return { t1, t2 };
}

// BeavRank update rules:
//  - win  : +2
//  - loss : -1.5
//  - draw : +1
function updateTeamRatings(db: any, duelId: string, winnerTeam: number) {
  const now = Date.now();
  const players = getDuelPlayers(db, duelId);
  const { t1, t2 } = teamsFill(players);
  if (!t1.length || !t2.length) return;

  for (const p of players) ensureRating(db, p.user_id);

  function applyDelta(userId: string, delta: number, isWin: boolean, isLoss: boolean) {
    const curRow = getDamRank(db, userId);
    const cur = Number(curRow.dam_rank || 0);
    const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
    db.prepare(
      `UPDATE arena_ratings
       SET dam_rank=?, matches=matches+1, wins=wins+?, losses=losses+?, updated_at=?
       WHERE user_id=?`
    ).run(next, isWin ? 1 : 0, isLoss ? 1 : 0, now, userId);
  }

  const WIN = 2;
  const LOSS = -1.5;

  for (const p of t1) {
    const won = winnerTeam === 1;
    applyDelta(p.user_id, won ? WIN : LOSS, won, !won);
  }
  for (const p of t2) {
    const won = winnerTeam === 2;
    applyDelta(p.user_id, won ? WIN : LOSS, won, !won);
  }
}

export function finalizeDuel(duelId: string, winnerUserId: string, source: "server" | "admin" | "reports") {
  const db = getDb();
  const now = Date.now();

  const tx = db.transaction(() => {
    const d = db.prepare("SELECT * FROM arena_duels WHERE id=?").get(duelId) as DuelRow | undefined;
    if (!d) return { ok: false as const, error: "NOT_FOUND" };
    if (d.status === "done") return { ok: true as const, status: "done" as const };

    const players = getDuelPlayers(db, duelId);
    const winnerPlayer = players.find((p) => p.user_id === winnerUserId);
    if (!winnerPlayer) return { ok: false as const, error: "BAD_WINNER" };

    const winnerTeam = winnerPlayer.team;

    const pot = Number(d.stake) * players.length;
    const prize = Number((pot * (1 - Number(d.rake || 0))).toFixed(2));

    const winners = players.filter((p) => p.team === winnerTeam);
    const share = winners.length ? Number((prize / winners.length).toFixed(2)) : 0;

    for (const p of winners) {
      creditBalance(db, p.user_id, d.currency, share, duelId, { source, kind: "prize", winnerTeam });
    }

    db.prepare(
      `UPDATE arena_duels
       SET status='done', winner_user_id=?, winner_team=?, result_source=?, ended_at=?, live_state='done', updated_at=?
       WHERE id=?`
    ).run(winnerUserId, winnerTeam, source, now, now, duelId);

    updateTeamRatings(db, duelId, winnerTeam);

    return { ok: true as const, status: "done" as const, winner_user_id: winnerUserId, winner_team: winnerTeam, prize, share };
  });

  return tx();
}

// --- Arena social/UX helpers (profile / leaderboard / activity) ---

export function getArenaProfile(userId: string, limit = 30) {
  const db = getDb();
  ensureRating(db, userId);
  const r = getDamRank(db, userId);
  const meta = getBeavRankMeta(Number(r.dam_rank || 0));
  const nick = getNick(db, userId);
  const avatarUrl = (db.prepare("SELECT avatar_url FROM profiles WHERE user_id = ?").get(userId) as any)?.avatar_url ?? null;

  const history = db
    .prepare(
      `SELECT d.id, d.game, d.stake, d.currency, d.status, d.map, d.updated_at, d.ended_at,
              d.p1_user_id, d.p2_user_id, d.winner_user_id
       FROM arena_duels d
       WHERE (d.p1_user_id=? OR d.p2_user_id=? OR EXISTS(SELECT 1 FROM arena_duel_players p WHERE p.duel_id=d.id AND p.user_id=?))
       ORDER BY COALESCE(d.ended_at, d.updated_at) DESC
       LIMIT ?`
    )
    .all(userId, userId, userId, limit) as any[];

  const rows = history.map((d) => {
    const p1 = getNick(db, d.p1_user_id);
    const p2 = getNick(db, d.p2_user_id);
    const w = getNick(db, d.winner_user_id);
    return { ...d, p1_nick: p1, p2_nick: p2, winner_nick: w };
  });

  return {
    ok: true as const,
    profile: {
      userId,
      nickname: nick,
      avatarUrl,
      elo: r.dam_rank,
      division: meta.label,
      beav: meta,
      matches: r.matches,
      wins: r.wins,
      losses: r.losses,
      winrate: r.matches ? Math.round((r.wins / r.matches) * 100) : 0,
    },
    history: rows,
  };
}