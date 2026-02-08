import { getDb } from "@/lib/db";

export function isAdminEmail(email: string) {
  const raw = (process.env.BEAVBET_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "").trim();
  if (!raw) return false;
  const set = new Set(raw.split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean));
  return set.has(email.toLowerCase());
}

export function isAdminUser(userId: string, email?: string) {
  const db = getDb();
  const row = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role?: string } | undefined;
  if (row?.role === "admin" || row?.role === "finance") return true;
  if (email && isAdminEmail(email)) return true;
  return false;
}

export function ensureAdminRoleByEmail(email: string) {
  if (!isAdminEmail(email)) return;
  const db = getDb();
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ? AND role != 'admin'").run(email.toLowerCase());
}
