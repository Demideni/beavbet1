import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const encoder = new TextEncoder();

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return encoder.encode(secret);
}

export type AuthUser = { id: string; email: string };

export const ACCESS_COOKIE = "PULZ_AT";

export async function signAccessToken(user: AuthUser) {
  return await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, secretKey());
  return payload as AuthUser;
}

// ✅ ЕДИНСТВЕННО ПРАВИЛЬНЫЙ СПОСОБ
export function setAccessCookie(res: NextResponse, token: string) {
  res.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14,
  });
}
export function clearAccessCookie(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}


export async function getUserFromRequest(
  req: NextRequest
): Promise<AuthUser | null> {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}
