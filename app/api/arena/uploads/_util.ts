import fs from "node:fs";
import path from "node:path";

/** Prefer Render persistent disk (/var/data). Fallback to project-local .data for local dev. */
export function getDataDir() {
  const p = process.env.DATA_DIR || "/var/data";
  const dir = fs.existsSync(p) ? p : path.join(process.cwd(), ".data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getUploadsDir() {
  const base = getDataDir();
  const dir = path.join(base, "uploads");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
