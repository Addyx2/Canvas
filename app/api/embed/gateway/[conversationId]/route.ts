import { z } from "zod";

import { prisma } from "@/lib/db";
import { authorizeEmbed, embedDenied, embedJson, isManager } from "@/lib/embed-auth";
import { GatewayError, handBack, markFollowedUp, staffClose, staffReply, takeOver } from "@/lib/gateway/conversations";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const ctx = await authorizeEmbed(request, "gateway");
  if (!ctx) return embedDenied();
  if (!isManager(ctx.claims)) return embedJson(ctx, { error: "Gateway's inbox is for staff." }, 403);
  const { conversationId } = await params;
  const c = await prisma.gatewayConversation.findFirst({
    where: { id: conversationId, installationId: ctx.installation.id },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 300 } },
  });
  if (!c) return embedJson(ctx, { error: "That conversation no longer exists." }, 404);
  return embedJson(ctx, {
    conversation: {
      id: c.id,
      channel: c.channel,
      contact: c.channel === "WEBCHAT" ? "Web chat visitor" : c.contact,
      contactName: c.contactName,
      intent: c.intent,
      status: c.status,
      summary: c.summary,
      handoverReason: c.handoverReason,
      staffName: c.staffName,
      followUp: c.followUp && !c.followUpDoneAt,
      createdAt: c.createdAt,
      messages: c.messages.map((m) => ({ id: m.id, sender: m.sender, body: m.body, staffName: m.staffName, createdAt: m.createdAt })),
    },
  });
}

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), text: z.string().trim().min(1, "Write a reply first").max(1500) }),
  z.object({ action: z.literal("take_over") }),
  z.object({ action: z.literal("hand_back") }),
  z.object({ action: z.literal("close"), summary: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("followed_up") }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const ctx = await authorizeEmbed(request, "gateway");
  if (!ctx) return embedDenied();
  if (!isManager(ctx.claims)) return embedJson(ctx, { error: "Gateway's inbox is for staff." }, 403);
  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return embedJson(ctx, { error: parsed.error.issues[0]?.message ?? "Unknown action" }, 400);
  const { conversationId } = await params;
  const staff = ctx.claims.name;
  try {
    const a = parsed.data;
    if (a.action === "reply") await staffReply(ctx.installation, conversationId, staff, a.text);
    else if (a.action === "take_over") await takeOver(ctx.installation, conversationId, staff);
    else if (a.action === "hand_back") await handBack(ctx.installation, conversationId, staff);
    else if (a.action === "followed_up") await markFollowedUp(ctx.installation, conversationId, staff);
    else await staffClose(ctx.installation, conversationId, staff, a.summary);
    return embedJson(ctx, { ok: true });
  } catch (error) {
    if (error instanceof GatewayError) return embedJson(ctx, { error: error.message }, 409);
    console.error("gateway staff action failed", error);
    return embedJson(ctx, { error: "That didn't go through. Please try again." }, 502);
  }
}
