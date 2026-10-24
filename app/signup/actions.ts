"use server";

import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
  if (!(await signupOpen())) return fail("Sign-up is by invitation. Ask your Canvas admin for access.");
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
    },
  });
  await recordAudit(user, { action: "org.created", summary: `Created ${org.name}` });
  await setSessionCookie(user);
  redirect("/dashboard");
}
