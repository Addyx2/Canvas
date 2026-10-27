import { randomBytes } from "node:crypto";

import { hashSecret } from "./credentials";
import { prisma } from "./db";
import { sendEmail } from "./email";
import { appUrl } from "./utils";

export type AuthTokenKind = "verify_email" | "reset_password";

const TTL_MINUTES: Record<AuthTokenKind, number> = { verify_email: 24 * 60, reset_password: 60 };

/** Issues a one-time link, replacing any unused link of the same kind. */
async function issue(userId: string, kind: AuthTokenKind): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await prisma.authToken.deleteMany({ where: { userId, kind, usedAt: null } });
  await prisma.authToken.create({
    data: { userId, kind, tokenHash: hashSecret(token), expiresAt: new Date(Date.now() + TTL_MINUTES[kind] * 60_000) },
  });
  return token;
}

/** Marks a link used and returns its user, or null if it is unknown, used or expired. */
export async function consume(token: string, kind: AuthTokenKind): Promise<string | null> {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashSecret(token) } });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date()) return null;
  // Claiming it in one update means a link opened twice only works once.
  const claimed = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return claimed.count === 1 ? row.userId : null;
}

/** Whether a link is still usable, without using it (to decide what a page shows). */
export async function isLive(token: string, kind: AuthTokenKind): Promise<boolean> {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashSecret(token) } });
  return !!row && row.kind === kind && !row.usedAt && row.expiresAt > new Date();
}

export async function sendVerification(user: { id: string; email: string; name: string }): Promise<{ sent: boolean; link: string }> {
  const link = appUrl(`/verify/${await issue(user.id, "verify_email")}`);
  const sent = await sendEmail({
    to: user.email,
    subject: "Confirm your email for Aultrum Elements",
    text: `Hi ${user.name.split(" ")[0]},\n\nConfirm your email to start using Aultrum Elements:\n\n${link}\n\nThe link works once and lasts 24 hours. If you didn't sign up, you can ignore this email.`,
  });
  return { sent, link };
}

export async function sendPasswordReset(user: { id: string; email: string; name: string }): Promise<{ sent: boolean; link: string }> {
  const link = appUrl(`/reset/${await issue(user.id, "reset_password")}`);
  const sent = await sendEmail({
    to: user.email,
    subject: "Reset your Aultrum Elements password",
    text: `Hi ${user.name.split(" ")[0]},\n\nOpen this link to choose a new password:\n\n${link}\n\nThe link works once and lasts an hour. If you didn't ask for this, you can ignore this email; your password hasn't changed.`,
  });
  return { sent, link };
}
