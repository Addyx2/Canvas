import { chargeAllowance } from "@/lib/allowance";
import { prisma } from "@/lib/db";
import { verifiedTwilio } from "@/lib/gateway/channel";
import { findCaller, normalisePhone } from "@/lib/gateway/directory";
import { chargeNumberThisMonth, orgOf } from "@/lib/gateway/number";
import { readGatewaySettings, serviceNameOf } from "@/lib/gateway/settings";
import { twiml } from "@/lib/gateway/twilio";
import { gather, say } from "@/lib/gateway/voice";

export const dynamic = "force-dynamic";

/** Twilio calls this when someone rings the installation's number: greet them and listen. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const verified = await verifiedTwilio(request, id);
  if (!verified) return new Response("Forbidden", { status: 403 });
  const { installation, params: form, creds } = verified;
  const from = form.From ?? "unknown";
  const caller = await findCaller(installation.id, normalisePhone(from));
  const service = serviceNameOf(readGatewaySettings(installation.settings), installation.tenantName);
  if (creds.aultrum) await chargeNumberThisMonth(installation);
  // Calls are paid by the minute from the Allowance; with no credits, the call is noted for the team to return.
  const paid = await chargeAllowance(await orgOf(installation), "call_minute", 1, `call:${form.CallSid ?? crypto.randomUUID()}:0`);
  if (!paid.ok) {
    await prisma.gatewayConversation.create({
      data: { installationId: installation.id, channel: "VOICE", contact: from, contactName: caller?.name ?? null, personId: caller?.personId ?? null, status: "NEEDS_PERSON", handoverReason: "Missed call: Gateway is paused because the Allowance has run out of credits. Please call back." },
    });
    return twiml(`${say(`Thank you for calling ${service}. We can't take your call right now. A member of the team will call you back.`)}<Hangup/>`);
  }
  const conversation = await prisma.gatewayConversation.create({
    data: { installationId: installation.id, channel: "VOICE", contact: from, contactName: caller?.name ?? null, personId: caller?.personId ?? null },
  });
  const greeting = `Hello${caller ? ` ${caller.name.split(" ")[0]}` : ""}, you're through to ${service}. How can I help?`;
  await prisma.gatewayMessage.create({ data: { conversationId: conversation.id, sender: "AGENT", body: greeting } });
  return twiml(`${gather(installation, conversation.id, greeting)}${say("Sorry, I didn't catch that.")}${gather(installation, conversation.id, "How can I help?")}<Hangup/>`);
}
