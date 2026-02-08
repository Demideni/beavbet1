import { NextResponse } from "next/server";
import { getOddsApiKey, oddsFetchJson } from "@/app/lib/oddsApi";

export const dynamic = "force-dynamic";

// GET /api/odds/odds?sport=soccer_epl&regions=us&markets=h2h&oddsFormat=decimal
export async function GET(req: Request) {
  const apiKey = getOddsApiKey();
  if (!apiKey) return NextResponse.json({ error: "ODDS_API_KEY is not set" }, { status: 500 });

  const { searchParams } = new URL(req.url);

  const sport = searchParams.get("sport") || "soccer_epl";
  const regions = searchParams.get("regions") || "us";
  const markets = searchParams.get("markets") || "h2h";
  const oddsFormat = searchParams.get("oddsFormat") || "decimal";
  const dateFormat = searchParams.get("dateFormat") || "iso";

  const url = new URL(`https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sport)}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", regions);
  url.searchParams.set("markets", markets);
  url.searchParams.set("oddsFormat", oddsFormat);
  url.searchParams.set("dateFormat", dateFormat);

  try {
    const { data } = await oddsFetchJson<any>(url.toString());
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Odds API request failed" }, { status: 502 });
  }
}
