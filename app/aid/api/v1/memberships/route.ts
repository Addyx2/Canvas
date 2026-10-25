import { json, membershipRemovalSchema, membershipSchema, productClient } from "@/lib/aultrum-id/product-api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// PUT: this person belongs to this organisation in the product (create or update).
export async function PUT(request: Request) {
  const client = await productClient(request);
  if (!client) return json(401, { error: "Unknown client or wrong secret" });
  const parsed = membershipSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(422, { error: "Invalid membership", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  const { sub, orgId, orgName, role } = parsed.data;
  if (!(await prisma.identity.findUnique({ where: { id: sub }, select: { id: true } }))) return json(404, { error: "Unknown Aultrum ID" });
  const membership = await prisma.platformMembership.upsert({
    where: { clientId_identityId_orgId: { clientId: client.id, identityId: sub, orgId } },
    create: { clientId: client.id, identityId: sub, orgId, orgName, role },
    update: { orgName, role, lastSeenAt: new Date() },
  });
  return json(200, { id: membership.id });
}

// DELETE: they no longer have access (e.g. removed from the agency).
export async function DELETE(request: Request) {
  const client = await productClient(request);
  if (!client) return json(401, { error: "Unknown client or wrong secret" });
  const parsed = membershipRemovalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(422, { error: "Invalid request" });
  const { count } = await prisma.platformMembership.deleteMany({
    where: { clientId: client.id, identityId: parsed.data.sub, orgId: parsed.data.orgId },
  });
  return json(200, { removed: count });
}
