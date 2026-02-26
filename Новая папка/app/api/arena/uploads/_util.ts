import fs from "node:fs";
import path from "node:path";

export function getUploadsDir() {
  // Render persistent disk is usually mounted at /var/data
  const base = fs.existsSync("/var/data") ? "/var/data" : process.cwd();
  const dir = path.join(base, "uploads", "arena");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

export function contentTypeFromName(name: string) {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".webm") return "audio/webm";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp4" || ext === ".m4a") return "audio/mp4";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}
