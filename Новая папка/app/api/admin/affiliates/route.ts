import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session || !isAdminUser(session.id, session.email)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const db = getDb();
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") || 50)));

  const rows = db
    .prepare(
      `SELECT ap.user_id as userId, ap.code, ap.status, ap.created_at as createdAt,
              u.email as email,
              (SELECT COUNT(*) FROM affiliate_clicks c WHERE c.code = ap.code) as clicks,
              (SELECT COUNT(*) FROM referrals r WHERE r.affiliate_user_id = ap.user_id) as players,
              (SELECT COALESCE(SUM(amount),0) FROM affiliate_commissions ac WHERE ac.affiliate_user_id = ap.user_id AND ac.status IN ('pending','approved','paid')) as earned,
              (SELECT COALESCE(SUM(amount),0) FROM affiliate_commissions ac WHERE ac.affiliate_user_id = ap.user_id AND ac.status = 'approved') as approved,
              (SELECT COALESCE(SUM(amount),0) FROM withdrawal_requests wr WHERE wr.user_id = ap.user_id AND wr.status IN ('pending','approved')) as reserved,
              (SELECT COALESCE(SUM(amount),0) FROM withdrawal_requests wr WHERE wr.user_id = ap.user_id AND wr.status = 'paid') as withdrawn
         FROM affiliate_profiles ap
         JOIN users u ON u.id = ap.user_id
        ORDER BY ap.created_at DESC
        LIMIT ?`
    )
    .all(limit) as any[];

  const items = rows.map((r) => {
    const available = Math.max(0, Number((r.approved - r.reserved - r.withdrawn).toFixed(2)));
    return { ...r, email: maskEmail(String(r.email)), available };
  });

  return NextResponse.json({ ok: true, items });
}

function maskEmail(email: string) {
  const [u, d] = email.split("@");
  const user = u.length <= 2 ? u[0] + "*" : u[0] + "***" + u[u.length - 1];
  return `${user}@${d || "***"}`;
}
