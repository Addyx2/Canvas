import { z } from "zod";

import { authorizeEmbed, embedDenied, embedJson, isManager } from "@/lib/embed-auth";
import { memberFor, PeakError, requestRedemption } from "@/lib/peak/ledger";

export const dynamic = "force-dynamic";

/** A carer asks for a reward; a manager then approves or declines it. */
export async function POST(request: Request) {
  const ctx = await authorizeEmbed(request, "peak");
  if (!ctx) return embedDenied();
  if (isManager(ctx.claims) || !ctx.claims.person) return embedJson(ctx, { error: "Rewards are requested from a carer's own Peak screen." }, 403);
  const parsed = z.object({ rewardId: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return embedJson(ctx, { error: "Choose a reward" }, 400);
  const member = await memberFor(ctx.installation.id, ctx.claims.person, ctx.claims.name);
  try {
    const redemption = await requestRedemption(ctx.installation.id, member.id, parsed.data.rewardId);
    return embedJson(ctx, { ok: true, redemptionId: redemption.id });
  } catch (error) {
    if (error instanceof PeakError) return embedJson(ctx, { error: error.message }, 409);
    // A serialisation conflict means another request spent the points at the same moment.
    console.error("peak redemption failed", error);
    return embedJson(ctx, { error: "That didn't go through. Please try again." }, 409);
  }
}
