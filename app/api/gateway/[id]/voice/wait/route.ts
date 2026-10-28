import { prisma } from "@/lib/db";
import { verifiedTwilio } from "@/lib/gateway/channel";
import { holdOn, personNeeded, respond } from "@/lib/gateway/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const WAIT_MS = 9000;
const POLL_MS = 400;
/** After this many waits, stop and promise a call back rather than keep the caller hanging. */
const MAX_ATTEMPTS = 3;

/** Twilio comes here while a slow turn finishes; answer as soon as Gateway's reply is saved. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const verified = await verifiedTwilio(request, id);
  if (!verified) return new Response("Forbidden", { status: 403 });
  const { installation } = verified;
  const search = new URL(request.url).searchParams;
  const conversationId = search.get("c") ?? "";
  const attempt = Number(search.get("n") ?? "1") || 1;
  const conversation = await prisma.gatewayConversation.findFirst({ where: { id: conversationId, installationId: installation.id } });
  if (!conversation) return new Response("Not found", { status: 404 });

  const asked = await prisma.gatewayMessage.findFirst({ where: { conversationId, sender: "CONTACT" }, orderBy: { createdAt: "desc" } });
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const answer = await prisma.gatewayMessage.findFirst({
      where: { conversationId, sender: "AGENT", ...(asked ? { createdAt: { gt: asked.createdAt } } : {}) },
      orderBy: { createdAt: "desc" },
    });
    if (answer) {
      const fresh = await prisma.gatewayConversation.findUniqueOrThrow({ where: { id: conversationId } });
      return respond(installation, fresh, answer.body);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  if (attempt < MAX_ATTEMPTS) return holdOn(installation, conversationId, attempt + 1, "Bear with me, I'm still on it.");
  // Something is badly wrong: make sure a person follows up, and don't leave the caller in silence.
  const flagged = await prisma.gatewayConversation.update({
    where: { id: conversationId },
    data: { status: "NEEDS_PERSON", handoverReason: "Gateway couldn't answer in time", followUp: true, followUpDoneAt: null },
  });
  return personNeeded(installation, flagged, "Sorry for the wait.");
}
