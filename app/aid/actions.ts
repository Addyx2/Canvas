"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth";
import { LOCKOUT_MINUTES, MAX_FAILED_LOGINS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { idUrl, workspaceUrl } from "@/lib/aultrum-id/hosts";
import { endSession, startSession } from "@/lib/aultrum-id/session";

export interface IdFormState {
  error?: string;
  /** Set on success: the form navigates here with a full page load. */
  next?: string;
  values?: { email?: string; name?: string };
}

// Compared against for unknown emails, so timing doesn't reveal which accounts exist.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.wjv1yUuRcIKAv8nh9Z3jO0Hn0V3K";

/**
 * Where to go after signing in: back to an authorization request on this
 * host, or Workspace. Always absolute, so the browser does a full navigation
 * (the authorize endpoint is a route handler, not a page).
 */
export async function afterSignIn(returnTo: string | null | undefined): Promise<string> {
  return returnTo && /^\/authorize\?[^\s]*$/.test(returnTo) ? `${idUrl()}${returnTo}` : workspaceUrl();
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function idLoginAction(_prev: IdFormState, form: FormData): Promise<IdFormState> {
  const email = String(form.get("email") ?? "");
  const fail = (error: string): IdFormState => ({ error, values: { email } });
  const parsed = loginSchema.safeParse({ email, password: form.get("password") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your details");

  const identity = await prisma.identity.findUnique({ where: { email: parsed.data.email } });
  if (!identity) {
    await verifyPassword(parsed.data.password, DUMMY_HASH);
    return fail("Incorrect email or password");
  }
  if (identity.lockedUntil && identity.lockedUntil > new Date()) {
    const minutes = Math.ceil((identity.lockedUntil.getTime() - Date.now()) / 60_000);
    return fail(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
  if (!(await verifyPassword(parsed.data.password, identity.passwordHash))) {
    const failed = identity.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.identity.update({
      where: { id: identity.id },
      data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null },
    });
    return fail("Incorrect email or password");
  }

  await prisma.identity.update({ where: { id: identity.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await startSession("id", identity);
  return { next: await afterSignIn(String(form.get("return") ?? "")) };
}

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").max(200),
});

export async function idSignupAction(_prev: IdFormState, form: FormData): Promise<IdFormState> {
  const values = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  const parsed = signupSchema.safeParse({ ...values, password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details", values };
  if (await prisma.identity.findUnique({ where: { email: parsed.data.email } })) {
    return { error: "There's already an Aultrum ID for this email. Sign in instead.", values };
  }
  const identity = await prisma.identity.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), lastLoginAt: new Date() },
  });
  await startSession("id", identity);
  return { next: await afterSignIn(String(form.get("return") ?? "")) };
}

export async function idLogoutAction(): Promise<void> {
  await endSession("id");
  redirect("/login");
}
