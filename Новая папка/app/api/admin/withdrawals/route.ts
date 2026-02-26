import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
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
  const status = (url.searchParams.get("status") || "pending").trim();
  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") || 50)));

  const rows = db
    .prepare(
      `SELECT w.id, w.user_id as userId, u.email as email, w.amount, w.currency, w.method, w.details, w.status, w.admin_note as adminNote, w.txid, w.created_at as createdAt, w.updated_at as updatedAt
         FROM withdrawal_requests w
         JOIN users u ON u.id = w.user_id
        WHERE w.status = ?
        ORDER BY w.created_at DESC
        LIMIT ?`
    )
    .all(status, limit) as any[];

  return NextResponse.json({ ok: true, items: rows.map((r) => ({ ...r, email: maskEmail(String(r.email)) })) });
}

const PatchSchema = z.object({
  id: z.string().min(8).max(64),
  status: z.enum(["pending", "approved", "paid", "rejected"]),
  adminNote: z.string().max(240).optional().or(z.literal("")),
  txid: z.string().max(120).optional().or(z.literal("")),
});

export async function PATCH(req: Request) {
  const session = await getSessionUser();
  if (!session || !isAdminUser(session.id, session.email)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const db = getDb();
  const now = Date.now();
  db.prepare(
    `UPDATE withdrawal_requests
        SET status = ?, admin_note = ?, txid = ?, updated_at = ?
      WHERE id = ?`
  ).run(
    parsed.data.status,
    parsed.data.adminNote ? String(parsed.data.adminNote) : null,
    parsed.data.txid ? String(parsed.data.txid) : null,
    now,
    parsed.data.id
  );

  db.prepare(
    "INSERT INTO admin_audit_log (id, admin_id, action, target_user_id, meta, created_at) VALUES (?, ?, ?, (SELECT user_id FROM withdrawal_requests WHERE id = ?), ?, ?)"
  ).run(
    randomUUID(),
    session.id,
    "WITHDRAWAL_UPDATE",
    parsed.data.id,
    JSON.stringify({ id: parsed.data.id, status: parsed.data.status, txid: parsed.data.txid || null }),
    now
  );

  return NextResponse.json({ ok: true });
}

function maskEmail(email: string) {
  const [u, d] = email.split("@");
  const user = u.length <= 2 ? u[0] + "*" : u[0] + "***" + u[u.length - 1];
  return `${user}@${d || "***"}`;
}
