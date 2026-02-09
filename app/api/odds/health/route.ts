import { NextResponse } from "next/server";
import { getOddsApiKey } from "@/app/lib/oddsApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const key = getOddsApiKey();
  const masked = key ? `${key.slice(0, 3)}***${key.slice(-3)}` : null;

  return NextResponse.json({
    ok: true,
    hasKey: Boolean(key),
    masked,
    nodeEnv: process.env.NODE_ENV,
    envSeen: {
      ODDS_API_KEY: Boolean(process.env.ODDS_API_KEY),
      NEXT_PUBLIC_ODDS_API_KEY: Boolean(process.env.NEXT_PUBLIC_ODDS_API_KEY),
      THE_ODDS_API_KEY: Boolean(process.env.THE_ODDS_API_KEY),
      ODDSAPI_KEY: Boolean(process.env.ODDSAPI_KEY),
    },
  });
}
