"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { consume } from "@/lib/auth-tokens";
import { prisma } from "@/lib/db";
import { allow, clientIp, LIMITS, TOO_MANY } from "@/lib/rate-limit";

export interface ResetState {
  error?: string;
}

// Removing a carer from People locks their sign-in until this date; a reset must not undo that.
const REMOVED_LOCK = new Date("2100-01-01");

export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const password = z.string().min(10, "Use at least 10 characters").safeParse(String(formData.get("password") ?? ""));
  if (!password.success) return { error: password.error.issues[0]?.message };
  if (!(await allow(`token:${await clientIp()}`, LIMITS.tokenUse))) return { error: TOO_MANY };
  const userId = await consume(String(formData.get("token") ?? ""), "reset_password");
  if (!userId) return { error: "This link has expired or was already used. Ask for a new one." };
  const existing = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const removed = !!existing.lockedUntil && existing.lockedUntil > REMOVED_LOCK;
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(password.data),
      // Every other session ends: whoever had the old password is signed out.
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      ...(removed ? {} : { lockedUntil: null }),
      // Opening the emailed link proves the inbox is theirs.
      emailVerified: true,
    },
  });
  await recordAudit(user, { action: "auth.password_reset", summary: "Reset their password" });
  redirect("/login?reset=1");
}
