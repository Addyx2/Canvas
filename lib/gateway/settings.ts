import { z } from "zod";

import { unseal } from "../seal";

// How one installation of Gateway answers. Stored in Installation.settings.gateway.

export const gatewaySettingsSchema = z.object({
  /** The name callers hear, e.g. "Brightwater Care". Defaults to the service name. */
  serviceName: z.string().trim().max(120).default(""),
  /** What the agent can tell people: hours, areas covered, services, how to apply. */
  about: z.string().trim().max(4000).default(""),
  /** Who to put a call through to when a person is needed. E.164. */
  onCallPhone: z.string().trim().max(20).default(""),
  webchat: z.boolean().default(true),
  /** Who is emailed about new enquiries, messages and handovers, comma separated. Empty: everyone on the team (on its own) or no one (inside another system, which gets events instead). */
  alertEmails: z.string().trim().max(600).default(""),
  /** Text the on-call number when someone may be in danger. */
  urgentSms: z.boolean().default(true),
  twilio: z
    .object({
      accountSid: z.string().trim().max(64).default(""),
      /** Sealed with lib/seal; never sent back to the browser. */
      authTokenSealed: z.string().max(512).default(""),
      phoneNumber: z.string().trim().max(20).default(""),
    })
    .default({}),
  /** A UK number Elements bought for this installation on Aultrum's Twilio account, when it doesn't use its own. */
  number: z
    .object({
      phoneNumber: z.string().default(""),
      numberSid: z.string().default(""),
      /** none | active | failed */
      status: z.string().default("none"),
      error: z.string().default(""),
      /** The month (YYYY-MM) its monthly charge was last taken. */
      chargedMonth: z.string().default(""),
      triedAt: z.string().default(""),
    })
    .default({}),
});

export type GatewaySettings = z.infer<typeof gatewaySettingsSchema>;

export function readGatewaySettings(settings: unknown): GatewaySettings {
  const raw = settings && typeof settings === "object" ? (settings as { gateway?: unknown }).gateway : undefined;
  const parsed = gatewaySettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : gatewaySettingsSchema.parse({});
}

export function serviceNameOf(settings: GatewaySettings, tenantName: string): string {
  return settings.serviceName || tenantName;
}

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  /** On Aultrum's account (a number Elements bought), rather than the customer's own Twilio. */
  aultrum: boolean;
  /** Aultrum's Twilio API key, used for requests to Twilio when set (the auth token still checks incoming calls and texts). */
  apiKeySid?: string;
  apiKeySecret?: string;
}

/**
 * Aultrum's own Twilio account, which buys Gateway numbers: TWILIO_ACCOUNT_SID
 * and TWILIO_AUTH_TOKEN (the token checks that calls and texts really come
 * from Twilio). With TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET too,
 * requests to Twilio use that API key instead of the token.
 */
export function aultrumTwilio(): { accountSid: string; authToken: string; apiKeySid?: string; apiKeySecret?: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim() || undefined;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim() || undefined;
  if (!accountSid || !authToken) return null;
  return apiKeySid && apiKeySecret ? { accountSid, authToken, apiKeySid, apiKeySecret } : { accountSid, authToken };
}

export const usesOwnTwilio = (settings: GatewaySettings) => Boolean(settings.twilio.accountSid && settings.twilio.authTokenSealed && settings.twilio.phoneNumber);

/** The customer's own Twilio if they connected one; otherwise the number Elements bought on Aultrum's account. */
export async function twilioCredentials(settings: GatewaySettings): Promise<TwilioCredentials | null> {
  const { accountSid, authTokenSealed, phoneNumber } = settings.twilio;
  const authToken = await unseal(authTokenSealed);
  if (accountSid && authToken && phoneNumber) return { accountSid, authToken, phoneNumber, aultrum: false };
  const account = aultrumTwilio();
  if (account && settings.number.status === "active" && settings.number.phoneNumber) return { ...account, phoneNumber: settings.number.phoneNumber, aultrum: true };
  return null;
}
