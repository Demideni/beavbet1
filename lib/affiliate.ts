import crypto from "crypto";
import type { NextRequest } from "next/server";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function generateAffiliateCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function hashWithSalt(input: string) {
  const salt = process.env.AFFILIATE_HASH_SALT || process.env.JWT_SECRET || "pulz";
  return crypto.createHash("sha256").update(salt + ":" + input).digest("hex");
}

export function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();
  return "0.0.0.0";
}

export function fingerprintHashes(req: NextRequest) {
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent") || "";
  return { ipHash: hashWithSalt(ip), uaHash: hashWithSalt(ua) };
}
