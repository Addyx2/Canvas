"use server";

import { z } from "zod";

import { sendPasswordReset } from "@/lib/auth-tokens";
import { prisma } from "@/lib/db";
import { showLinksOnScreen } from "@/lib/email";
import { allow, clientIp, LIMITS, TOO_MANY } from "@/lib/rate-limit";

export interface ForgotState {
  done?: boolean;
  error?: string;
  /** Only outside production, before email is set up. */
  link?: string;
}

export async function forgotAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email" };
  if (!(await allow(`reset:${await clientIp()}`, LIMITS.resetRequest))) return { error: TOO_MANY };
  // The same answer whether or not the account exists, so this can't be used to find accounts.
  if (!(await allow(`reset-email:${email}`, LIMITS.resetPerEmail))) return { done: true };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { done: true };
  const { sent, link } = await sendPasswordReset(user);
  return { done: true, link: !sent && showLinksOnScreen() ? link : undefined };
}
