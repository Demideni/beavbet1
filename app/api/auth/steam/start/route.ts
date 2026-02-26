import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

function baseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://beavbet.com";
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    const u = new URL(req.url);
    const returnTo = encodeURIComponent("/arena");
    return NextResponse.redirect(new URL(`/auth?returnTo=${returnTo}`, u));
  }

  const origin = baseUrl();
  const returnTo = `${origin}/api/auth/steam/callback`;
  const realm = origin;

  const steam = new URL("https://steamcommunity.com/openid/login");
  steam.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
  steam.searchParams.set("openid.mode", "checkid_setup");
  steam.searchParams.set("openid.return_to", returnTo);
  steam.searchParams.set("openid.realm", realm);
  steam.searchParams.set("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select");
  steam.searchParams.set("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select");

  return NextResponse.redirect(steam);
}
