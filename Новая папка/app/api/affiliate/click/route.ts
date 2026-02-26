import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAffiliateClick, REF_COOKIE } from "@/lib/affiliate";

const Schema = z.object({
  code: z.string().min(4).max(32),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const code = parsed.data.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,32}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "INVALID_CODE" }, { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || null;
  const ua = req.headers.get("user-agent") || null;

  try {
    recordAffiliateClick(code, ip, ua);
  } catch {
    // ignore
  }

  const res = NextResponse.json({ ok: true });
  // Store referral code for 30 days
  res.cookies.set({
    name: REF_COOKIE,
    value: code,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
