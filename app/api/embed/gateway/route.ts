import { prisma } from "@/lib/db";
import { authorizeEmbed, embedDenied, embedJson, isManager } from "@/lib/embed-auth";
import { readGatewaySettings, twilioCredentials } from "@/lib/gateway/settings";

export const dynamic = "force-dynamic";

const ORDER = { NEEDS_PERSON: 0, WITH_PERSON: 1, WITH_AI: 2, CLOSED: 3 } as const;

/** The staff inbox: conversations needing a person first, then live ones, then recent closed ones. */
export async function GET(request: Request) {
  const ctx = await authorizeEmbed(request, "gateway");
  if (!ctx) return embedDenied();
  if (!isManager(ctx.claims)) return embedJson(ctx, { error: "Gateway's inbox is for staff." }, 403);
  const { installation } = ctx;
  const [open, closed] = await Promise.all([
    prisma.gatewayConversation.findMany({
      where: { installationId: installation.id, status: { not: "CLOSED" } },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.gatewayConversation.findMany({
      where: { installationId: installation.id, status: "CLOSED", lastMessageAt: { gt: new Date(Date.now() - 7 * 86400_000) } },
      orderBy: { lastMessageAt: "desc" },
      take: 30,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);
  const conversations = [...open, ...closed]
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
    .map((c) => ({
      id: c.id,
      channel: c.channel,
      contact: c.channel === "WEBCHAT" ? "Web chat visitor" : c.contact,
      contactName: c.contactName,
      intent: c.intent,
      status: c.status,
      summary: c.summary,
      handoverReason: c.handoverReason,
      staffName: c.staffName,
      lastMessageAt: c.lastMessageAt,
      preview: c.messages[0]?.body.slice(0, 140) ?? "",
    }));
  const settings = readGatewaySettings(installation.settings);
  return embedJson(ctx, {
    tenantName: installation.tenantName,
    conversations,
    channels: { webchat: settings.webchat, phone: (await twilioCredentials(settings))?.phoneNumber ?? null },
  });
}
