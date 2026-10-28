"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseAlertEmails } from "@/lib/gateway/alerts";
import { normalisePhone } from "@/lib/gateway/directory";
import { gatewaySettingsSchema, readGatewaySettings, twilioCredentials } from "@/lib/gateway/settings";
import { connectNumber } from "@/lib/gateway/twilio";
import { peakSettingsSchema } from "@/lib/peak/settings";
import { seal } from "@/lib/seal";
import { appUrl } from "@/lib/utils";

export interface FormState {
  ok?: boolean;
  error?: string;
  /** Saved, with something to report (e.g. the Twilio number was connected, or couldn't be). */
  note?: string;
  noteOk?: boolean;
}

async function ownedInstallation(organizationId: string, id: string, moduleKey: string) {
  return prisma.installation.findFirst({ where: { id, organizationId, moduleKey } });
}

function merged(settings: unknown, key: string, value: unknown): Prisma.InputJsonValue {
  const base = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
  return { ...base, [key]: value } as Prisma.InputJsonValue;
}

export async function saveGatewaySettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const installation = await ownedInstallation(user.organizationId, String(formData.get("id") ?? ""), "gateway");
  if (!installation) return { error: "Installation not found" };
  const current = readGatewaySettings(installation.settings);

  const onCallRaw = String(formData.get("onCallPhone") ?? "").trim();
  const onCall = onCallRaw ? normalisePhone(onCallRaw) : "";
  if (onCall === null) return { error: "Enter the on-call number in full, e.g. 07700 900123 or +447700900123." };
  const numberRaw = String(formData.get("phoneNumber") ?? "").trim();
  const phoneNumber = numberRaw ? normalisePhone(numberRaw) : "";
  if (phoneNumber === null) return { error: "Enter your Twilio number in full, e.g. +441234567890." };
  const accountSid = String(formData.get("accountSid") ?? "").trim();
  if (accountSid && !/^AC[0-9a-f]{32}$/i.test(accountSid)) return { error: "A Twilio Account SID starts with AC and has 34 characters." };
  const newToken = String(formData.get("authToken") ?? "").trim();
  if (newToken && !/^[0-9a-f]{32}$/i.test(newToken)) return { error: "A Twilio auth token has 32 letters and numbers." };

  const alertRaw = String(formData.get("alertEmails") ?? "").trim();
  const alertEmails = parseAlertEmails(alertRaw);
  if (alertRaw && alertEmails.length === 0) return { error: "Enter alert emails separated by commas, e.g. office@example.co.uk, manager@example.co.uk." };

  const parsed = gatewaySettingsSchema.safeParse({
    serviceName: String(formData.get("serviceName") ?? ""),
    alertEmails: alertEmails.join(", "),
    urgentSms: formData.get("urgentSms") === "on",
    about: String(formData.get("about") ?? ""),
    onCallPhone: onCall,
    webchat: formData.get("webchat") === "on",
    twilio: {
      accountSid,
      authTokenSealed: newToken ? await seal(newToken) : formData.get("clearToken") === "on" ? "" : current.twilio.authTokenSealed,
      phoneNumber,
    },
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  await prisma.installation.update({ where: { id: installation.id }, data: { settings: merged(installation.settings, "gateway", parsed.data) } });
  await recordAudit(user, { action: "gateway.settings", summary: `Updated Gateway settings for ${installation.tenantName}${newToken ? " (new Twilio token)" : ""}` });
  revalidatePath(`/installations/${installation.id}`);
  const creds = await twilioCredentials(parsed.data);
  if (!creds) return { ok: true };
  const connected = await connectNumber(creds, { voice: appUrl(`/api/gateway/${installation.id}/voice`), sms: appUrl(`/api/gateway/${installation.id}/sms`) });
  return { ok: true, note: connected.message, noteOk: connected.ok };
}

export async function savePeakSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const installation = await ownedInstallation(user.organizationId, String(formData.get("id") ?? ""), "peak");
  if (!installation) return { error: "Installation not found" };
  const parsed = peakSettingsSchema.safeParse(Object.fromEntries(["shift", "onTime", "graceMinutes", "streakEvery", "streakBonus", "praise", "pointValuePence"].map((k) => [k, formData.get(k)])));
  if (!parsed.success) return { error: `Check ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}` };
  await prisma.installation.update({ where: { id: installation.id }, data: { settings: merged(installation.settings, "peak", parsed.data) } });
  await recordAudit(user, { action: "peak.settings", summary: `Updated Peak points for ${installation.tenantName}` });
  revalidatePath(`/installations/${installation.id}`);
  return { ok: true };
}

const rewardSchema = z.object({
  name: z.string().trim().min(2, "Name the reward").max(80),
  description: z.string().trim().max(200).default(""),
  kind: z.enum(["CASH_OUT", "PERK"]),
  cost: z.coerce.number().int().min(1, "Set a cost in points").max(1_000_000),
});

export async function addRewardAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const installation = await ownedInstallation(user.organizationId, String(formData.get("id") ?? ""), "peak");
  if (!installation) return { error: "Installation not found" };
  const parsed = rewardSchema.safeParse({ name: formData.get("name"), description: formData.get("description") ?? "", kind: formData.get("kind"), cost: formData.get("cost") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the reward" };
  await prisma.peakReward.create({ data: { ...parsed.data, installationId: installation.id } });
  await recordAudit(user, { action: "peak.reward", summary: `Added the Peak reward "${parsed.data.name}" for ${installation.tenantName}` });
  revalidatePath(`/installations/${installation.id}`);
  return { ok: true };
}

export async function toggleRewardAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const reward = await prisma.peakReward.findFirst({
    where: { id: String(formData.get("rewardId") ?? ""), installation: { organizationId: user.organizationId } },
  });
  if (!reward) return;
  await prisma.peakReward.update({ where: { id: reward.id }, data: { active: !reward.active } });
  await recordAudit(user, { action: "peak.reward", summary: `${reward.active ? "Hid" : "Showed"} the Peak reward "${reward.name}"` });
  revalidatePath(`/installations/${reward.installationId}`);
}
