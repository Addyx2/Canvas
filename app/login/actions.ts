"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit";
import { homeFor, requireSignedIn, setSessionCookie, verifyPassword } from "@/lib/auth";
import { LOCKOUT_MINUTES, MAX_FAILED_LOGINS, SESSION_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { safeNextPath } from "@/lib/utils";
import { loginSchema } from "@/lib/validation";

export interface LoginState {
  error?: string;
  /** Echoed back so the form keeps it after a failed attempt. */
  email?: string;
}

// Compared against for unknown emails, so timing doesn't reveal which accounts exist.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.wjv1yUuRcIKAv8nh9Z3jO0Hn0V3K";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const fail = (error: string): LoginState => ({ error, email });
  const parsed = loginSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your details and try again");

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) {
    await verifyPassword(parsed.data.password, DUMMY_HASH);
    return fail("Incorrect email or password");
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return fail(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }

  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      },
    });
    if (lock) await recordAudit(user, { action: "auth.locked", summary: `Sign-in locked after ${MAX_FAILED_LOGINS} failed attempts` });
    return fail("Incorrect email or password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await recordAudit(user, { action: "auth.login", summary: "Signed in" });
  await setSessionCookie(user);
  redirect(user.role === "CARER" ? homeFor(user.role) : (safeNextPath(String(formData.get("next") ?? "")) ?? homeFor(user.role)));
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function logoutEverywhereAction(): Promise<void> {
  const user = await requireSignedIn();
  await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await recordAudit(user, { action: "auth.logout_all", summary: "Signed out of all devices" });
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
