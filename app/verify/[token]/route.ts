import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";
import { consume } from "@/lib/auth-tokens";
import { prisma } from "@/lib/db";
import { allow, ipFrom, LIMITS } from "@/lib/rate-limit";
import { appUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

// The link in the confirmation email. Opening it proves the inbox is theirs.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await allow(`token:${ipFrom(request.headers)}`, LIMITS.tokenUse))) return NextResponse.redirect(appUrl("/verify-email"));
  const userId = await consume(token, "verify_email");
  if (!userId) {
    const current = await getSessionUser();
    return NextResponse.redirect(appUrl(current?.emailVerified ? "/dashboard" : "/verify-email?expired=1"));
  }
  const user = await prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
  await recordAudit(user, { action: "auth.email_verified", summary: "Confirmed their email" });
  const current = await getSessionUser();
  return NextResponse.redirect(appUrl(current?.id === user.id ? "/dashboard" : "/login?verified=1"));
}
