export function isAdminEmail(email: string) {
  const raw = process.env.ADMIN_EMAILS || "";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return list.includes(email.trim().toLowerCase());
}
