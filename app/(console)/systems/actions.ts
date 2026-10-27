"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { hashSecret, newClientId, newSecret, parseOrigins } from "@/lib/credentials";
import { prisma } from "@/lib/db";

export interface PlatformFormState {
  error?: string;
  /** Shown once: the client ID and secrets for a new or rotated platform. */
  credentials?: { clientId: string; clientSecret: string; webhookSecret: string };
  /** Set when a system was connected by its public key: nothing to copy. */
  connected?: string;
}

const fields = z.object({
  name: z.string().trim().min(2, "Name the system").max(80),
  webhookUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\//.test(v) || /^http:\/\/localhost(:\d+)?\//.test(v), "The webhook URL must use https")
    .transform((v) => v || null),
  allowedOrigins: z.string().max(2000),
});

function parse(formData: FormData) {
  const parsed = fields.safeParse({
    name: formData.get("name") ?? "",
    webhookUrl: formData.get("webhookUrl") ?? "",
    allowedOrigins: formData.get("allowedOrigins") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" } as const;
  const { origins, invalid } = parseOrigins(parsed.data.allowedOrigins);
  if (invalid.length) return { error: `Not a valid https origin: ${invalid.join(", ")}` } as const;
  return { data: { ...parsed.data, allowedOrigins: origins } } as const;
}

export async function createPlatformAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const user = await requireAdmin();
  const result = parse(formData);
  if ("error" in result) return { error: result.error };
  const clientId = newClientId();
  const clientSecret = newSecret("cvs");
  const webhookSecret = newSecret("whsec");
  await prisma.platform.create({
    data: {
      organizationId: user.organizationId,
      ...result.data,
      clientId,
      secretHash: hashSecret(clientSecret),
      webhookSecret,
    },
  });
  await recordAudit(user, { action: "platform.created", summary: `Connected platform ${result.data.name}` });
  revalidatePath("/systems");
  return { credentials: { clientId, clientSecret, webhookSecret } };
}

async function ownedPlatform(organizationId: string, id: string) {
  return prisma.platform.findFirst({ where: { id, organizationId } });
}

export async function updatePlatformAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const user = await requireAdmin();
  const platform = await ownedPlatform(user.organizationId, String(formData.get("id") ?? ""));
  if (!platform) return { error: "Platform not found" };
  const result = parse(formData);
  if ("error" in result) return { error: result.error };
  await prisma.platform.update({ where: { id: platform.id }, data: result.data });
  await recordAudit(user, { action: "platform.updated", summary: `Updated platform ${result.data.name}` });
  revalidatePath("/systems");
  return {};
}

export async function rotateSecretsAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const user = await requireAdmin();
  const platform = await ownedPlatform(user.organizationId, String(formData.get("id") ?? ""));
  if (!platform || platform.revokedAt) return { error: "Platform not found" };
  const clientSecret = newSecret("cvs");
  const webhookSecret = newSecret("whsec");
  await prisma.platform.update({
    where: { id: platform.id },
    data: { secretHash: hashSecret(clientSecret), webhookSecret },
  });
  await recordAudit(user, { action: "platform.rotated", summary: `Rotated secrets for ${platform.name}` });
  revalidatePath("/systems");
  return { credentials: { clientId: platform.clientId, clientSecret, webhookSecret } };
}

export async function revokePlatformAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const platform = await ownedPlatform(user.organizationId, String(formData.get("id") ?? ""));
  if (!platform || platform.revokedAt) return;
  await prisma.platform.update({ where: { id: platform.id }, data: { revokedAt: new Date() } });
  await recordAudit(user, { action: "platform.revoked", summary: `Revoked platform ${platform.name}` });
  revalidatePath("/systems");
}

const keyFields = z.object({
  name: z.string().trim().min(2, "Name the system").max(80),
  jwksUri: z
    .string()
    .trim()
    .max(500)
    .refine((v) => /^https:\/\/[^/]+\/.+/.test(v) || /^http:\/\/localhost(:\d+)?\/.+/.test(v), "The key address must be an https URL"),
});

/**
 * Connect a system by the address of its public key, e.g. Pleasant's
 * https://pleasant.aultrum.co.uk/.well-known/jwks.json. Nothing secret is
 * exchanged: the system signs its requests and Canvas signs its webhooks.
 */
export async function connectByKeyAction(_prev: PlatformFormState, formData: FormData): Promise<PlatformFormState> {
  const user = await requireAdmin();
  const parsed = keyFields.safeParse({ name: formData.get("name") ?? "", jwksUri: formData.get("jwksUri") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  const origin = new URL(parsed.data.jwksUri).origin;
  const clientId = new URL(origin).host;
  if (await prisma.platform.findUnique({ where: { clientId } })) return { error: `${clientId} is already connected.` };
  await prisma.platform.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      clientId,
      jwksUri: parsed.data.jwksUri,
      // Unused for key-based systems; kept random so no secret can ever match.
      secretHash: hashSecret(newSecret("unused")),
      webhookSecret: newSecret("unused"),
      webhookUrl: `${origin}/api/webhooks/elements`,
      allowedOrigins: [origin],
    },
  });
  await recordAudit(user, { action: "platform.created", summary: `Connected ${parsed.data.name} by its public key` });
  revalidatePath("/systems");
  return { connected: parsed.data.name };
}
