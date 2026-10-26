import { z } from "zod";

import { authorizeEmbed, embedDenied, embedJson, isManager } from "@/lib/embed-auth";
import { prisma } from "@/lib/db";
import { addEntry } from "@/lib/peak/ledger";
import { readPeakSettings } from "@/lib/peak/settings";

export const dynamic = "force-dynamic";

const schema = z.object({
  memberId: z.string().min(1),
  /** Praise uses the installation's praise points; an award gives a set number. */
  kind: z.enum(["PRAISE", "AWARD"]),
  points: z.coerce.number().int().min(1).max(1000).optional(),
  reason: z.string().trim().min(2, "Say what it's for").max(200),
});

/** A manager praises someone or gives bonus points. */
export async function POST(request: Request) {
  const ctx = await authorizeEmbed(request, "peak");
  if (!ctx) return embedDenied();
  if (!isManager(ctx.claims)) return embedJson(ctx, { error: "Only managers can give points." }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return embedJson(ctx, { error: parsed.error.issues[0]?.message ?? "Check the details" }, 400);
  const member = await prisma.peakMember.findFirst({ where: { id: parsed.data.memberId, installationId: ctx.installation.id } });
  if (!member) return embedJson(ctx, { error: "That person isn't in Peak yet." }, 404);

  const settings = readPeakSettings(ctx.installation.settings);
  const points = parsed.data.kind === "PRAISE" ? settings.praise : parsed.data.points;
  if (!points) return embedJson(ctx, { error: "Enter how many points" }, 400);
  await addEntry({
    installationId: ctx.installation.id,
    memberId: member.id,
    kind: parsed.data.kind,
    points,
    reason: parsed.data.kind === "PRAISE" ? `Praise from ${ctx.claims.name}: “${parsed.data.reason}”` : parsed.data.reason,
    byName: ctx.claims.name,
  });
  return embedJson(ctx, { ok: true, points });
}
