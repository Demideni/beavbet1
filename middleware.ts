import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

const BLOCK = [
  "/wp-admin",
  "/wp-login.php",
  "/xmlrpc.php",
  "/wordpress",
  "/setup-config.php",
];

const PROTECTED_PAGES = ["/account", "/cashier"];
const PROTECTED_API_PREFIXES = [
  "/api/me",
  "/api/transactions",
  "/api/payments",
  "/api/games/robinson",
  "/api/aff/me",
  "/api/aff/stats",
  "/api/aff/payout",
];

const ACCESS_COOKIE = "PULZ_AT";
const AFF_COOKIE = "aff_ref";

export function middleware(req: NextRequest, ev: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  // block wp-scanners
  if (
    BLOCK.some(
      (p) =>
        pathname === p || pathname.startsWith(p + "/") || pathname.endsWith(p)
    )
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const hasAuth = Boolean(req.cookies.get(ACCESS_COOKIE)?.value);

  // --- affiliate ref capture: /?ref=CODE -> cookie aff_ref (30d) + click record
  const ref = req.nextUrl.searchParams.get("ref")?.trim().toUpperCase();
  if (ref && ref.length >= 3 && ref.length <= 32) {
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete("ref");

    // редиректим на чистый URL и на ЭТОТ ЖЕ response ставим cookie
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(AFF_COOKIE, ref, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    // записываем клик (не блокируем пользователя)
    try {
      const clickUrl = new URL("/api/aff/click", req.nextUrl.origin);
      ev.waitUntil(
        fetch(clickUrl.toString(), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            code: ref,
            landingPath: pathname,
            referrer: req.headers.get("referer") || undefined,
          }),
        }).then(
          () => undefined,
          () => undefined
        )
      );
    } catch {
      // ignore
    }

    return res;
  }
  // --- /affiliate ref capture

  // protect pages
  if (PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!hasAuth) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // protect API
  if (PROTECTED_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!hasAuth) {
      return NextResponse.json(
        { ok: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
