"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { hashSecret } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/utils";

export interface InviteFormState {
  ok?: string;
  /** The sign-up link, shown once: only its hash is stored. */
  link?: string;
  error?: string;
}

const INVITE_DAYS = 7;

const schema = z.object({
  name: z.string().trim().min(2, "Enter their name").max(120),
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["ADMIN", "MEMBER", "CARER"]),
  personId: z.string().trim(),
});

export async function inviteAction(_prev: InviteFormState, formData: FormData): Promise<InviteFormState> {
  const user = await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(["name", "email", "role", "personId"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  const { name, role } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return { error: "Someone already signs in with that email." };

  let personId: string | null = null;
  if (role === "CARER") {
    const person = await prisma.person.findFirst({ where: { id: parsed.data.personId, organizationId: user.organizationId, kind: "carer" } });
    if (!person) return { error: "Choose which carer in People this sign-in is for." };
    if (await prisma.user.findFirst({ where: { personId: person.id, role: "CARER" } })) return { error: `${person.name} can already sign in.` };
    personId = person.id;
  }

  const token = randomBytes(24).toString("base64url");
  // A new invite to the same address replaces any that are still open.
  await prisma.invite.deleteMany({ where: { organizationId: user.organizationId, email, acceptedAt: null } });
  await prisma.invite.create({
    data: {
      organizationId: user.organizationId,
      email,
      name,
      role,
      personId,
      tokenHash: hashSecret(token),
      invitedBy: user.name,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
    },
  });
  await recordAudit(user, { action: "team.invite", summary: `Invited ${name} (${email}) as ${role.toLowerCase()}` });
  revalidatePath("/team");
  return { ok: `Send ${name} this link. It works once and expires in ${INVITE_DAYS} days.`, link: appUrl(`/invite/${token}`) };
}

export async function cancelInviteAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  await prisma.invite.deleteMany({ where: { id: String(formData.get("id") ?? ""), organizationId: user.organizationId, acceptedAt: null } });
  revalidatePath("/team");
}

export async function removeUserAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const target = await prisma.user.findFirst({ where: { id: String(formData.get("id") ?? ""), organizationId: user.organizationId } });
  if (!target || target.id === user.id) return;
  if (target.role === "ADMIN" && (await prisma.user.count({ where: { organizationId: user.organizationId, role: "ADMIN" } })) <= 1) return;
  await prisma.user.delete({ where: { id: target.id } });
  await recordAudit(user, { action: "team.remove", summary: `Removed ${target.name} (${target.email})` });
  revalidatePath("/team");
}
