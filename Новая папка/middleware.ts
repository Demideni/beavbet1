import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const protectedPrefixes = ["/account", "/payments", "/security", "/vip", "/stats", "/admin"];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // NOTE: Middleware runs in the Edge runtime. Libraries like `jsonwebtoken`
  // are not reliably compatible there, which can cause valid sessions to be
  // treated as invalid and lead to redirect loops.
  // For now we only check that the session cookie exists.
  // All protected pages and API routes still validate the session server-side.
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/auth";
  url.searchParams.set("tab", "login");
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/account/:path*", "/payments", "/security", "/vip", "/stats", "/admin/:path*"],
};
