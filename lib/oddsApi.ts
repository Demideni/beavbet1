const BASE = process.env.ODDS_API_BASE || "https://api.the-odds-api.com/v4";

function apiKey() {
  const k = process.env.ODDS_API_KEY;
  if (!k) throw new Error("ODDS_API_KEY is not set");
  return k;
}

export type OddsUsage = {
  remaining?: string | null;
  used?: string | null;
  last?: string | null;
};

async function fetchWithRetry(url: string, init?: RequestInit) {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;

    // 429 Too Many Requests — backoff
    attempt += 1;
    const retryAfter = Number(res.headers.get("retry-after") || "0");
    const sleepMs = Math.min(10_000, (retryAfter ? retryAfter * 1000 : 500) * attempt);
    await new Promise((r) => setTimeout(r, sleepMs));
    if (attempt >= 5) return res;
  }
}

export async function oddsGet<T>(path: string, qs: Record<string, string | number | boolean | undefined> = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apiKey", apiKey());
  for (const [k, v] of Object.entries(qs)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetchWithRetry(url.toString(), {
    // never cache live odds on the server
    cache: "no-store",
  });

  const usage: OddsUsage = {
    remaining: res.headers.get("x-requests-remaining"),
    used: res.headers.get("x-requests-used"),
    last: res.headers.get("x-requests-last"),
  };

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Odds API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as T;
  return { data, usage };
}

export function americanToDecimal(american: number) {
  if (american === 0) return 1;
  if (american > 0) return 1 + american / 100;
  return 1 + 100 / Math.abs(american);
}

export function decimalToAmerican(decimal: number) {
  if (decimal <= 1) return 0;
  // approx conversion
  const profit = decimal - 1;
  if (profit >= 1) return Math.round(profit * 100);
  return -Math.round(100 / profit);
}
