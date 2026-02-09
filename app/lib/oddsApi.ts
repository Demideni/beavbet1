// app/lib/oddsApi.ts
export function getOddsApiKey() {
  const key =
    process.env.ODDS_API_KEY ??
    process.env.NEXT_PUBLIC_ODDS_API_KEY ??
    process.env.THE_ODDS_API_KEY ??
    process.env.ODDSAPI_KEY ??
    "";
  return typeof key === "string" ? key.trim() : "";
}

type CacheEntry = { expiresAt: number; value: any };
const mem = new Map<string, CacheEntry>();

export function getCached<T>(key: string): T | null {
  const e = mem.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    mem.delete(key);
    return null;
  }
  return e.value as T;
}

export function setCached(key: string, value: any, ttlMs: number) {
  mem.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function oddsFetchJson<T>(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ok
  }

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return { data: data as T, headers: res.headers };
}
