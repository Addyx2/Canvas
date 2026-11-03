import type { Installation, Prisma } from "@prisma/client";

import { chargeAllowance } from "../allowance";
import { prisma } from "../db";
import { appUrl } from "../utils";
import { aultrumTwilio, readGatewaySettings, usesOwnTwilio, type GatewaySettings } from "./settings";
import { buyUkMobile, ukMobileBundle } from "./twilio";

// Each Gateway gets a UK mobile number of its own, bought by Elements on
// Aultrum's Twilio account with its calls and texts already pointed here,
// unless the customer connected their own Twilio. The number is paid for
// from the organisation's Allowance each month.

const month = (now = new Date()) => now.toISOString().slice(0, 7);

async function saveNumber(installation: Installation, number: Partial<GatewaySettings["number"]>) {
  const fresh = await prisma.installation.findUniqueOrThrow({ where: { id: installation.id } });
  const settings = (fresh.settings && typeof fresh.settings === "object" ? fresh.settings : {}) as Record<string, unknown>;
  const current = readGatewaySettings(fresh.settings);
  await prisma.installation.update({
    where: { id: installation.id },
    data: { settings: { ...settings, gateway: { ...(settings.gateway as object), number: { ...current.number, ...number } } } as Prisma.InputJsonValue },
  });
}

const orgOf = async (installation: Installation) => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: installation.organizationId }, select: { id: true, name: true } });
  return { id: org.id, name: org.name };
};

export async function provisionGatewayNumber(installationId: string): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  const installation = await prisma.installation.findUniqueOrThrow({ where: { id: installationId } });
  const settings = readGatewaySettings(installation.settings);
  if (usesOwnTwilio(settings)) return { ok: false, error: "This Gateway uses its own Twilio number." };
  if (settings.number.status === "active" && settings.number.phoneNumber) return { ok: true, number: settings.number.phoneNumber };
  const account = aultrumTwilio();
  if (!account) {
    const error = "Aultrum hasn't finished setting up phone numbers yet. Web chat works meanwhile.";
    await saveNumber(installation, { status: "failed", error, triedAt: new Date().toISOString() });
    return { ok: false, error };
  }
  try {
    const bundle = await ukMobileBundle(account);
    if (!bundle) throw new Error("No approved UK mobile regulatory bundle on the account");
    const bought = await buyUkMobile(account, {
      friendlyName: `Gateway · ${installation.tenantName}`,
      voiceUrl: appUrl(`/api/gateway/${installation.id}/voice`),
      smsUrl: appUrl(`/api/gateway/${installation.id}/sms`),
      ...bundle,
    });
    await saveNumber(installation, { phoneNumber: bought.number, numberSid: bought.sid, status: "active", error: "", chargedMonth: month(), triedAt: new Date().toISOString() });
    await chargeAllowance(await orgOf(installation), "number_month", 1, `number:${bought.sid}:${month()}`);
    return { ok: true, number: bought.number };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Twilio didn't sell a number";
    console.error(JSON.stringify({ event: "gateway_number_failed", installationId, error: raw }));
    const error = /bundle|regulat|address/i.test(raw)
      ? "Its number is waiting on Aultrum's UK number approval with the phone network. Web chat works meanwhile."
      : "Its number couldn't be set up just now. Try again in a few minutes.";
    await saveNumber(installation, { status: "failed", error, triedAt: new Date().toISOString() });
    return { ok: false, error };
  }
}

/** Takes the number's monthly charge once a month, the first time it's used that month. */
export async function chargeNumberThisMonth(installation: Installation, now = new Date()): Promise<void> {
  const settings = readGatewaySettings(installation.settings);
  if (usesOwnTwilio(settings) || settings.number.status !== "active" || settings.number.chargedMonth === month(now)) return;
  await saveNumber(installation, { chargedMonth: month(now) });
  await chargeAllowance(await orgOf(installation), "number_month", 1, `number:${settings.number.numberSid}:${month(now)}`);
}

/** A Gateway waiting for a number tries again by itself, at most once an hour. */
export function shouldRetryNumber(settings: GatewaySettings, now = Date.now()): boolean {
  if (usesOwnTwilio(settings) || settings.number.status === "active") return false;
  return !settings.number.triedAt || now - Date.parse(settings.number.triedAt) > 3_600_000;
}

export { orgOf };
