import { activitySchema, json, productClient } from "@/lib/aultrum-id/product-api";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST: summaries about an organisation, shown in Workspace to its members.
// Items are keyed by the product's own id, so resending updates them.
export async function POST(request: Request) {
  const client = await productClient(request);
  if (!client) return json(401, { error: "Unknown client or wrong secret" });
  const parsed = activitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(422, { error: "Invalid activity", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  const { orgId, items } = parsed.data;
  // Links must point back into the product itself.
  const origins = new Set(client.redirectUris.map((u) => new URL(u).origin));
  const offsite = items.find((i) => i.url && !origins.has(new URL(i.url).origin));
  if (offsite) return json(422, { error: `Item ${offsite.id}: url must be on the product's own address` });
  await prisma.$transaction(
    items.map((item) =>
      prisma.activityItem.upsert({
        where: { clientId_orgId_externalId: { clientId: client.id, orgId, externalId: item.id } },
        create: { clientId: client.id, orgId, externalId: item.id, kind: item.kind, title: item.title, detail: item.detail, url: item.url, roles: item.roles ?? [], occurredAt: item.occurredAt },
        update: { kind: item.kind, title: item.title, detail: item.detail ?? null, url: item.url ?? null, roles: item.roles ?? [], occurredAt: item.occurredAt },
      }),
    ),
  );
  return json(200, { saved: items.length });
}
