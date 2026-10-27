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
}

export async function twilioCredentials(settings: GatewaySettings): Promise<TwilioCredentials | null> {
  const { accountSid, authTokenSealed, phoneNumber } = settings.twilio;
  const authToken = await unseal(authTokenSealed);
  if (!accountSid || !authToken || !phoneNumber) return null;
  return { accountSid, authToken, phoneNumber };
}
