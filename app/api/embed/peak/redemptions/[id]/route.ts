import { z } from "zod";

import { authorizeEmbed, embedDenied, embedJson, isManager } from "@/lib/embed-auth";
import { decideRedemption, PeakError } from "@/lib/peak/ledger";

export const dynamic = "force-dynamic";

const schema = z.object({ decision: z.enum(["approve", "decline"]), note: z.string().trim().max(200).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authorizeEmbed(request, "peak");
  if (!ctx) return embedDenied();
  if (!isManager(ctx.claims)) return embedJson(ctx, { error: "Only managers can decide rewards." }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return embedJson(ctx, { error: "Approve or decline" }, 400);
  const { id } = await params;
  try {
    await decideRedemption(ctx.installation.id, id, parsed.data.decision === "approve", ctx.claims.name, parsed.data.note);
    return embedJson(ctx, { ok: true });
  } catch (error) {
    if (error instanceof PeakError) return embedJson(ctx, { error: error.message }, 409);
    throw error;
  }
}
