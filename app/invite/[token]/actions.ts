"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { hashPassword, homeFor, setSessionCookie } from "@/lib/auth";
import { hashSecret } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { allow, clientIp, LIMITS, TOO_MANY } from "@/lib/rate-limit";

export interface AcceptState {
  error?: string;
}

const passwordSchema = z.string().min(10, "Use at least 10 characters");

export async function acceptInviteAction(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  const parsed = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!(await allow(`token:${await clientIp()}`, LIMITS.tokenUse))) return { error: TOO_MANY };

  const invite = await prisma.invite.findUnique({ where: { tokenHash: hashSecret(token) } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return { error: "This invite has expired or was already used. Ask for a new one." };
  if (await prisma.user.findUnique({ where: { email: invite.email } })) return { error: "Someone already signs in with this email. Sign in instead." };

  const passwordHash = await hashPassword(parsed.data);
  const user = await prisma.$transaction(async (tx) => {
    // Claiming the invite first means a link opened twice only creates one account.
    const claimed = await tx.invite.updateMany({ where: { id: invite.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
    if (claimed.count === 0) return null;
    return tx.user.create({
      data: {
        organizationId: invite.organizationId,
        email: invite.email,
        name: invite.name,
        passwordHash,
        role: invite.role,
        personId: invite.personId,
        lastLoginAt: new Date(),
      },
    });
  });
  if (!user) return { error: "This invite was already used." };
  await recordAudit(user, { action: "team.joined", summary: `${user.name} accepted their invite` });
  await setSessionCookie(user);
  redirect(homeFor(user.role));
}
