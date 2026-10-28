import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "./lib/constants";
import { frameAncestors, verifyEmbedToken } from "./lib/embed-token";
import { authSecret } from "./lib/secret";

const CONSOLE_PREFIXES = ["/dashboard", "/elements", "/systems", "/installations", "/events", "/developers", "/gateway", "/peak", "/people", "/team", "/me", "/aultrum"];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/embed/")) {
    // Only the platform the token was issued for may frame this screen.
    const claims = await verifyEmbedToken(searchParams.get("token"), await authSecret());
    const response = NextResponse.next();
    response.headers.set(
      "Content-Security-Policy",
      `${frameAncestors(claims?.origins ?? [])}; base-uri 'self'; form-action 'self'; object-src 'none'`,
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const isConsole = CONSOLE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isConsole && !request.cookies.get(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Node.js runtime: the embed check reads the signing secret from the database.
  runtime: "nodejs",
  matcher: [
    "/embed/:path*",
    "/dashboard/:path*",
    "/elements/:path*",
    "/systems/:path*",
    "/installations/:path*",
    "/events/:path*",
    "/developers/:path*",
    "/gateway/:path*",
    "/peak/:path*",
    "/people/:path*",
    "/team/:path*",
    "/me/:path*",
    "/aultrum/:path*",
  ],
};
