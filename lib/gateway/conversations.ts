import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { GatewayChannel, GatewayConversation, Installation, Prisma } from "@prisma/client";

import { prisma } from "../db";
import { emitEvent } from "../webhooks";
import { aiAvailable, runAgentTurn, type ToolRunner } from "./agent";
import { findCaller, normalisePhone } from "./directory";
import { EMERGENCY_REPLY, looksLikeEmergency } from "./emergency";
import { readGatewaySettings, serviceNameOf, twilioCredentials } from "./settings";
import { sendSms } from "./twilio";

export class GatewayError extends Error {}

/** A conversation goes quiet after this long; the next message starts a new one. */
const IDLE_HOURS = 12;
/** At most this many messages from one contact in ten minutes. */
const RATE_LIMIT = 30;

export interface Incoming {
  installation: Installation;
  channel: GatewayChannel;
  /** Phone number, or web chat visitor key. */
  contact: string;
  text: string;
  contactName?: string;
  /** Voice calls keep one conversation per call. */
  conversationId?: string;
}

export interface Outcome {
  conversation: GatewayConversation;
  /** What to say back; null when staff will answer. */
  reply: string | null;
}

async function openConversation(input: Incoming): Promise<GatewayConversation> {
  const { installation, channel, contact } = input;
  if (input.conversationId) {
    const existing = await prisma.gatewayConversation.findFirst({ where: { id: input.conversationId, installationId: installation.id } });
    if (existing) return existing;
  }
  if (channel !== "VOICE") {
    const recent = await prisma.gatewayConversation.findFirst({
      where: {
        installationId: installation.id,
        channel,
        contact,
        status: { not: "CLOSED" },
        lastMessageAt: { gt: new Date(Date.now() - IDLE_HOURS * 3600_000) },
      },
      orderBy: { lastMessageAt: "desc" },
    });
    if (recent) return recent;
  }
  const caller = channel === "WEBCHAT" ? null : await findCaller(installation.id, normalisePhone(contact));
  return prisma.gatewayConversation.create({
    data: {
      installationId: installation.id,
      channel,
      contact,
      contactName: caller?.name ?? input.contactName ?? null,
      personId: caller?.personId ?? null,
    },
  });
}

async function addMessage(conversationId: string, sender: "CONTACT" | "AGENT" | "STAFF" | "SYSTEM", body: string, staffName?: string) {
  await prisma.gatewayMessage.create({ data: { conversationId, sender, body: body.slice(0, 4000), staffName } });
  await prisma.gatewayConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
}

function who(c: GatewayConversation) {
  return { conversationId: c.id, channel: c.channel.toLowerCase(), contact: c.contact, contactName: c.contactName, personId: c.personId };
}

async function handOver(c: GatewayConversation, reason: string, urgent: boolean) {
  await prisma.gatewayConversation.update({
    where: { id: c.id },
    data: { status: "NEEDS_PERSON", handoverReason: reason, ...(urgent ? { intent: "EMERGENCY" } : {}) },
  });
  await emitEvent(c.installationId, "gateway.handover.requested", { ...who(c), reason, urgent });
}

/** Close a conversation and send its record to the platform (e.g. into its CRM). */
export async function closeConversation(c: GatewayConversation, summary: string | null, closedBy: string) {
  const fresh = await prisma.gatewayConversation.update({
    where: { id: c.id },
    data: { status: "CLOSED", summary: summary ?? c.summary },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
  });
  await emitEvent(c.installationId, "gateway.call.completed", {
    ...who(fresh),
    intent: fresh.intent.toLowerCase(),
    summary: fresh.summary,
    closedBy,
    startedAt: fresh.createdAt.toISOString(),
    transcript: fresh.messages.map((m) => ({ from: m.sender.toLowerCase(), text: m.body, at: m.createdAt.toISOString(), ...(m.staffName ? { staff: m.staffName } : {}) })),
  });
}

