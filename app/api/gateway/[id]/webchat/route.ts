import { z } from "zod";

import { prisma } from "@/lib/db";
import { activeGateway } from "@/lib/gateway/channel";
import { receiveMessage } from "@/lib/gateway/conversations";
import { readGatewaySettings } from "@/lib/gateway/settings";
import { allow, ipFrom, LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The public web chat on a provider's website. A visitor is a random key the
// widget keeps in the browser; it only ever sees its own conversation.
const visitor = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

async function chatInstallation(id: string) {
  const installation = await activeGateway(id);
  if (!installation || !readGatewaySettings(installation.settings).webchat) return null;
  return installation;
}

async function transcript(installationId: string, key: string) {
  const conversation = await prisma.gatewayConversation.findFirst({
    where: { installationId, channel: "WEBCHAT", contact: `web:${key}` },
    orderBy: { lastMessageAt: "desc" },
    include: { messages: { where: { sender: { not: "SYSTEM" } }, orderBy: { createdAt: "asc" }, take: 100 } },
  });
  if (!conversation) return { status: null, messages: [] };
  return {
    status: conversation.status,
    messages: conversation.messages.map((m) => ({ id: m.id, from: m.sender === "CONTACT" ? "you" : m.sender === "STAFF" ? "staff" : "agent", name: m.staffName, text: m.body, at: m.createdAt })),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const installation = await chatInstallation(id);
  if (!installation) return Response.json({ error: "Chat isn't available" }, { status: 404 });
  const key = visitor.safeParse(new URL(request.url).searchParams.get("visitor"));
  if (!key.success) return Response.json({ error: "Bad visitor" }, { status: 400 });
  return Response.json(await transcript(installation.id, key.data), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const installation = await chatInstallation(id);
  if (!installation) return Response.json({ error: "Chat isn't available" }, { status: 404 });
  // Each message costs an AI turn, so one visitor can't run up the bill.
  if (!(await allow(`webchat:${installation.id}:${ipFrom(request.headers)}`, LIMITS.webchat))) {
    return Response.json({ error: "You've sent a lot of messages. Please wait a few minutes." }, { status: 429 });
  }
  const body = z.object({ visitor, text: z.string().trim().min(1).max(2000), name: z.string().trim().max(100).optional() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Write a message" }, { status: 400 });
  await receiveMessage({ installation, channel: "WEBCHAT", contact: `web:${body.data.visitor}`, text: body.data.text, contactName: body.data.name });
  return Response.json(await transcript(installation.id, body.data.visitor), { headers: { "Cache-Control": "no-store" } });
}
