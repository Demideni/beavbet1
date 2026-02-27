import { getDb } from "./db";

function dayStartUtc(ts = Date.now()) {
  const d = new Date(ts);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  return start;
}

export function getMatchmakingAccess(userId: string) {
  const db = getDb();
  const now = Date.now();

  const u = db.prepare("SELECT premium_until FROM users WHERE id = ?").get(userId) as
    | { premium_until?: number | null }
    | undefined;

  const premiumUntil = Number(u?.premium_until || 0);
  const isPremium = premiumUntil > now;

  const start = dayStartUtc(now);

  // считаем сколько матчей сегодня пользователь УЖЕ начинал (создавал или джойнил)
  const row = db
    .prepare(
      `SELECT COUNT(1) as cnt
       FROM arena_duel_players
       WHERE user_id = ?
         AND joined_at >= ?`
    )
    .get(userId, start) as { cnt: number } | undefined;

  const used = Number(row?.cnt || 0);
  const limit = 3;
  const freeLeft = Math.max(0, limit - used);

  return { isPremium, premiumUntil: premiumUntil || null, usedToday: used, freeLeft, limit };
}

export function assertCanStartMatch(userId: string) {
  const a = getMatchmakingAccess(userId);
  if (a.isPremium) return { ok: true as const, ...a };
  if (a.freeLeft > 0) return { ok: true as const, ...a };
  return { ok: false as const, error: "PREMIUM_REQUIRED" as const, ...a };
}