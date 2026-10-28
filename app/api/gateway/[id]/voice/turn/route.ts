import { after } from "next/server";

import { verifiedTwilio } from "@/lib/gateway/channel";
import { receiveMessage } from "@/lib/gateway/conversations";
import { twiml } from "@/lib/gateway/twilio";
import { gather, holdOn, respond } from "@/lib/gateway/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Twilio drops a call if a webhook takes more than 15 seconds. A turn that is
 * still thinking after this long hands the caller to the wait endpoint and
 * carries on in the background.
 */
const ANSWER_WITHIN_MS = 8000;

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

  const work = receiveMessage({ installation, channel: "VOICE", contact: form.From ?? "unknown", text: speech, conversationId });
  const outcome = await Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), ANSWER_WITHIN_MS))]);
  if (!outcome) {
    after(() => work.then(() => undefined, (error) => console.error("gateway voice turn failed", error)));
    return holdOn(installation, conversationId, 1, "One moment.");
  }
  return respond(installation, outcome.conversation, outcome.reply);
}
