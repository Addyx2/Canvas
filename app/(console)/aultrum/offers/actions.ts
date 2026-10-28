"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OFFER_CATEGORIES } from "@/lib/peak/badges";
import { isAultrumStaff } from "@/lib/staff";

export interface OfferFormState {
  ok?: string;
  error?: string;
}

async function requireStaff() {
  const user = await requireUser();
  if (!(await isAultrumStaff(user))) redirect("/dashboard");
  return user;
}

const schema = z.object({
  partner: z.string().trim().min(2, "Name the partner").max(80),
  title: z.string().trim().min(2, "Give the offer a title").max(120),
  headline: z.string().trim().min(1, "Say what they get, e.g. 20% off").max(30),
  description: z.string().trim().max(400),
  category: z.enum(OFFER_CATEGORIES),
  code: z.string().trim().max(60),
  url: z.string().trim().max(400).refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "The link must start with https://"),
  expiresAt: z.string().trim().refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Check the end date"),
});

export async function addOfferAction(_prev: OfferFormState, formData: FormData): Promise<OfferFormState> {
  const user = await requireStaff();
  const parsed = schema.safeParse(Object.fromEntries(["partner", "title", "headline", "description", "category", "code", "url", "expiresAt"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  const d = parsed.data;
  if (!d.code && !d.url) return { error: "Add a code, a link, or both, so carers can use the offer." };
  await prisma.partnerOffer.create({
    data: {
      partner: d.partner,
      title: d.title,
      headline: d.headline,
      description: d.description,
      category: d.category,
      code: d.code || null,
      url: d.url || null,
      expiresAt: d.expiresAt ? new Date(`${d.expiresAt}T23:59:59Z`) : null,
    },
  });
  await recordAudit(user, { action: "offer.add", summary: `Added partner offer: ${d.partner}, ${d.title}` });
  revalidatePath("/aultrum/offers");
  return { ok: `${d.title} is live for every carer on Peak.` };
}

export async function toggleOfferAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const offer = await prisma.partnerOffer.findUnique({ where: { id: String(formData.get("id") ?? "") } });
  if (!offer) return;
  await prisma.partnerOffer.update({ where: { id: offer.id }, data: { active: !offer.active } });
  await recordAudit(user, { action: "offer.toggle", summary: `${offer.active ? "Paused" : "Resumed"} partner offer: ${offer.title}` });
  revalidatePath("/aultrum/offers");
}
