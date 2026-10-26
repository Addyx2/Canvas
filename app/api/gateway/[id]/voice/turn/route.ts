import { verifiedTwilio } from "@/lib/gateway/channel";
import { receiveMessage } from "@/lib/gateway/conversations";
import { twiml } from "@/lib/gateway/twilio";
import { gather, personNeeded, say } from "@/lib/gateway/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Each thing the caller says: answer it, then listen again, put them through, or end the call. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const verified = await verifiedTwilio(request, id);
  if (!verified) return new Response("Forbidden", { status: 403 });
  const { installation, params: form } = verified;
  const conversationId = new URL(request.url).searchParams.get("c") ?? undefined;
  const speech = (form.SpeechResult ?? "").trim();
  if (!speech || !conversationId) {
    return twiml(`${conversationId ? gather(installation, conversationId, "Sorry, I didn't catch that. Could you say it again?") : ""}<Hangup/>`);
  }

  const { conversation, reply } = await receiveMessage({ installation, channel: "VOICE", contact: form.From ?? "unknown", text: speech, conversationId });
  if (conversation.status === "NEEDS_PERSON" || conversation.status === "WITH_PERSON") return personNeeded(installation, conversation, reply);
  if (conversation.status === "CLOSED") return twiml(`${say(reply ?? "Thank you for calling. Goodbye.")}<Hangup/>`);
  return twiml(`${gather(installation, conversation.id, reply ?? "Is there anything else?")}${say("Thank you for calling. Goodbye.")}<Hangup/>`);
}
