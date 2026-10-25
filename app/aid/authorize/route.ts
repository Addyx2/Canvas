import { NextResponse } from "next/server";

import { idUrl } from "@/lib/aultrum-id/hosts";
import { checkAuthorize, issueCode } from "@/lib/aultrum-id/oidc";
import { currentIdentity } from "@/lib/aultrum-id/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function problem(message: string) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aultrum ID</title>
<body style="font-family:system-ui,sans-serif;max-width:28rem;margin:15vh auto;padding:0 1rem;color:#0f172a">
<h1 style="font-size:1.25rem">Sign-in couldn't start</h1><p style="color:#475569">${message.replace(/[<>&]/g, "")}</p>
<p><a href="/login" style="color:#0f766e">Go to Aultrum ID</a></p></body>`;
  return new NextResponse(html, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// OpenID Connect authorization endpoint. Every client is an Aultrum product,
// so there's no consent screen: a signed-in person goes straight back.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const client = await prisma.oAuthClient.findUnique({ where: { clientId: params.get("client_id") ?? "" } });
  const check = checkAuthorize(params, client);
  if (!check.ok) return "show" in check ? problem(check.show) : NextResponse.redirect(check.redirect);

  const identity = await currentIdentity("id");
  if (!identity) {
    if (params.get("prompt") === "none") {
      const url = new URL(check.request.redirectUri);
      url.searchParams.set("error", "login_required");
      url.searchParams.set("state", check.request.state);
      return NextResponse.redirect(url);
    }
    const login = new URL(`${idUrl()}/login`);
    login.searchParams.set("return", `/authorize?${params.toString()}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.redirect(await issueCode(check.request, identity.id));
}
