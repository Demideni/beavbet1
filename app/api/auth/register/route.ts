import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { REF_COOKIE, attachReferralOnRegister } from "@/lib/affiliate";
import { cookies } from "next/headers";
import { ensureAdminRoleByEmail } from "@/lib/admin";

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(72),
  promo: z.string().max(64).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const password_hash = await bcrypt.hash(parsed.data.password, 10);

  const db = getDb();
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: string }
    | undefined;
  if (exists) {
    return NextResponse.json(
      { ok: false, error: "EMAIL_TAKEN" },
      { status: 409 }
    );
  }

  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, email, password_hash, now);

  // If this email is listed as admin in env, upgrade role
  ensureAdminRoleByEmail(email);
  db.prepare(
    "INSERT INTO profiles (user_id, nickname, currency, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, email.split("@")[0], "EUR", now);

  // Create default wallet
  db.prepare(
    "INSERT INTO wallets (id, user_id, currency, balance, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(randomUUID(), id, "EUR", 0, now);

  // ✅ Welcome reward (legal): 7 days Premium + 100 Arena Coins + Founding badge
const premiumUntil = now + 7 * 24 * 60 * 60 * 1000;
db.prepare("UPDATE users SET premium_until = ? WHERE id = ?").run(premiumUntil, id);

db.prepare("UPDATE profiles SET arena_coins = COALESCE(arena_coins, 0) + 100 WHERE user_id = ?").run(id);

db.prepare("UPDATE profiles SET badges_json = ? WHERE user_id = ? AND (badges_json IS NULL OR badges_json = '')").run(
  JSON.stringify(["founding-player"]),
  id
);

// Log rewards
db.prepare(
  "INSERT INTO arena_rewards (id, user_id, type, reward_type, reward_value, meta, created_at) VALUES (?, ?, 'welcome', 'premium_hours', ?, ?, ?)"
).run(randomUUID(), id, 7 * 24, JSON.stringify({ days: 7 }), now);

db.prepare(
  "INSERT INTO arena_rewards (id, user_id, type, reward_type, reward_value, meta, created_at) VALUES (?, ?, 'welcome', 'coins', ?, NULL, ?)"
).run(randomUUID(), id, 100, now);

db.prepare(
  "INSERT INTO arena_rewards (id, user_id, type, reward_type, reward_value, meta, created_at) VALUES (?, ?, 'welcome', 'badge', 1, ?, ?)"
).run(randomUUID(), id, JSON.stringify({ badge: "founding-player" }), now);

  // Attach affiliate referral (either from cookie ?ref=, or promo field)
  const store = await cookies();
  const cookieRef = store.get(REF_COOKIE)?.value || null;
  const promoRef = (parsed.data.promo || "").trim().toUpperCase();
  const code = promoRef && promoRef.length > 0 ? promoRef : (cookieRef ? String(cookieRef).trim().toUpperCase() : null);
  attachReferralOnRegister(id, code && /^[A-Z0-9]{4,32}$/.test(code) ? code : null);

  // If this email is listed as admin in env, upgrade role in DB.
  ensureAdminRoleByEmail(email);

  const token = signSession({ id, email });

  const res = NextResponse.json({ ok: true, user: { id, email } });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
