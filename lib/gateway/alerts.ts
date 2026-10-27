import type { GatewayConversation } from "@prisma/client";
import { after } from "next/server";

import { prisma } from "../db";
import { sendEmail } from "../email";
import { appUrl } from "../utils";
import { normalisePhone } from "./directory";
import { readGatewaySettings, serviceNameOf, twilioCredentials } from "./settings";
import { sendSms } from "./twilio";

// Tells the team something needs them, so nobody has to watch the inbox.

export type AlertKind = "enquiry" | "message" | "handover" | "emergency";

/** Non-urgent alerts for one conversation are at most this often. */
const QUIET_MINUTES = 10;

export interface Alert {
  kind: AlertKind;
  /** Who it's from, as best we know. */
  name?: string | null;
  /** One line: the topic, who a message is for, or why a person is needed. */
  headline: string;
  /** What they said, in their words. */
  details?: string | null;
  /** How to reach them, if different from the number they used. */
  reachOn?: string | null;
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** The addresses in a comma- or line-separated list; anything else is dropped. */
export function parseAlertEmails(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL.test(e)))].slice(0, 10);
}

function channelLabel(c: GatewayConversation): string {
  return c.channel === "VOICE" ? "a phone call" : c.channel === "SMS" ? "a text" : "web chat";
}

function contactLabel(c: GatewayConversation): string {
  return c.channel === "WEBCHAT" ? "your website's chat" : c.contact;
}

async function recipients(installationId: string): Promise<{ emails: string[]; settings: ReturnType<typeof readGatewaySettings>; serviceName: string; installation: Awaited<ReturnType<typeof prisma.installation.findUniqueOrThrow>> }> {
  const installation = await prisma.installation.findUniqueOrThrow({ where: { id: installationId }, include: { platform: { select: { builtIn: true } } } });
  const settings = readGatewaySettings(installation.settings);
  let emails = parseAlertEmails(settings.alertEmails);
  if (emails.length === 0 && installation.platform.builtIn) {
    // On its own, the team is everyone who runs the inbox.
    const team = await prisma.user.findMany({
      where: { organizationId: installation.organizationId, role: { in: ["ADMIN", "MEMBER"] }, emailVerified: true },
      select: { email: true },
    });
    emails = team.map((u) => u.email);
  }
  return { emails, settings, serviceName: serviceNameOf(settings, installation.tenantName), installation };
}

/** Claims the right to alert for this conversation; urgent alerts always go. */
async function claim(c: GatewayConversation, urgent: boolean): Promise<boolean> {
  const now = new Date();
  if (urgent) {
    await prisma.gatewayConversation.update({ where: { id: c.id }, data: { alertedAt: now } });
    return true;
  }
  const since = new Date(now.getTime() - QUIET_MINUTES * 60_000);
  const claimed = await prisma.gatewayConversation.updateMany({
    where: { id: c.id, OR: [{ alertedAt: null }, { alertedAt: { lt: since } }] },
    data: { alertedAt: now },
  });
  return claimed.count === 1;
}

const SUBJECT: Record<AlertKind, (a: Alert, service: string) => string> = {
  enquiry: (a, s) => `New enquiry for ${s}${a.name ? ` from ${a.name}` : ""}: ${a.headline}`,
  message: (a, s) => `New message for ${s}${a.name ? ` from ${a.name}` : ""}`,
  handover: (a, s) => `${a.name ?? "Someone"} needs a person at ${s}`,
  emergency: (_a, s) => `URGENT: possible emergency at ${s}`,
};

export async function sendAlert(c: GatewayConversation, alert: Alert): Promise<void> {
  const urgent = alert.kind === "emergency";
  if (!(await claim(c, urgent))) return;
  const { emails, settings, serviceName } = await recipients(c.installationId);
  const inbox = appUrl("/gateway");
  const lines = [
    urgent ? "Gateway thinks someone may be in danger. It told them to call 999. Please check now." : null,
    `${alert.kind === "enquiry" ? "Enquiry" : alert.kind === "message" ? "Message" : "Reason"}: ${alert.headline}`,
    alert.name ? `From: ${alert.name}` : null,
    `Came in by ${channelLabel(c)} from ${contactLabel(c)}`,
    alert.reachOn ? `Reach them on: ${alert.reachOn}` : null,
    alert.details ? `\nWhat they said:\n${alert.details}` : null,
    `\nOpen Gateway to reply or mark it followed up:\n${inbox}`,
  ].filter(Boolean);
  const text = lines.join("\n");

  await Promise.all(emails.map((to) => sendEmail({ to, subject: SUBJECT[alert.kind](alert, serviceName), text })));

  if (urgent && settings.urgentSms) {
    const to = settings.onCallPhone ? normalisePhone(settings.onCallPhone) : null;
    const creds = await twilioCredentials(settings);
    if (to && creds) {
      const said = (alert.details ?? alert.headline).slice(0, 200);
      await sendSms(creds, to, `Gateway, ${serviceName}: possible emergency from ${contactLabel(c)}. "${said}" Open ${inbox}`).catch((error) => console.error("urgent text not sent", error));
    }
  }
}

/** Alerts go out after the reply, so callers and chatters aren't kept waiting. */
export function alertTeam(c: GatewayConversation, alert: Alert): void {
  const task = () => sendAlert(c, alert).catch((error) => console.error("gateway alert failed", error));
  try {
    after(task);
  } catch {
    // Outside a request (scripts and tests): send now.
    void task();
  }
}
