import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { addWalletTx, getOrCreateWallet } from "./wallet";
import { rconExec } from "./cs2Rcon";

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
      "INSERT INTO arena_ratings (user_id, dam_rank, matches, wins, losses, updated_at) VALUES (?, 1000, 0, 0, 0, ?)"
    ).run(userId, now);
  }
}

export function getDamRank(db: any, userId: string) {
  ensureRating(db, userId);
  return (db.prepare("SELECT dam_rank, matches, wins, losses FROM arena_ratings WHERE user_id=?").get(userId) ??
    { dam_rank: 1000, matches: 0, wins: 0, losses: 0 }) as { dam_rank: number; matches: number; wins: number; losses: number };
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

function teamsFill(players: DuelPlayerRow[]) {
  const t1 = players.filter((p) => p.team === 1);
  const t2 = players.filter((p) => p.team === 2);
  return { t1, t2 };
}


function getNick(db: any, userId: string | null | undefined) {
  if (!userId) return null;
  const r = db.prepare("SELECT nickname FROM profiles WHERE user_id=?").get(userId) as { nickname?: string } | undefined;
  return r?.nickname || null;
}

export function listCs2Duels(userId: string) {
  const db = getDb();
  tickCs2Duels(db);

  const duels = db
    .prepare(
      `SELECT * FROM arena_duels
       WHERE game='cs2'
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .all() as DuelRow[];

  const enriched = duels.map((d) => {
    const players = getDuelPlayers(db, d.id);
    const { t1, t2 } = teamsFill(players);
    const me = players.find((p) => p.user_id === userId);
    const me_team = me?.team ?? (d.p1_user_id === userId ? 1 : d.p2_user_id === userId ? 2 : null);
    const me_is_p1 = me_team === 1;
    return {
      ...d,
      p1_nick: getNick(db, d.p1_user_id),
      p2_nick: getNick(db, d.p2_user_id),
      players,
      team1_count: t1.length,
      team2_count: t2.length,
      me_team,
      me_is_p1,
    };
  });

  const myRating = getDamRank(db, userId);

  return { ok: true as const, duels: enriched, myRating, ratingName: ratingNameFromElo(myRating.dam_rank) };
}

export function createCs2Duel(
  userId: string,
  stake: number,
  currency: string,
  opts?: { teamSize?: number; map?: string | null }
) {
  const db = getDb();
  // keep timeouts consistent even if user never opened the list page
  tickCs2Duels(db);
  const s = Number(stake);
  if (!Number.isFinite(s) || s <= 0) return { ok: false as const, error: "BAD_STAKE" };
  if (s < 1 || s > 1000) return { ok: false as const, error: "STAKE_OUT_OF_RANGE" };

  const cur = String(currency || "EUR").toUpperCase();
  const teamSize = Math.max(1, Math.min(5, Number(opts?.teamSize || 1) || 1));

  const requestedMap = String(opts?.map || "").trim();
  const map = !requestedMap || requestedMap === "random" ? pickCs2Map() : isValidCs2Map(requestedMap) ? requestedMap : null;
  if (!map) return { ok: false as const, error: "BAD_MAP" };

  // Only one active/open duel per creator.
  const existing = db
    .prepare(
      `SELECT id FROM arena_duels
       WHERE p1_user_id=? AND game='cs2' AND status NOT IN ('done','cancelled')
       LIMIT 1`
    )
    .get(userId) as { id: string } | undefined;
  if (existing) return { ok: false as const, error: "ALREADY_HAS_DUEL", duelId: existing.id };

  const id = randomUUID();
  const now = Date.now();
  const rake = 0.15;
  const mode = `${teamSize}v${teamSize}`;
  const matchToken = genPassword(18);

  const tx = db.transaction(() => {
    const deb = debitBalance(db, userId, cur, s, id);
    if (!deb.ok) return deb;

    db.prepare(
      `INSERT INTO arena_duels
       (id, game, mode, team_size, stake, currency, rake, status, map, server, server_password, join_link, started_at, ended_at,
        p1_user_id, p2_user_id, winner_user_id, winner_team, p1_ready, p2_ready, ready_deadline, live_state, match_token, created_at, updated_at)
       VALUES (?, 'cs2', ?, ?, ?, ?, ?, 'open', ?, NULL, NULL, NULL, NULL, NULL,
        ?, NULL, NULL, NULL, 0, 0, NULL, 'lobby', ?, ?, ?)`
    ).run(id, mode, teamSize, s, cur, rake, map, userId, matchToken, now, now);

    db.prepare(
      `INSERT INTO arena_duel_players (duel_id, user_id, team, is_captain, ready, joined_at)
       VALUES (?, ?, 1, 1, 0, ?)`
    ).run(id, userId, now);

    return { ok: true as const, duelId: id };
  });

  return tx();
}

export function joinCs2Duel(userId: string, duelId: string, preferredTeam?: number) {
  const db = getDb();
  const now = Date.now();
  tickCs2Duels(db);

  const envHost = process.env.ARENA_CS2_HOST;
  const envPort = process.env.ARENA_CS2_PORT;
  const singleServer = envHost && envPort ? `${envHost}:${envPort}` : null;
  const servers = parseServers(process.env.ARENA_CS2_SERVERS);
  const serverPool = servers.length ? servers : singleServer ? [singleServer] : [];

  const tx = db.transaction(() => {
    const d = db.prepare("SELECT * FROM arena_duels WHERE id = ?").get(duelId) as DuelRow | undefined;
    if (!d) return { ok: false as const, error: "NOT_FOUND" };
    if (d.status !== "open") return { ok: false as const, error: "NOT_OPEN" };

    // Already joined?
    const already = db
      .prepare("SELECT * FROM arena_duel_players WHERE duel_id=? AND user_id=?")
      .get(duelId, userId) as DuelPlayerRow | undefined;
    if (already) return { ok: true as const, duel: d };

    if (userId === d.p1_user_id) return { ok: false as const, error: "CANNOT_JOIN_SELF" };

    const teamSize = Number(d.team_size || 1);
    const players = getDuelPlayers(db, duelId);
    const { t1, t2 } = teamsFill(players);

    let team = Number(preferredTeam || 2);
    if (team !== 1 && team !== 2) team = 2;

    // If team full, try the other team
    const countForTeam = team === 1 ? t1.length : t2.length;
    if (countForTeam >= teamSize) {
      team = team === 1 ? 2 : 1;
    }
    const countForTeam2 = team === 1 ? t1.length : t2.length;
    if (countForTeam2 >= teamSize) return { ok: false as const, error: "TEAM_FULL" };

    // Debit stake from joiner
    const deb = debitBalance(db, userId, d.currency, Number(d.stake), duelId);
    if (!deb.ok) return deb;

    db.prepare(
      `INSERT INTO arena_duel_players (duel_id, user_id, team, is_captain, ready, joined_at)
       VALUES (?, ?, ?, 0, 0, ?)`
    ).run(duelId, userId, team, now);

    // For backward-compat 1v1 set p2_user_id if still empty and joiner is on team 2.
    if (teamSize === 1 && !d.p2_user_id && team === 2) {
      db.prepare("UPDATE arena_duels SET p2_user_id=?, updated_at=? WHERE id=?").run(userId, now, duelId);
    }

    const playersAfter = getDuelPlayers(db, duelId);
    const { t1: t1a, t2: t2a } = teamsFill(playersAfter);

    const full = t1a.length >= teamSize && t2a.length >= teamSize;

    let updated = d;
    if (full) {
      const server = serverPool.length ? serverPool[Math.floor(Math.random() * serverPool.length)] : null;
      const pass = genPassword(8);
      const link = server ? steamJoinLink(server, pass) : null;

      const readyDeadline = now + 60_000;

      db.prepare(
        `UPDATE arena_duels
         SET status='active', server=?, server_password=?, join_link=?, started_at=?, ready_deadline=?, live_state='readycheck', updated_at=?
         WHERE id=?`
      ).run(server, pass, link, now, readyDeadline, now, duelId);

      // Best-effort RCON to set pass + map
      const rconPassword = process.env.ARENA_CS2_RCON_PASSWORD;
      if (server && rconPassword) {
        const [host, portStr] = server.split(":");
        const port = Number(portStr || "27015");
        try {
          rconExec({ host, port, password: rconPassword }, `sv_password "${pass}"`);
          rconExec({ host, port, password: rconPassword }, `changelevel ${d.map || "de_mirage"}`);
          rconExec({ host, port, password: rconPassword }, "mp_restartgame 1");
        } catch {
          // ignore
        }
      }

      updated = db.prepare("SELECT * FROM arena_duels WHERE id=?").get(duelId) as DuelRow;
    }

    return { ok: true as const, duel: updated };
  });

  return tx();
}

export function setDuelReady(duelId: string, userId: string) {
  const db = getDb();
  const now = Date.now();
  const tx = db.transaction(() => {
    tickCs2Duels(db);

    const d = db.prepare("SELECT * FROM arena_duels WHERE id=?").get(duelId) as DuelRow | undefined;
    if (!d) return { ok: false as const, error: "NOT_FOUND" };
    if (d.status !== "active") return { ok: false as const, error: "NOT_ACTIVE" };

    const p = db.prepare("SELECT * FROM arena_duel_players WHERE duel_id=? AND user_id=?").get(duelId, userId) as
      | DuelPlayerRow
      | undefined;
    if (!p) return { ok: false as const, error: "FORBIDDEN" };
    if (p.ready) return { ok: true as const, ready: true };

    db.prepare("UPDATE arena_duel_players SET ready=1 WHERE duel_id=? AND user_id=?").run(duelId, userId);

    // keep legacy columns for 1v1 UI
    if (Number(d.team_size || 1) === 1) {
      if (userId === d.p1_user_id) db.prepare("UPDATE arena_duels SET p1_ready=1, updated_at=? WHERE id=?").run(now, duelId);
      if (userId === d.p2_user_id) db.prepare("UPDATE arena_duels SET p2_ready=1, updated_at=? WHERE id=?").run(now, duelId);
    }

    const players = getDuelPlayers(db, duelId);
    const required = Number(d.team_size || 1) * 2;
    const readyCount = players.reduce((sum, x) => sum + (x.ready ? 1 : 0), 0);

    if (readyCount >= required && d.live_state === "readycheck") {
      db.prepare("UPDATE arena_duels SET live_state='ingame', updated_at=? WHERE id=?").run(now, duelId);
    }

    const updated = db.prepare("SELECT * FROM arena_duels WHERE id=?").get(duelId) as DuelRow;
    return { ok: true as const, duel: updated };
  });

  return tx();
}

export function reportDuelResult(userId: string, duelId: string, result: "win" | "lose") {
  const db = getDb();
  const now = Date.now();
  const tx = db.transaction(() => {
    tickCs2Duels(db);

    const d = db.prepare("SELECT * FROM arena_duels WHERE id=?").get(duelId) as DuelRow | undefined;
    if (!d) return { ok: false as const, error: "NOT_FOUND" };
    if (d.status !== "active") return { ok: false as const, error: "NOT_ACTIVE" };

    const p = db.prepare("SELECT * FROM arena_duel_players WHERE duel_id=? AND user_id=?").get(duelId, userId) as
      | DuelPlayerRow
      | undefined;
    if (!p) return { ok: false as const, error: "FORBIDDEN" };

    // Upsert report
    const id = `${duelId}:${userId}`;
    db.prepare(
      `INSERT INTO arena_duel_reports (id, duel_id, user_id, result, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET result=excluded.result, created_at=excluded.created_at`
    ).run(id, duelId, userId, result, now);

    // Determine winner team by majority of captain reports (or any two opposing reports)
    const teamSize = Number(d.team_size || 1);
    const players = getDuelPlayers(db, duelId);
    const { t1, t2 } = teamsFill(players);

    const reports = db
      .prepare("SELECT user_id, result FROM arena_duel_reports WHERE duel_id=?")
      .all(duelId) as { user_id: string; result: "win" | "lose" }[];

    const byUser = new Map(reports.map((r) => [r.user_id, r.result]));
    const cap1 = t1.find((x) => x.is_captain)?.user_id;
    const cap2 = t2.find((x) => x.is_captain)?.user_id;

    function inferTeamWin(fromUser: string, res: "win" | "lose") {
      const pl = players.find((x) => x.user_id === fromUser);
      if (!pl) return null;
      const winTeam = res === "win" ? pl.team : pl.team === 1 ? 2 : 1;
      return winTeam;
    }

    let inferred: number | null = null;
    if (cap1 && cap2 && byUser.has(cap1) && byUser.has(cap2)) {
      const w1 = inferTeamWin(cap1, byUser.get(cap1)!);
      const w2 = inferTeamWin(cap2, byUser.get(cap2)!);
      if (w1 && w2 && w1 === w2) inferred = w1;
    }

    // If 1v1 and both reported (any users), also allow
    if (!inferred && teamSize === 1 && players.length >= 2) {
      const u1 = players[0]?.user_id;
      const u2 = players[1]?.user_id;
      if (u1 && u2 && byUser.has(u1) && byUser.has(u2)) {
        const w1 = inferTeamWin(u1, byUser.get(u1)!);
        const w2 = inferTeamWin(u2, byUser.get(u2)!);
        if (w1 && w2 && w1 === w2) inferred = w1;
      }
    }

    if (inferred) {
      // pick a representative winner user in that team (captain preferred)
      const rep = (inferred === 1 ? t1 : t2).find((x) => x.is_captain)?.user_id || (inferred === 1 ? t1 : t2)[0]?.user_id;
      if (rep) return finalizeDuel(duelId, rep, "reports");
    }

    // mark reported state
    db.prepare("UPDATE arena_duels SET status='reported', updated_at=? WHERE id=? AND status='active'").run(now, duelId);

    return { ok: true as const, status: "reported" as const };
  });

  return tx();
}

function eloExpected(rA: number, rB: number) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function updateTeamRatings(db: any, duelId: string, winnerTeam: number) {
  const now = Date.now();
  const players = getDuelPlayers(db, duelId);
  const { t1, t2 } = teamsFill(players);
  if (!t1.length || !t2.length) return;

  for (const p of players) ensureRating(db, p.user_id);

  const r1 = t1.map((p) => getDamRank(db, p.user_id).dam_rank);
  const r2 = t2.map((p) => getDamRank(db, p.user_id).dam_rank);
  const avg1 = r1.reduce((a, b) => a + b, 0) / r1.length;
  const avg2 = r2.reduce((a, b) => a + b, 0) / r2.length;

  const K = 32;

  function apply(userId: string, score: number, expected: number) {
    const cur = getDamRank(db, userId).dam_rank;
    const next = Math.round(cur + K * (score - expected));
    const row = getDamRank(db, userId);
    db.prepare(
      `UPDATE arena_ratings
       SET dam_rank=?, matches=matches+1, wins=wins+?, losses=losses+?, updated_at=?
       WHERE user_id=?`
    ).run(next, score ? 1 : 0, score ? 0 : 1, now, userId);
    return { before: cur, after: next, delta: next - cur, ...row };
  }

  // Update each player relative to team averages
  for (const p of t1) {
    const expected = eloExpected(getDamRank(db, p.user_id).dam_rank, avg2);
    const score = winnerTeam === 1 ? 1 : 0;
    apply(p.user_id, score, expected);
  }
  for (const p of t2) {
    const expected = eloExpected(getDamRank(db, p.user_id).dam_rank, avg1);
    const score = winnerTeam === 2 ? 1 : 0;
    apply(p.user_id, score, expected);
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

function ratingNameFromElo(elo: number) {
  if (elo >= 2000) return "Elite";
  if (elo >= 1700) return "Diamond";
  if (elo >= 1400) return "Gold";
  if (elo >= 1000) return "Silver";
  return "Bronze";
}

export function getArenaProfile(userId: string, limit = 30) {
  const db = getDb();
  ensureRating(db, userId);
  const r = getDamRank(db, userId);
  const nick = getNick(db, userId);

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
      elo: r.dam_rank,
      division: ratingNameFromElo(r.dam_rank),
      matches: r.matches,
      wins: r.wins,
      losses: r.losses,
      winrate: r.matches ? Math.round((r.wins / r.matches) * 100) : 0,
    },
    history: rows,
  };
}

export function getArenaLeaderboard(limit = 50) {
  const db = getDb();
  const top = db
    .prepare(
      `SELECT r.user_id, r.dam_rank AS elo, r.matches, r.wins, r.losses, r.updated_at
       FROM arena_ratings r
       ORDER BY r.dam_rank DESC
       LIMIT ?`
    )
    .all(limit) as any[];

  const rows = top.map((x) => ({
    ...x,
    nickname: getNick(db, x.user_id),
    division: ratingNameFromElo(Number(x.elo || 1000)),
    winrate: x.matches ? Math.round((Number(x.wins || 0) / Number(x.matches || 0)) * 100) : 0,
  }));

  return { ok: true as const, rows };
}

export function getArenaActivity(limit = 25) {
  const db = getDb();
  const duels = db
    .prepare(
      `SELECT id, game, stake, currency, status, p1_user_id, p2_user_id, winner_user_id,
              COALESCE(ended_at, updated_at) AS at
       FROM arena_duels
       ORDER BY COALESCE(ended_at, updated_at) DESC
       LIMIT ?`
    )
    .all(limit) as any[];

  const items = duels.map((d) => {
    const kind = d.status === "done" ? "duel_done" : d.status === "active" ? "duel_active" : "duel_open";
    return {
      id: d.id,
      kind,
      game: d.game,
      stake: Number(d.stake || 0),
      currency: d.currency,
      p1_nick: getNick(db, d.p1_user_id),
      p2_nick: getNick(db, d.p2_user_id),
      winner_nick: getNick(db, d.winner_user_id),
      at: Number(d.at || Date.now()),
    };
  });

  return { ok: true as const, items };
}

export function getCs2DuelView(userId: string, duelId: string) {
  const db = getDb();
  tickCs2Duels(db);

  const d = db.prepare("SELECT * FROM arena_duels WHERE id=? AND game='cs2'").get(duelId) as DuelRow | undefined;
  if (!d) return { ok: false as const, error: "NOT_FOUND" };

  const players = getDuelPlayers(db, duelId).map((p) => ({
    ...p,
    nickname: getNick(db, p.user_id),
  }));

  const me = players.find((p) => p.user_id === userId);
  const me_team = me?.team ?? (d.p1_user_id === userId ? 1 : d.p2_user_id === userId ? 2 : null);
  const me_ready = Boolean(me?.ready ?? (me_team === 1 ? d.p1_ready : me_team === 2 ? d.p2_ready : 0));

  ensureRating(db, userId);
  const r = getDamRank(db, userId);

  return {
    ok: true as const,
    duel: {
      ...d,
      p1_nick: getNick(db, d.p1_user_id),
      p2_nick: getNick(db, d.p2_user_id),
      winner_nick: getNick(db, d.winner_user_id),
      me_team,
      me_ready,
      myRating: r.dam_rank,
      ratingName: ratingNameFromElo(r.dam_rank),
    },
    players,
  };
}
