import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "bb_session";

export type SessionUser = {
  id: string;
  email: string;
};

const JWT_SECRET = process.env.BEAVBET_JWT_SECRET || process.env.JWT_SECRET || "dev-secret-change-me";

export function signSession(user: SessionUser) {
  // 14 days
  return jwt.sign(user, JWT_SECRET, { expiresIn: "14d" });
}

export function verifySession(token: string): SessionUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Next.js 15+: `cookies()` is async in Route Handlers / Server Components.
 * Always await it to avoid "cookies() should be awaited" runtime errors.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
