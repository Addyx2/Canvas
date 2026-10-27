import type { GatewayConversation, Installation } from "@prisma/client";

import { appUrl } from "../utils";
import { readGatewaySettings } from "./settings";
import { escapeXml, twiml } from "./twilio";

const VOICE = 'voice="Polly.Amy-Neural" language="en-GB"';

export function say(text: string): string {
  return `<Say ${VOICE}>${escapeXml(text)}</Say>`;
}

/** Listen for the caller's next words and send them to the turn endpoint. */
export function gather(installation: Installation, conversationId: string, prompt?: string): string {
  const action = escapeXml(appUrl(`/api/gateway/${installation.id}/voice/turn?c=${encodeURIComponent(conversationId)}`));
  return `<Gather input="speech" language="en-GB" speechTimeout="auto" action="${action}" method="POST">${prompt ? say(prompt) : ""}</Gather>`;
}

/** What to do once a call needs a person: put it through, or promise a call back. */
export function personNeeded(installation: Installation, conversation: GatewayConversation, lead: string | null): Response {
  const onCall = readGatewaySettings(installation.settings).onCallPhone;
  const intro = lead ? say(lead) : "";
  if (onCall && /^\+\d{8,15}$/.test(onCall)) {
    return twiml(`${intro}${say("Putting you through now.")}<Dial timeout="25">${escapeXml(onCall)}</Dial>${say("Sorry, nobody could answer. A member of the team will call you back as soon as possible.")}<Hangup/>`);
  }
  void conversation;
  return twiml(`${intro}${say("A member of the team will call you back as soon as possible. Goodbye.")}<Hangup/>`);
}

/** After a turn: answer and listen again, put the caller through, or end the call. */
export function respond(installation: Installation, conversation: GatewayConversation, reply: string | null): Response {
  if (conversation.status === "NEEDS_PERSON" || conversation.status === "WITH_PERSON") return personNeeded(installation, conversation, reply);
  if (conversation.status === "CLOSED") return twiml(`${say(reply ?? "Thank you for calling. Goodbye.")}<Hangup/>`);
  return twiml(`${gather(installation, conversation.id, reply ?? "Is there anything else?")}${say("Thank you for calling. Goodbye.")}<Hangup/>`);
}

/** Keep the caller company while a slow turn finishes, then pick up its answer. */
export function holdOn(installation: Installation, conversationId: string, attempt: number, phrase: string): Response {
  const url = escapeXml(appUrl(`/api/gateway/${installation.id}/voice/wait?c=${encodeURIComponent(conversationId)}&n=${attempt}`));
  return twiml(`${say(phrase)}<Redirect method="POST">${url}</Redirect>`);
}