function toolRunner(c: GatewayConversation, state: { close?: string }): ToolRunner {
  return async (name, input) => {
    switch (name) {
      case "take_enquiry": {
        const i = input as { name: string; contact: string; organisation: string; topic: string; details: string };
        await prisma.gatewayConversation.update({ where: { id: c.id }, data: { intent: "ENQUIRY", contactName: c.contactName ?? i.name, summary: `Enquiry: ${i.topic}`, followUp: true, followUpDoneAt: null } });
        await emitEvent(c.installationId, "gateway.enquiry.received", {
          ...who(c),
          name: i.name,
          reachOn: i.contact || (c.channel === "WEBCHAT" ? null : c.contact),
          organisation: i.organisation || null,
          topic: i.topic,
          details: i.details,
        });
        return "Sent to the team. They will be in touch.";
      }
      case "take_message": {
        const i = input as { name: string; contact: string; for_whom: string; message: string };
        await prisma.gatewayConversation.update({ where: { id: c.id }, data: { intent: "MESSAGE", contactName: c.contactName ?? i.name, summary: `Message${i.for_whom ? ` for ${i.for_whom}` : ""}`, followUp: true, followUpDoneAt: null } });
        await emitEvent(c.installationId, "gateway.message.left", {
          ...who(c),
          name: i.name,
          reachOn: i.contact || (c.channel === "WEBCHAT" ? null : c.contact),
          forWhom: i.for_whom || null,
          message: i.message,
        });
        return "Passed to the team.";
      }
      case "hand_over": {
        const i = input as { reason: string; urgent: boolean };
        await handOver(c, i.reason, i.urgent);
        return "A member of staff has been asked to take over.";
      }
      case "close_conversation": {
        state.close = (input as { summary: string }).summary;
        return "The conversation will close after your reply.";
      }
    }
    return "Unknown tool";
  };
}

/** Without an AI key, Gateway still takes every message and passes it to the team. */
async function ruleTurn(c: GatewayConversation, text: string, serviceName: string): Promise<string> {
  const name = c.contactName?.split(" ")[0];
  await prisma.gatewayConversation.update({ where: { id: c.id }, data: { intent: "MESSAGE", summary: "Message", followUp: true, followUpDoneAt: null } });
  await emitEvent(c.installationId, "gateway.message.left", {
    ...who(c),
    name: c.contactName,
    reachOn: c.channel === "WEBCHAT" ? null : c.contact,
    forWhom: null,
    message: text.slice(0, 800),
  });
  await handOver(c, "New message", false);
  return `${name ? `Thanks ${name}. ` : "Thanks for your message. "}I've passed it to the ${serviceName} team and someone will reply shortly.`;
}

/** A message arrives from a person on any channel. */
export async function receiveMessage(input: Incoming): Promise<Outcome> {
  const text = input.text.trim().slice(0, 2000);
  const settings = readGatewaySettings(input.installation.settings);
  const serviceName = serviceNameOf(settings, input.installation.tenantName);

  const recentCount = await prisma.gatewayMessage.count({
    where: { sender: "CONTACT", createdAt: { gt: new Date(Date.now() - 10 * 60_000) }, conversation: { installationId: input.installation.id, contact: input.contact } },
  });
  let conversation = await openConversation(input);
  if (recentCount >= RATE_LIMIT) return { conversation, reply: null };
  if (!text) return { conversation, reply: null };
  await addMessage(conversation.id, "CONTACT", text);

  if (looksLikeEmergency(text) && conversation.intent !== "EMERGENCY") {
    await handOver(conversation, `Possible emergency: “${text.slice(0, 200)}”`, true);
    await addMessage(conversation.id, "AGENT", EMERGENCY_REPLY);
    return { conversation: await prisma.gatewayConversation.findUniqueOrThrow({ where: { id: conversation.id } }), reply: EMERGENCY_REPLY };
  }
  // Once staff are involved, Gateway stays quiet and lets them answer.
  if (conversation.status === "NEEDS_PERSON" || conversation.status === "WITH_PERSON") return { conversation, reply: null };
  if (conversation.status === "CLOSED") {
    conversation = await prisma.gatewayConversation.update({ where: { id: conversation.id }, data: { status: "WITH_AI" } });
  }

  let reply: string;
  const state: { close?: string } = {};
  if (aiAvailable()) {
    const caller = conversation.personId
      ? await prisma.gatewayPerson.findUnique({ where: { installationId_personId: { installationId: input.installation.id, personId: conversation.personId } } })
      : null;
    try {
      const turn = await runAgentTurn(
        (conversation.agentState as unknown as BetaMessageParam[]) ?? [],
        text,
        { serviceName, about: settings.about, channel: input.channel, caller },
        toolRunner(conversation, state),
      );
      reply = turn.reply;
      await prisma.gatewayConversation.update({ where: { id: conversation.id }, data: { agentState: turn.state as unknown as Prisma.InputJsonValue } });
    } catch (error) {
      console.error("gateway agent failed; using rules", error);
      reply = await ruleTurn(conversation, text, serviceName);
    }
  } else {
    reply = await ruleTurn(conversation, text, serviceName);
  }

  await addMessage(conversation.id, "AGENT", reply);
  conversation = await prisma.gatewayConversation.findUniqueOrThrow({ where: { id: conversation.id } });
  if (state.close && conversation.status === "WITH_AI") await closeConversation(conversation, state.close, "Gateway");
  return { conversation: await prisma.gatewayConversation.findUniqueOrThrow({ where: { id: conversation.id } }), reply };
}

