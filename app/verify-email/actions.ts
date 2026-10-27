"use server";

import { getSessionUser } from "@/lib/auth";
import { sendVerification } from "@/lib/auth-tokens";
import { showLinksOnScreen } from "@/lib/email";
import { allow, LIMITS, TOO_MANY } from "@/lib/rate-limit";

export interface ResendState {
  ok?: string;
  error?: string;
  /** Only outside production, before email is set up. */
  link?: string;
}

export async function resendVerificationAction(): Promise<ResendState> {
  const user = await getSessionUser();
  if (!user || user.emailVerified) return { ok: "Your email is already confirmed." };
  if (!(await allow(`verify-resend:${user.id}`, LIMITS.verifyResend))) return { error: TOO_MANY };
  const { sent, link } = await sendVerification(user);
  if (sent) return { ok: `Sent again to ${user.email}.` };
  return showLinksOnScreen() ? { ok: "Email isn't set up here, so here's the link:", link } : { error: "We couldn't send the email. Try again in a minute." };
}
