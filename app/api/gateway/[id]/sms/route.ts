import { verifiedTwilio } from "@/lib/gateway/channel";
import { receiveMessage } from "@/lib/gateway/conversations";
import { escapeXml, twiml } from "@/lib/gateway/twilio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Twilio calls this when someone texts the installation's number. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const verified = await verifiedTwilio(request, id);
  if (!verified) return new Response("Forbidden", { status: 403 });
  const { installation, params: form } = verified;
  if (!form.From) return twiml("");
  const { reply } = await receiveMessage({ installation, channel: "SMS", contact: form.From, text: form.Body ?? "" });
  return twiml(reply ? `<Message>${escapeXml(reply)}</Message>` : "");
}
