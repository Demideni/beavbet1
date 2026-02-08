import { NextResponse } from "next/server";
import { getCached, getOddsApiKey, oddsFetchJson, setCached } from "@/app/lib/oddsApi";


// GET /api/odds/top
// Возвращает 3 “топ” лиги и по 3 матча на каждую (h2h)

export const dynamic = "force-dynamic";

type ApiOutcome = { name: string; price: number };
type ApiMarket = { key: string; outcomes: ApiOutcome[] };
type ApiBookmaker = { title: string; markets: ApiMarket[] };

type ApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: ApiBookmaker[];
};

type MiniOdds = { home?: number; away?: number; draw?: number; bookmaker?: string };
type MiniEvent = { id: string; commenceTime: string; homeTeam: string; awayTeam: string; odds: MiniOdds };

const TOP_LEAGUES: Array<{ sportKey: string; title: string }> = [
  { sportKey: "soccer_epl", title: "Premier League" },
  { sportKey: "basketball_nba", title: "NBA" },
  { sportKey: "americanfootball_nfl", title: "NFL" },
];

function extractH2H(ev: ApiEvent): MiniOdds {
  for (const bm of ev.bookmakers || []) {
    const m = (bm.markets || []).find((x) => x.key === "h2h");
    if (!m) continue;

    const out: MiniOdds = { bookmaker: bm.title };
    for (const o of m.outcomes || []) {
      if (o.name === ev.home_team) out.home = o.price;
      else if (o.name === ev.away_team) out.away = o.price;
      else out.draw = o.price; // ничья для 3-way
    }
    return out;
  }
  return {};
}

async function fetchLeague(apiKey: string, sportKey: string): Promise<ApiEvent[]> {
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sportKey)}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  const { data } = await oddsFetchJson<ApiEvent[]>(url.toString());
  return Array.isArray(data) ? data : [];
}

export async function GET() {
  const apiKey = getOddsApiKey();
  if (!apiKey) return NextResponse.json({ error: "ODDS_API_KEY is not set" }, { status: 500 });

  const cacheKey = "odds:home-top:us:h2h";
  const cached = getCached<any>(cacheKey);
  if (cached) return NextResponse.json({ data: cached });

  try {
    const data = await Promise.all(
      TOP_LEAGUES.map(async (l) => {
        const events = await fetchLeague(apiKey, l.sportKey);
        const mini: MiniEvent[] = events.slice(0, 3).map((ev) => ({
          id: ev.id,
          commenceTime: ev.commence_time,
          homeTeam: ev.home_team,
          awayTeam: ev.away_team,
          odds: extractH2H(ev),
        }));
        return { sportKey: l.sportKey, title: l.title, events: mini };
      })
    );

    setCached(cacheKey, data, 15_000); // 15 сек, чтобы не жечь лимиты
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Odds API request failed" }, { status: 502 });
  }
}
