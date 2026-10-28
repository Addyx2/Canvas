import { authorizeEmbed, embedDenied, embedJson, isManager } from "@/lib/embed-auth";
import { prisma } from "@/lib/db";
import { memberFor } from "@/lib/peak/ledger";

export const dynamic = "force-dynamic";

/** A carer opens a partner offer: record it (for counts) and reveal the code. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authorizeEmbed(request, "peak");
  if (!ctx) return embedDenied();
  if (isManager(ctx.claims) || !ctx.claims.person) return embedJson(ctx, { error: "Offers are for carers on Peak." }, 403);
  const { id } = await params;
  const offer = await prisma.partnerOffer.findFirst({ where: { id, active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  if (!offer) return embedJson(ctx, { error: "That offer has ended." }, 404);
  const member = await memberFor(ctx.installation.id, ctx.claims.person, ctx.claims.name);
  await prisma.partnerOfferClaim.upsert({
    where: { offerId_memberId: { offerId: offer.id, memberId: member.id } },
    create: { offerId: offer.id, installationId: ctx.installation.id, memberId: member.id },
    update: {},
  });
  return embedJson(ctx, { ok: true, code: offer.code, url: offer.url });
}
