import { z } from "zod";

import { authorizeEmbed, embedDenied, embedJson, isManager } from "@/lib/embed-auth";
import { prisma } from "@/lib/db";
import { badgeType } from "@/lib/peak/badges";
import { addEntry } from "@/lib/peak/ledger";

export const dynamic = "force-dynamic";

const schema = z.object({
  memberId: z.string().min(1),
  badge: z.string().min(1),
  note: z.string().trim().min(2, "Say what it's for").max(280),
  points: z.coerce.number().int().min(0).max(1000).default(0),
});

/** A manager recognises someone with a badge, and optionally bonus points. */
export async function POST(request: Request) {
  const ctx = await authorizeEmbed(request, "peak");
  if (!ctx) return embedDenied();
  if (!isManager(ctx.claims)) return embedJson(ctx, { error: "Only managers can give badges." }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return embedJson(ctx, { error: parsed.error.issues[0]?.message ?? "Check the details" }, 400);
  const type = badgeType(parsed.data.badge);
  if (!type) return embedJson(ctx, { error: "Choose a badge." }, 400);
  const member = await prisma.peakMember.findFirst({ where: { id: parsed.data.memberId, installationId: ctx.installation.id } });
  if (!member) return embedJson(ctx, { error: "That person isn't in Peak yet." }, 404);

  const { note, points } = parsed.data;
  await prisma.peakBadge.create({
    data: { installationId: ctx.installation.id, memberId: member.id, badge: type.key, note, byName: ctx.claims.name, points },
  });
  if (points > 0) {
    await addEntry({ installationId: ctx.installation.id, memberId: member.id, kind: "AWARD", points, reason: `${type.name} badge from ${ctx.claims.name}: “${note}”`, byName: ctx.claims.name });
  }
  return embedJson(ctx, { ok: true });
}
