import { z } from "zod";

import { prisma } from "@/lib/db";
import { authorizeEmbed, embedDenied, embedJson, isManager } from "@/lib/embed-auth";
import { cashOuts, cashOutsCsv, markPaid } from "@/lib/peak/cashouts";

export const dynamic = "force-dynamic";

/** Cash-outs still to pay (with a CSV for payroll), and those recently paid. Managers only. */
export async function GET(request: Request) {
  const ctx = await authorizeEmbed(request, "peak");
  if (!ctx) return embedDenied();
  if (!isManager(ctx.claims)) return embedJson(ctx, { error: "Only managers can see cash-outs." }, 403);
  const { id, organizationId } = ctx.installation;
  const [unpaid, paid] = await Promise.all([cashOuts(id, organizationId, "unpaid"), cashOuts(id, organizationId, "paid")]);
  return embedJson(ctx, {
    unpaid,
    paid,
    totalPence: unpaid.reduce((n, r) => n + r.amountPence, 0),
    csv: cashOutsCsv(unpaid),
  });
}

const schema = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) });

/** Mark cash-outs as paid once they have gone through payroll. */
export async function POST(request: Request) {
  const ctx = await authorizeEmbed(request, "peak");
  if (!ctx) return embedDenied();
  if (!isManager(ctx.claims)) return embedJson(ctx, { error: "Only managers can mark cash-outs paid." }, 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return embedJson(ctx, { error: "Choose which cash-outs were paid." }, 400);
  const count = await markPaid(ctx.installation.id, parsed.data.ids, ctx.claims.name);
  await prisma.auditEvent
    .create({ data: { organizationId: ctx.installation.organizationId, action: "peak.cashouts_paid", summary: `${ctx.claims.name} marked ${count} Peak cash-out${count === 1 ? "" : "s"} as paid` } })
    .catch(() => undefined);
  return embedJson(ctx, { ok: true, count });
}
