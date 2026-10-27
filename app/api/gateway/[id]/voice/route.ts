import { prisma } from "@/lib/db";
import { verifiedTwilio } from "@/lib/gateway/channel";
import { findCaller, normalisePhone } from "@/lib/gateway/directory";
import { readGatewaySettings, serviceNameOf } from "@/lib/gateway/settings";
import { twiml } from "@/lib/gateway/twilio";
import { gather, say } from "@/lib/gateway/voice";

export const dynamic = "force-dynamic";

/** Twilio calls this when someone rings the installation's number: greet them and listen. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const verified = await verifiedTwilio(request, id);
  if (!verified) return new Response("Forbidden", { status: 403 });
  const { installation, params: form } = verified;
  const from = form.From ?? "unknown";
  const caller = await findCaller(installation.id, normalisePhone(from));
  const conversation = await prisma.gatewayConversation.create({
    data: { installationId: installation.id, channel: "VOICE", contact: from, contactName: caller?.name ?? null, personId: caller?.personId ?? null },
  });
  const service = serviceNameOf(readGatewaySettings(installation.settings), installation.tenantName);
  const greeting = `Hello${caller ? ` ${caller.name.split(" ")[0]}` : ""}, you're through to ${service}. How can I help?`;
  await prisma.gatewayMessage.create({ data: { conversationId: conversation.id, sender: "AGENT", body: greeting } });
  return twiml(`${gather(installation, conversation.id, greeting)}${say("Sorry, I didn't catch that.")}${gather(installation, conversation.id, "How can I help?")}<Hangup/>`);
}
