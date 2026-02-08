import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const Schema = z.object({
  currentPassword: z.string().min(6).max(72),
  newPassword: z.string().min(6).max(72),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(session.id) as { password_hash: string } | undefined;

  if (!row) return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });

  const ok = await bcrypt.compare(parsed.data.currentPassword, row.password_hash);
  if (!ok) return NextResponse.json({ ok: false, error: "WRONG_PASSWORD" }, { status: 401 });

  const password_hash = await bcrypt.hash(parsed.data.newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(password_hash, session.id);

  return NextResponse.json({ ok: true });
}
