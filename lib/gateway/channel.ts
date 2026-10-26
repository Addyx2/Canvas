import type { Installation } from "@prisma/client";

import { prisma } from "../db";
import { appUrl } from "../utils";
import { readGatewaySettings, twilioCredentials, type TwilioCredentials } from "./settings";
import { readTwilioForm, twilioSignatureValid } from "./twilio";

/** An active Gateway installation by ID, for the public channel endpoints. */
export async function activeGateway(id: string): Promise<Installation | null> {
  const installation = await prisma.installation.findUnique({ where: { id }, include: { platform: { select: { revokedAt: true } } } });
  if (!installation || installation.moduleKey !== "gateway" || installation.status !== "ACTIVE" || installation.platform.revokedAt) return null;
  return installation;
}

/**
 * Check a Twilio webhook really came from Twilio, using the installation's
 * own auth token and the public URL Twilio was given.
 */
export async function verifiedTwilio(request: Request, id: string): Promise<{ installation: Installation; params: Record<string, string>; creds: TwilioCredentials } | null> {
  const installation = await activeGateway(id);
  if (!installation) return null;
  const creds = await twilioCredentials(readGatewaySettings(installation.settings));
  if (!creds) return null;
  const params = await readTwilioForm(request);
  const url = new URL(request.url);
  const publicUrl = appUrl(url.pathname + url.search);
  if (!twilioSignatureValid(creds.authToken, publicUrl, params, request.headers.get("x-twilio-signature"))) return null;
  return { installation, params, creds };
}
