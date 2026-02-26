import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getArenaProfile } from "@/lib/arenaDuels";

function computePlace(db: any, elo: number) {
  const row = db
    .prepare("SELECT COUNT(1) AS c FROM arena_ratings WHERE dam_rank > ?")
    .get(Number(elo || 0)) as { c: number } | undefined;
  return 1 + Number(row?.c || 0);
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ ok: true, q: "", rows: [] });

  const db = getDb();
  const like = `%${q.toLowerCase()}%`;

  const rows = db
    .prepare(
      `
      SELECT u.id as userId,
             p.nickname as nickname,
             p.avatar_url as avatarUrl
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE p.nickname IS NOT NULL
        AND LOWER(p.nickname) LIKE ?
      ORDER BY LENGTH(p.nickname) ASC
      LIMIT 30
      `
    )
    .all(like) as Array<{ userId: string; nickname: string | null; avatarUrl: string | null }>;

  const out = rows.map((r) => {
    const arena = getArenaProfile(r.userId, 0);
    const prof = arena?.profile;
    const elo = Number(prof?.elo || 1000);
    return {
      userId: r.userId,
      nickname: r.nickname ?? "Unknown",
      avatarUrl: r.avatarUrl ?? prof?.avatarUrl ?? null,
      elo,
      division: prof?.division ?? "Silver",
      place: computePlace(db, elo),
    };
  });

  return NextResponse.json({ ok: true, q, rows: out });
}