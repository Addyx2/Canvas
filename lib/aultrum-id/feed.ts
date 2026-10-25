import { prisma } from "@/lib/db";

/** Activity from every organisation this person belongs to, newest first. */
export async function activityFor(identityId: string, take = 30) {
  const memberships = await prisma.platformMembership.findMany({
    where: { identityId },
    include: { client: { select: { id: true, name: true, product: true } } },
  });
  if (memberships.length === 0) return { memberships, items: [] };
  // Each item is visible to everyone in its organisation, or only the roles it names.
  const items = await prisma.activityItem.findMany({
    where: {
      OR: memberships.map((m) => ({
        clientId: m.clientId,
        orgId: m.orgId,
        OR: [{ roles: { isEmpty: true } }, { roles: { has: m.role } }],
      })),
    },
    orderBy: { occurredAt: "desc" },
    take,
  });
  const label = (clientId: string, orgId: string) => {
    const m = memberships.find((x) => x.clientId === clientId && x.orgId === orgId);
    return m ? `${m.client.name} · ${m.orgName}` : "";
  };
  return { memberships, items: items.map((i) => ({ ...i, source: label(i.clientId, i.orgId) })) };
}
