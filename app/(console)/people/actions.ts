"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalisePhone } from "@/lib/gateway/directory";
import { forgetPerson, syncPerson } from "@/lib/standalone";

export interface PersonFormState {
  ok?: string;
  error?: string;
}

const schema = z.object({
  name: z.string().trim().min(2, "Enter their name").max(120),
  phone: z.string().trim().max(30),
  email: z.string().trim().max(200).refine((v) => v === "" || /^\S+@\S+\.\S+$/.test(v), "Enter a valid email or leave it empty"),
  kind: z.enum(["carer", "client", "other"]),
  organisation: z.string().trim().max(200),
});

export async function addPersonAction(_prev: PersonFormState, formData: FormData): Promise<PersonFormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(["name", "phone", "email", "kind", "organisation"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  const phone = parsed.data.phone ? normalisePhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return { error: "Enter the phone number in full, e.g. 07700 900123." };
  const person = await prisma.person.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      phone,
      email: parsed.data.email || null,
      kind: parsed.data.kind,
      organisation: parsed.data.organisation || null,
    },
  });
  await syncPerson(person);
  await recordAudit(user, { action: "person.add", summary: `Added ${person.name} to People` });
  revalidatePath("/people");
  return { ok: `${person.name} added.` };
}

export async function removePersonAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const person = await prisma.person.findFirst({ where: { id: String(formData.get("id") ?? ""), organizationId: user.organizationId } });
  if (!person) return;
  await prisma.person.delete({ where: { id: person.id } });
  await forgetPerson(user.organizationId, person.id);
  // A carer's sign-in stops working with them.
  await prisma.user.updateMany({ where: { organizationId: user.organizationId, personId: person.id, role: "CARER" }, data: { sessionVersion: { increment: 1 }, lockedUntil: new Date("2999-01-01") } });
  await recordAudit(user, { action: "person.remove", summary: `Removed ${person.name} from People` });
  revalidatePath("/people");
}