// ---------------------------------------------------------------- staff actions

async function owned(installationId: string, conversationId: string) {
  const c = await prisma.gatewayConversation.findFirst({ where: { id: conversationId, installationId } });
  if (!c) throw new GatewayError("That conversation no longer exists.");
  return c;
}

/** A member of staff answers. Texts and calls get an SMS; web chat sees it on its next refresh. */
export async function staffReply(installation: Installation, conversationId: string, staffName: string, text: string) {
  const c = await owned(installation.id, conversationId);
  const body = text.trim().slice(0, 1500);
  if (!body) throw new GatewayError("Write a reply first.");
  if (c.channel !== "WEBCHAT") {
    const creds = await twilioCredentials(readGatewaySettings(installation.settings));
    if (!creds) throw new GatewayError("Add Twilio in the Elements console to reply by text.");
    const to = normalisePhone(c.contact);
    if (!to) throw new GatewayError("This caller's number can't receive texts.");
    await sendSms(creds, to, body);
  }
  await addMessage(c.id, "STAFF", body, staffName);
  await prisma.gatewayConversation.update({ where: { id: c.id }, data: { status: "WITH_PERSON", staffName } });
}

export async function takeOver(installation: Installation, conversationId: string, staffName: string) {
  const c = await owned(installation.id, conversationId);
  if (c.status === "CLOSED") throw new GatewayError("This conversation is closed.");
  await prisma.gatewayConversation.update({ where: { id: c.id }, data: { status: "WITH_PERSON", staffName } });
  await addMessage(c.id, "SYSTEM", `${staffName} took over`);
}

export async function handBack(installation: Installation, conversationId: string, staffName: string) {
  const c = await owned(installation.id, conversationId);
  if (c.status === "CLOSED") throw new GatewayError("This conversation is closed.");
  await prisma.gatewayConversation.update({ where: { id: c.id }, data: { status: "WITH_AI", staffName: null, handoverReason: null } });
  await addMessage(c.id, "SYSTEM", `${staffName} handed back to Gateway`);
}

export async function staffClose(installation: Installation, conversationId: string, staffName: string, summary?: string) {
  const c = await owned(installation.id, conversationId);
  if (c.status === "CLOSED") return;
  await addMessage(c.id, "SYSTEM", `${staffName} closed the conversation`);
  await closeConversation(c, summary?.trim() || null, staffName);
}

/** Someone has followed up an enquiry or message Gateway took. */
export async function markFollowedUp(installation: Installation, conversationId: string, staffName: string) {
  const c = await owned(installation.id, conversationId);
  if (!c.followUp || c.followUpDoneAt) return;
  await prisma.gatewayConversation.update({ where: { id: c.id }, data: { followUpDoneAt: new Date(), followUpBy: staffName } });
  await addMessage(c.id, "SYSTEM", `${staffName} marked it as followed up`);
}
