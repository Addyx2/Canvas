import { prisma } from "../db";

/** Normalise a UK or international number to E.164, or null when it isn't one. */
export function normalisePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("0")) digits = `+44${digits.slice(1)}`;
  if (!digits.startsWith("+")) digits = `+${digits}`;
  return /^\+\d{8,15}$/.test(digits) ? digits : null;
}

function text(value: unknown, max = 200): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

/** Keep Gateway's directory in step with the platform's people. */
export async function applyDirectoryEvent(installationId: string, type: string, data: Record<string, unknown>) {
  const personId = text(data.personId);
  if (!personId) return { ignored: "No personId" };
  if (type === "platform.person.removed") {
    await prisma.gatewayPerson.deleteMany({ where: { installationId, personId } });
    return { removed: true };
  }
  const name = text(data.name) ?? personId;
  const fields = {
    name,
    phone: normalisePhone(data.phone),
    kind: text(data.kind, 40) ?? "carer",
    organisation: text(data.organisation) ?? null,
  };
  await prisma.gatewayPerson.upsert({
    where: { installationId_personId: { installationId, personId } },
    create: { installationId, personId, ...fields },
    update: fields,
  });
  return { saved: true };
}

export async function findCaller(installationId: string, phone: string | null) {
  if (!phone) return null;
  return prisma.gatewayPerson.findFirst({ where: { installationId, phone }, orderBy: { updatedAt: "desc" } });
}
