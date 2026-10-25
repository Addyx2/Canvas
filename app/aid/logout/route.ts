import { NextResponse } from "next/server";

import { syncEnvClients } from "@/lib/aultrum-id/clients";
import { idUrl } from "@/lib/aultrum-id/hosts";
import { endSession } from "@/lib/aultrum-id/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// End-session endpoint: signs out of Aultrum ID, then returns to the product
// if it named a registered post-logout address.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  await endSession("id");
  const target = params.get("post_logout_redirect_uri");
  await syncEnvClients();
  const client = await prisma.oAuthClient.findUnique({ where: { clientId: params.get("client_id") ?? "" } });
  if (target && client && !client.revokedAt && client.postLogoutRedirectUris.includes(target)) {
    return NextResponse.redirect(target);
  }
  return NextResponse.redirect(`${idUrl()}/login`);
}
