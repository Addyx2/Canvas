"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { signEmbedToken } from "@/lib/embed-token";
import { findModule } from "@/lib/modules";
import { authSecret } from "@/lib/secret";
import { appUrl } from "@/lib/utils";
import { emitEvent } from "@/lib/webhooks";

async function owned(organizationId: string, id: string) {
  return prisma.installation.findFirst({ where: { id, organizationId }, include: { platform: true } });
}

export async function setInstallationStatusAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const installation = await owned(user.organizationId, String(formData.get("id") ?? ""));
  const status = formData.get("status") === "ACTIVE" ? "ACTIVE" : "PAUSED";
  if (!installation || installation.status === "UNINSTALLED") return;
  await prisma.installation.update({ where: { id: installation.id }, data: { status } });
  await recordAudit(user, {
    action: "installation.status",
    summary: `${status === "ACTIVE" ? "Resumed" : "Paused"} ${installation.moduleKey} for ${installation.tenantName}`,
  });
  revalidatePath("/installations");
}

/** Open the module screen exactly as the platform would show it. */
export async function previewInstallationAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const installation = await owned(user.organizationId, String(formData.get("id") ?? ""));
  const mod = installation ? findModule(installation.moduleKey) : undefined;
  if (!installation || !mod) return;
  const token = await signEmbedToken(
    { ins: installation.id, mod: mod.key, sub: user.id, name: user.name, origins: [new URL(appUrl()).origin] },
    authSecret(),
  );
  redirect(`${mod.embedPath}?token=${encodeURIComponent(token)}`);
}

/** Send a sample event to the platform's webhook to check the connection. */
export async function sendTestEventAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const installation = await owned(user.organizationId, String(formData.get("id") ?? ""));
  if (!installation || installation.status !== "ACTIVE") return;
  await emitEvent(installation.id, `${installation.moduleKey}.test`, {
    message: "Test event from Aultrum Canvas",
    sentBy: user.name,
  });
  await recordAudit(user, { action: "event.test", summary: `Sent a test event to ${installation.platform.name}` });
  revalidatePath("/installations");
  revalidatePath("/events");
}
