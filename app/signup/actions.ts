"use server";

import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit";
import { sendVerification } from "@/lib/auth-tokens";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { emailConfigured } from "@/lib/email";
import { allow, clientIp, LIMITS, TOO_MANY } from "@/lib/rate-limit";
import { signupOpen } from "@/lib/signup";
import { signupSchema } from "@/lib/validation";

export interface SignupState {
  error?: string;
  /** Echoed back (except the password) so the form keeps them after an error. */
  values?: Record<string, string>;
}

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const values = Object.fromEntries(
    ["organization", "name", "email"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
  const fail = (error: string): SignupState => ({ error, values });
  if (!(await signupOpen())) return fail("Sign-up is by invitation. Ask your Elements admin for access.");
  // Without email, a new account could never be verified, so sign-up waits for it.
  if (process.env.NODE_ENV === "production" && !emailConfigured()) {
    return fail("Sign-up opens shortly. Email Wisdom@aultrum.co.uk and we'll set you up.");
  }
  if (!(await allow(`signup:${await clientIp()}`, LIMITS.signup))) return fail(TOO_MANY);
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your details");
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return fail("An account with that email already exists.");

  const org = await prisma.organization.create({ data: { name: parsed.data.organization } });
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      role: "ADMIN",
      emailVerified: false,
    },
  });
  await recordAudit(user, { action: "org.created", summary: `Created ${org.name}` });
  await sendVerification(user);
  await setSessionCookie(user);
  redirect("/verify-email");
}
