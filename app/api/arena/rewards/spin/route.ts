import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const DAY = 24 * 60 * 60 * 1000;

function safeJsonParse<T>(s: any, fallback: T): T {
  try {
    if (!s) return fallback;
    return JSON.parse(String(s)) as T;
  } catch {
    return fallback;
  }
}

function addHours(ts: number | null | undefined, hours: number) {
  const base = typeof ts === "number" && ts > Date.now() ? ts : Date.now();
  return base + hours * 60 * 60 * 1000;
}

// GET -> eligibility/status
export async function GET() {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const db = getDb();

  // 2 finished duels in last 24h
  const cutoff = Date.now() - DAY;
  const matches = db
    .prepare(
      `SELECT COUNT(*) as c
       FROM arena_duels
       WHERE (p1_user_id = ? OR p2_user_id = ?)
         AND status = 'done'
         AND COALESCE(ended_at, updated_at, created_at) > ?`
    )
    .get(user.id, user.id, cutoff) as { c?: number } | undefined;

  const played = Number(matches?.c || 0);

  const last = db
    .prepare(
      `SELECT created_at, reward_type, reward_value, meta
       FROM arena_rewards
       WHERE user_id = ? AND type = 'daily'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(user.id) as
    | { created_at: number; reward_type: string; reward_value: number | null; meta: string | null }
    | undefined;

  const nextAt = last ? last.created_at + DAY : 0;
  const canSpin = played >= 2 && (!last || Date.now() >= nextAt);

  return NextResponse.json({
    ok: true,
    playedMatches24h: played,
    canSpin,
    nextAt,
    lastReward: last
      ? {
          at: last.created_at,
          type: last.reward_type,
          value: last.reward_value,
          meta: safeJsonParse(last.meta, null),
        }
      : null,
  });
}

// POST -> perform spin
export async function POST() {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const db = getDb();

  const cutoff = Date.now() - DAY;
  const matches = db
    .prepare(
      `SELECT COUNT(*) as c
       FROM arena_duels
       WHERE (p1_user_id = ? OR p2_user_id = ?)
         AND status = 'done'
         AND COALESCE(ended_at, updated_at, created_at) > ?`
    )
    .get(user.id, user.id, cutoff) as { c?: number } | undefined;

  if (Number(matches?.c || 0) < 2) {
    return NextResponse.json({ ok: false, error: "NEED_2_MATCHES" }, { status: 400 });
  }

  const last = db
    .prepare(
      `SELECT created_at
       FROM arena_rewards
       WHERE user_id = ? AND type = 'daily'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(user.id) as { created_at: number } | undefined;

  if (last && Date.now() < last.created_at + DAY) {
    return NextResponse.json(
      { ok: false, error: "ALREADY_SPUN", nextAt: last.created_at + DAY },
      { status: 400 }
    );
  }

  // ✅ Legal rewards (non-cash): coins / premium hours / xp / cosmetic badge
  const rewards = [
    { reward_type: "coins" as const, reward_value: 50, weight: 55 },
    { reward_type: "coins" as const, reward_value: 100, weight: 25 },
    { reward_type: "premium_hours" as const, reward_value: 6, weight: 10 },
    { reward_type: "xp" as const, reward_value: 200, weight: 9 },
    { reward_type: "badge" as const, reward_value: 1, weight: 1, meta: { badge: "daily-lucky" } },
  ];

  const total = rewards.reduce((a, r) => a + r.weight, 0);
  const roll = Math.random() * total;
  let acc = 0;
  const picked =
    rewards.find((r) => {
      acc += r.weight;
      return roll <= acc;
    }) || rewards[0];

  const now = Date.now();
  const id = randomUUID();

  // Apply reward
  if (picked.reward_type === "coins") {
    db.prepare("UPDATE profiles SET arena_coins = COALESCE(arena_coins, 0) + ? WHERE user_id = ?").run(
      picked.reward_value,
      user.id
    );
  }

  if (picked.reward_type === "xp") {
    db.prepare("UPDATE profiles SET arena_xp = COALESCE(arena_xp, 0) + ? WHERE user_id = ?").run(
      picked.reward_value,
      user.id
    );
  }

  if (picked.reward_type === "premium_hours") {
    const u = db.prepare("SELECT premium_until FROM users WHERE id = ?").get(user.id) as
      | { premium_until?: number | null }
      | undefined;
    const next = addHours(u?.premium_until ?? null, picked.reward_value);
    db.prepare("UPDATE users SET premium_until = ? WHERE id = ?").run(next, user.id);
  }

  if (picked.reward_type === "badge") {
    const p = db.prepare("SELECT badges_json FROM profiles WHERE user_id = ?").get(user.id) as
      | { badges_json?: string | null }
      | undefined;
    const badges = safeJsonParse<string[]>(p?.badges_json, []);
    const b = String((picked as any).meta?.badge || "daily-lucky");
    if (!badges.includes(b)) badges.push(b);
    db.prepare("UPDATE profiles SET badges_json = ? WHERE user_id = ?").run(JSON.stringify(badges), user.id);
  }

  db.prepare(
    "INSERT INTO arena_rewards (id, user_id, type, reward_type, reward_value, meta, created_at) VALUES (?, ?, 'daily', ?, ?, ?, ?)"
  ).run(id, user.id, picked.reward_type, picked.reward_value, picked.meta ? JSON.stringify(picked.meta) : null, now);

  return NextResponse.json({
    ok: true,
    reward: {
      type: picked.reward_type,
      value: picked.reward_value,
      meta: picked.meta || null,
    },
  });
}