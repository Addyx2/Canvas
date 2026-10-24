import type { Prisma } from "@prisma/client";

import { prisma } from "./db";
import { SIGNATURE_HEADER, signWebhook } from "./webhook-signature";

/**
 * Record an event a module sends to its platform and try to deliver it now.
 * Failed deliveries stay in the event log with the error, ready to retry.
 */
export async function emitEvent(installationId: string, type: string, payload: Prisma.InputJsonValue) {
  const event = await prisma.event.create({
    data: { installationId, direction: "OUTBOUND", type, payload, deliveryStatus: "PENDING" },
  });
  return deliverEvent(event.id);
}

export async function deliverEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { installation: { include: { platform: true } } },
  });
  if (!event || event.direction !== "OUTBOUND") return null;
  const { installation } = event;
  const platform = installation.platform;

  if (!platform.webhookUrl || platform.revokedAt) {
    return prisma.event.update({
      where: { id: event.id },
      data: { deliveryStatus: "SKIPPED", lastError: platform.revokedAt ? "Platform revoked" : "No webhook URL set" },
    });
  }

  const body = JSON.stringify({
    id: event.id,
    type: event.type,
    createdAt: event.createdAt.toISOString(),
    installation: { id: installation.id, module: installation.moduleKey, tenantId: installation.tenantId },
    data: event.payload,
  });

  let status = "FAILED";
  let error: string | null = null;
  try {
    const res = await fetch(platform.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", [SIGNATURE_HEADER]: signWebhook(body, platform.webhookSecret) },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) status = "DELIVERED";
    else error = `Platform answered ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : "Delivery failed";
  }

  return prisma.event.update({
    where: { id: event.id },
    data: {
      deliveryStatus: status,
      attempts: { increment: 1 },
      lastError: error,
      deliveredAt: status === "DELIVERED" ? new Date() : null,
    },
  });
}
