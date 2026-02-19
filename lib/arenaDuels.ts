import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { addWalletTx, getOrCreateWallet } from "./wallet";

export type DuelRow = {
  id: string;
  game: string;
  mode: string;
  stake: number;
  currency: string;
  rake: number;
  status: "open" | "active" | "reported" | "pending_review" | "done" | "cancelled";
  map: string | null;
  server: string | null;
  server_password: string | null;
  join_link: string | null;
  started_at: number | null;
  ended_at: number | null;
  p1_user_id: string;
  p2_user_id: string | null;
  winner_user_id: string | null;
  created_at: number;
  updated_at: number;
};

function parseServers(envVal: string | undefined): string[] {
  if (!envVal) return [];
  return envVal
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function genPassword(len = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function pickCs2Map() {
  const maps = ["de_mirage", "de_inferno", "de_ancient", "de_nuke", "de_anubis", "de_overpass", "de_vertigo"];
  return maps[Math.floor(Math.random() * maps.length)];
}

function ensureWalletRow(db: any, userId: string, currency: string) {
  // ensure wallet exists (uses wallets table schema, includes locked_balance column but can be ignored)
  getOrCreateWallet(userId, currency);
  const w = db
    .prepare("SELECT balance FROM wallets WHERE user_id = ? AND currency = ?")
    .get(userId, currency) as { balance: number } | undefined;
  return { balance: w?.balance ?? 0 };
}

function debitBalance(db: any, userId: string, currency: string, amount: number, refId: string) {
  const now = Date.now();
  const row = ensureWalletRow(db, userId, currency);
  if (row.balance < amount) return { ok: false as const, error: "INSUFFICIENT_FUNDS" };

  db.prepare("UPDATE wallets SET balance = balance - ?, updated_at = ? WHERE user_id = ? AND currency = ?").run(
    amount,
    now,
    userId,
    currency
  );

  addWalletTx({
    userId,
    type: "arena_duel_bet",
    amount: -Number(amount.toFixed(2)),
    currency,
    product: "arena",
    refId,
    meta: { kind: "duel", direction: "debit" },
  });

  return { ok: true as const };
}

function creditBalance(db: any, userId: string, currency: string, amount: number, refId: string, meta?: any) {
  const now = Date.now();
  getOrCreateWallet(userId, currency);
  db.prepare("UPDATE wallets SET balance = balance + ?, updated_at = ? WHERE user_id = ? AND currency = ?").run(
    amount,
    now,
    userId,
    currency
  );
  addWalletTx({
    userId,
    type: "arena_duel_win",
    amount: Number(amount.toFixed(2)),
    currency,
    product: "arena",
    refId,
    meta: { kind: "duel", direction: "credit", ...(meta || {}) },
  });
}

export function listCs2Duels(userId: string) {
  const db = getDb();
  const open = db
    .prepare(
      `SELECT d.*, p1.nickname as p1_nick
       FROM arena_duels d
       LEFT JOIN profiles p1 ON p1.user_id = d.p1_user_id
       WHERE d.game = 'cs2' AND d.status = 'open'
       ORDER BY d.created_at DESC
       LIMIT 30`
    )
    .all() as Array<DuelRow & { p1_nick: string | null }>;

  const mine = db
    .prepare(
      `SELECT d.*,
          p1.nickname as p1_nick,
          p2.nickname as p2_nick,
          w.nickname as winner_nick
       FROM arena_duels d
       LEFT JOIN profiles p1 ON p1.user_id = d.p1_user_id
       LEFT JOIN profiles p2 ON p2.user_id = d.p2_user_id
       LEFT JOIN profiles w ON w.user_id = d.winner_user_id
       WHERE (d.p1_user_id = ? OR d.p2_user_id = ?)
         AND d.game = 'cs2'
         AND d.status IN ('open','active','reported','pending_review')
       ORDER BY d.updated_at DESC
       LIMIT 20`
    )
    .all(userId, userId) as any[];

  return { open, mine };
}

export function getDuel(duelId: string) {
  const db = getDb();
  const d = db.prepare("SELECT * FROM arena_duels WHERE id = ?").get(duelId) as DuelRow | undefined;
  return d ?? null;
}

export function createCs2Duel(userId: string, stake: number, currency: string) {
  const db = getDb();
  const s = Number(stake);
  if (![5, 10, 20].includes(s)) return { ok: false as const, error: "BAD_STAKE" };
  const cur = String(currency || "EUR").toUpperCase();

  const id = randomUUID();
  const now = Date.now();
  const rake = 0.15;

  const t = db.transaction(() => {
    const deb = debitBalance(db, userId, cur, s, id);
    if (!deb.ok) return deb;

    const map = pickCs2Map();
    db.prepare(
      `INSERT INTO arena_duels
       (id, game, mode, stake, currency, rake, status, map, server, server_password, join_link, started_at, ended_at, p1_user_id, p2_user_id, winner_user_id, created_at, updated_at)
       VALUES (?, 'cs2', '1v1', ?, ?, ?, 'open', ?, NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL, ?, ?)`
    ).run(id, s, cur, rake, map, userId, now, now);

    return { ok: true as const, duelId: id };
  });

  return t();
}

export function joinCs2Duel(userId: string, duelId: string) {
  const db = getDb();
  const now = Date.now();

  const t = db.transaction(() => {
    const d = db.prepare("SELECT * FROM arena_duels WHERE id = ?").get(duelId) as DuelRow | undefined;
    if (!d) return { ok: false as const, error: "NOT_FOUND" };
    if (d.status !== "open") return { ok: false as const, error: "NOT_OPEN" };
    if (d.p1_user_id === userId) return { ok: false as const, error: "CANT_JOIN_OWN" };

    const deb = debitBalance(db, userId, d.currency, Number(d.stake), duelId);
    if (!deb.ok) return deb;

    // Assign server info (best-effort)
    const servers = parseServers(process.env.ARENA_CS2_SERVERS);
    const server = servers.length ? servers[Math.floor(Math.random() * servers.length)] : null;
    const pass = server ? genPassword(10) : null;
    const joinLink = server ? `steam://connect/${server}` : null;

    db.prepare(
      `UPDATE arena_duels
       SET p2_user_id = ?, status = 'active', server = ?, server_password = ?, join_link = ?, started_at = ?, updated_at = ?
       WHERE id = ? AND status = 'open'`
    ).run(userId, server, pass, joinLink, now, now, duelId);

    return { ok: true as const, duelId };
  });

  return t();
}

export function reportDuelResult(duelId: string, userId: string, result: "win" | "lose") {
  const db = getDb();
  const now = Date.now();

  const t = db.transaction(() => {
    const d = db.prepare("SELECT * FROM arena_duels WHERE id = ?").get(duelId) as DuelRow | undefined;
    if (!d) return { ok: false as const, error: "NOT_FOUND" };
    if (d.status === "done") return { ok: true as const, status: "done" as const };
    if (d.status === "cancelled") return { ok: false as const, error: "CANCELLED" };

    const isPlayer = userId === d.p1_user_id || userId === d.p2_user_id;
    if (!isPlayer) return { ok: false as const, error: "FORBIDDEN" };
    if (d.status !== "active" && d.status !== "reported" && d.status !== "pending_review") {
      return { ok: false as const, error: "BAD_STATE" };
    }

    // upsert report
    db.prepare(
      `INSERT INTO arena_duel_reports (id, duel_id, user_id, result, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(duel_id, user_id) DO UPDATE SET result=excluded.result`
    ).run(randomUUID(), duelId, userId, result, now);

    // fetch reports
    const reps = db
      .prepare("SELECT user_id, result FROM arena_duel_reports WHERE duel_id = ?")
      .all(duelId) as Array<{ user_id: string; result: string }>;

    const r1 = reps.find((r) => r.user_id === d.p1_user_id)?.result;
    const r2 = d.p2_user_id ? reps.find((r) => r.user_id === d.p2_user_id)?.result : undefined;

    // if both players present and both reported
    if (d.p2_user_id && r1 && r2) {
      // consistent means one win one lose
      const okPair =
        (r1 === "win" && r2 === "lose") ||
        (r1 === "lose" && r2 === "win");

      if (!okPair) {
        db.prepare("UPDATE arena_duels SET status='pending_review', updated_at=? WHERE id=?").run(now, duelId);
        return { ok: true as const, status: "pending_review" as const };
      }

      const winner = r1 === "win" ? d.p1_user_id : (d.p2_user_id as string);
      const pot = Number((Number(d.stake) * 2).toFixed(2));
      const payout = Number((pot * (1 - Number(d.rake || 0.15))).toFixed(2)); // fee kept in air
      // finalize duel + payout
      db.prepare(
        "UPDATE arena_duels SET status='done', winner_user_id=?, ended_at=?, updated_at=? WHERE id=?"
      ).run(winner, now, now, duelId);

      creditBalance(db, winner, d.currency, payout, duelId, { stake: d.stake, rake: d.rake, pot });

      return { ok: true as const, status: "done" as const, winner, payout };
    }

    // only one reported so far
    db.prepare("UPDATE arena_duels SET status='reported', updated_at=? WHERE id=?").run(now, duelId);
    return { ok: true as const, status: "reported" as const };
  });

  return t();
}
