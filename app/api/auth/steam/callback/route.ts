import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

function baseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://beavbet.com";
}

function extractSteamId(claimedId: string | null) {
  if (!claimedId) return null;
  const m = claimedId.match(/https?:\/\/steamcommunity\.com\/openid\/id\/(\d{5,})/i);
  return m?.[1] ?? null;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(`${baseUrl()}/auth?returnTo=${encodeURIComponent("/arena")}`);
  }

  const url = new URL(req.url);

  // Steam sends back a bunch of openid.* fields. We must validate them with check_authentication.
  const params = new URLSearchParams();
  for (const [k, v] of url.searchParams.entries()) {
    if (k.startsWith("openid.")) params.set(k, v);
  }
  params.set("openid.mode", "check_authentication");

  const steamId = extractSteamId(url.searchParams.get("openid.claimed_id"));
  if (!steamId) {
    return NextResponse.redirect(`${baseUrl()}/arena?steam=error`);
  }

  try {
    const r = await fetch("https://steamcommunity.com/openid/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    });
    const text = await r.text();
    const ok = /is_valid\s*:\s*true/i.test(text);

    if (!ok) {
      return NextResponse.redirect(`${baseUrl()}/arena?steam=invalid`);
    }

    const db = getDb();
    const now = Date.now();

    // Upsert link for this user.
    db.prepare(
      `INSERT INTO steam_links (user_id, steam_id, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET steam_id=excluded.steam_id`
    ).run(user.id, steamId, now);

    return NextResponse.redirect(`${baseUrl()}/arena?steam=connected`);
  } catch {
    return NextResponse.redirect(`${baseUrl()}/arena?steam=error`);
  }
}
