import { chargeAllowance, textParts } from "@/lib/allowance";
import { verifiedTwilio } from "@/lib/gateway/channel";
import { receiveMessage } from "@/lib/gateway/conversations";
import { chargeNumberThisMonth, orgOf } from "@/lib/gateway/number";
import { escapeXml, twiml } from "@/lib/gateway/twilio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Twilio calls this when someone texts the installation's number. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const verified = await verifiedTwilio(request, id);
  if (!verified) return new Response("Forbidden", { status: 403 });
  const { installation, params: form, creds } = verified;
  if (!form.From) return twiml("");
  const org = await orgOf(installation);
  // Texts on a number Elements bought are paid from the Allowance; the customer's own Twilio bills them directly.
  if (creds.aultrum) {
    await chargeNumberThisMonth(installation);
    await chargeAllowance(org, "sms_in", 1, form.MessageSid ? `in:${form.MessageSid}` : undefined);
  }
  const { reply } = await receiveMessage({ installation, channel: "SMS", contact: form.From, text: form.Body ?? "" });
  if (!reply) return twiml("");
  if (creds.aultrum && !(await chargeAllowance(org, "sms_out", textParts(reply), form.MessageSid ? `reply:${form.MessageSid}` : undefined)).ok) return twiml("");
  return twiml(`<Message>${escapeXml(reply)}</Message>`);
}
