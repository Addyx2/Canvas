import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { idUrl, WORKSPACE_STATE_COOKIE, workspaceUrl } from "@/lib/aultrum-id/hosts";
import { newPendingSignIn, WORKSPACE_CLIENT_ID, workspaceClient } from "@/lib/aultrum-id/workspace";

export const dynamic = "force-dynamic";

// Starts signing in to Workspace through Aultrum ID.
export async function GET() {
  await workspaceClient();
  const { pending, cookie, challenge } = newPendingSignIn();
  (await cookies()).set(WORKSPACE_STATE_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  const url = new URL(`${idUrl()}/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: WORKSPACE_CLIENT_ID,
    redirect_uri: `${workspaceUrl()}/callback`,
    scope: "openid profile email",
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return NextResponse.redirect(url);
}
