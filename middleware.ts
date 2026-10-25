import { NextResponse, type NextRequest } from "next/server";

import { HOST_PREFIX, hostKind } from "./lib/aultrum-id/hosts";
import { SESSION_COOKIE } from "./lib/constants";
import { frameAncestors, verifyEmbedToken } from "./lib/embed-token";
import { authSecret } from "./lib/secret";

const CONSOLE_PREFIXES = ["/dashboard", "/elements", "/systems", "/installations", "/events", "/developers"];
const INTERNAL = Object.values(HOST_PREFIX);

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const kind = hostKind(request.headers.get("host"));

  // Aultrum ID and Workspace: serve that product's pages, which live under
  // an internal prefix, for every path on its own host.
  if (kind !== "canvas") {
    const url = request.nextUrl.clone();
    url.pathname = `${HOST_PREFIX[kind]}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // The internal prefixes are never reachable on the Canvas host.
  if (INTERNAL.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (pathname.startsWith("/embed/")) {
    // Only the platform the token was issued for may frame this screen.
    const claims = await verifyEmbedToken(searchParams.get("token"), authSecret());
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
  // Everything but Next's own assets: the host decides which product answers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
