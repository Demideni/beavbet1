import { randomUUID, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

export const REF_COOKIE = "bb_ref";

export function hashStr(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

export function generateAffiliateCode() {
  // Short human-friendly code: 10 chars base32-ish.
  const raw = randomUUID().replace(/-/g, "");
  return raw.slice(0, 10).toUpperCase();
}

export function ensureAffiliateProfile(userId: string) {
  const db = getDb();
  const existing = db
    .prepare("SELECT user_id, code, status, created_at FROM affiliate_profiles WHERE user_id = ?")
    .get(userId) as { user_id: string; code: string; status: string; created_at: number } | undefined;

  if (existing) return existing;

  let code = generateAffiliateCode();
  // Avoid collisions
  while (
    db.prepare("SELECT code FROM affiliate_profiles WHERE code = ?").get(code) as
      | { code: string }
      | undefined
  ) {
    code = generateAffiliateCode();
  }

  const now = Date.now();
  db.prepare(
    "INSERT INTO affiliate_profiles (user_id, code, created_at, status) VALUES (?, ?, ?, 'active')"
  ).run(userId, code, now);

  return { user_id: userId, code, status: "active", created_at: now };
}

export async function getIncomingRefCode() {
  const c = await cookies();
  const ref = c.get(REF_COOKIE)?.value;
  return ref && /^[A-Z0-9]{4,32}$/.test(ref) ? ref : null;
}

export function attachReferralOnRegister(newUserId: string, refCode: string | null) {
  if (!refCode) return;
  const db = getDb();
  const affiliate = db
    .prepare("SELECT user_id, status FROM affiliate_profiles WHERE code = ?")
    .get(refCode) as { user_id: string; status: string } | undefined;

  if (!affiliate) return;
  if (affiliate.status !== "active") return;
  if (affiliate.user_id === newUserId) return;

  const now = Date.now();
  const id = randomUUID();
  try {
    db.prepare(
      "INSERT INTO referrals (id, affiliate_user_id, referred_user_id, created_at) VALUES (?, ?, ?, ?)"
    ).run(id, affiliate.user_id, newUserId, now);
  } catch {
    // unique(referred_user_id) - ignore if already attached
  }
}

export function recordAffiliateClick(code: string, ip?: string | null, ua?: string | null) {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    "INSERT INTO affiliate_clicks (id, code, created_at, ip_hash, ua_hash) VALUES (?, ?, ?, ?, ?)"
  ).run(
    randomUUID(),
    code,
    now,
    ip ? hashStr(ip) : null,
    ua ? hashStr(ua) : null
  );
}

export function accrueCommissionFromDeposit(referredUserId: string, depositAmount: number, currency: string) {
  const db = getDb();
  const ref = db
    .prepare("SELECT affiliate_user_id FROM referrals WHERE referred_user_id = ?")
    .get(referredUserId) as { affiliate_user_id: string } | undefined;
  if (!ref) return;

  // MVP: 10% revshare on deposits (for demo). Adjust later.
  const rate = 0.1;
  const amount = Number((depositAmount * rate).toFixed(2));
  if (amount <= 0) return;

  const now = Date.now();
  db.prepare(
    `INSERT INTO affiliate_commissions
      (id, affiliate_user_id, referred_user_id, basis_type, basis_amount, rate, amount, status, created_at, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`
  ).run(
    randomUUID(),
    ref.affiliate_user_id,
    referredUserId,
    "deposit",
    depositAmount,
    rate,
    amount,
    now,
    JSON.stringify({ currency })
  );
}
