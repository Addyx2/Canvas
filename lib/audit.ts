import { prisma } from "./db";

export async function recordAudit(
  user: { id: string; organizationId: string },
  entry: { action: string; summary: string },
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: { organizationId: user.organizationId, userId: user.id, action: entry.action, summary: entry.summary },
    });
  } catch (error) {
    // Never block the action itself on the audit write.
    console.error("audit write failed", entry.action, error);
  }
}
