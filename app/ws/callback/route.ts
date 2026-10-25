import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { WORKSPACE_STATE_COOKIE, workspaceUrl } from "@/lib/aultrum-id/hosts";
import { redeemCode } from "@/lib/aultrum-id/oidc";
import { startSession } from "@/lib/aultrum-id/session";
import { readPendingSignIn, workspaceClient } from "@/lib/aultrum-id/workspace";

export const dynamic = "force-dynamic";

// Aultrum ID sends people back here with a one-time code. Workspace lives in
// the same app as Aultrum ID, so it redeems the code directly.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const pending = readPendingSignIn(jar.get(WORKSPACE_STATE_COOKIE)?.value);
  jar.delete(WORKSPACE_STATE_COOKIE);
  const retry = NextResponse.redirect(`${workspaceUrl()}/signin`);

  if (!pending || params.get("state") !== pending.state || params.get("error")) return retry;
  const client = await workspaceClient();
  const code = await redeemCode(client, params.get("code") ?? "", `${workspaceUrl()}/callback`, pending.verifier);
  if (!code || code.nonce !== pending.nonce) return retry;

  await startSession("workspace", code.identity);
  return NextResponse.redirect(workspaceUrl());
}
