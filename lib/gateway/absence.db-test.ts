import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { after, before, test } from "node:test";

import { prisma } from "@/lib/db";

import { receiveMessage } from "./conversations";

// A carer texts Gateway to say they can't make a shift, against stand-ins for
// Claude, Aultrum ID and the platform (Pleasant): Gateway tells the office and
// sends the platform gateway.absence.reported with who and which shift, so it
// can find cover. Someone who isn't a known carer can't use it.

const read = (req: IncomingMessage) => new Promise<string>((done) => { let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => done(raw)); });

let claude: Server;
let aid: Server;
let platform: Server;
const delivered: { type: string; data: Record<string, unknown> }[] = [];
const toolsOffered: string[][] = [];
let orgId = "";
let installationId = "";

before(async () => {
  claude = createServer(async (req, res) => {
    const body = JSON.parse(await read(req)) as { tools?: { name: string }[]; messages: { role: string; content: unknown }[] };
    toolsOffered.push((body.tools ?? []).map((t) => t.name));
    const last = body.messages.at(-1)!;
    const content = typeof last.content === "string" && (body.tools ?? []).some((t) => t.name === "report_absence")
      ? [{ type: "tool_use", id: "tu_1", name: "report_absence", input: { date: "2026-11-14", when: "Saturday's 7am at Meadow View", reason: "unwell" } }]
      : [{ type: "text", text: "Thanks, the office has been told and will arrange cover." }];
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "msg", type: "message", role: "assistant", model: "test", content, stop_reason: content[0].type === "tool_use" ? "tool_use" : "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }));
  });
  aid = createServer((_req, res) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ ok: true, enforced: false })); });
  platform = createServer(async (req, res) => {
    const event = JSON.parse(await read(req)) as { type: string; data: Record<string, unknown> };
    delivered.push({ type: event.type, data: event.data });
    res.end("{}");
  });
  for (const s of [claude, aid, platform]) await new Promise<void>((d) => s.listen(0, d));
  const port = (s: Server) => (s.address() as { port: number }).port;
  process.env.ANTHROPIC_BASE_URL = `http://localhost:${port(claude)}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.AULTRUM_ID_URL = `http://localhost:${port(aid)}`;

  const org = await prisma.organization.create({ data: { name: "Absence Test Org" } });
  orgId = org.id;
  const p = await prisma.platform.create({ data: { organizationId: org.id, name: "Pleasant", clientId: `pl_abs_${Date.now()}`, secretHash: "x", webhookSecret: "whsec", webhookUrl: `http://localhost:${port(platform)}/api/webhooks/elements` } });
  installationId = (await prisma.installation.create({ data: { organizationId: org.id, platformId: p.id, moduleKey: "gateway", tenantId: "agency-1", tenantName: "Brightwater" } })).id;
  await prisma.gatewayPerson.create({ data: { installationId, personId: "staff-ada", name: "Ada Carer", phone: "+447700900101", kind: "carer" } });
  await prisma.gatewayPerson.create({ data: { installationId, personId: "contact:c1", name: "Mo Manager", phone: "+447700900102", kind: "client", organisation: "Meadow View" } });
});

after(async () => {
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
  for (const s of [claude, aid, platform]) s.close();
});

const installation = () => prisma.installation.findUniqueOrThrow({ where: { id: installationId } });

test("a known carer who can't make a shift: the office is told and the platform gets gateway.absence.reported", async () => {
  const out = await receiveMessage({ installation: await installation(), channel: "SMS", contact: "+447700900101", text: "Sorry I'm ill and can't do Saturday morning" });
  assert.match(out.reply ?? "", /arrange cover/);
  const absence = delivered.find((d) => d.type === "gateway.absence.reported");
  assert.ok(absence, `delivered: ${delivered.map((d) => d.type).join(", ")}`);
  assert.equal(absence.data.personId, "staff-ada");
  assert.equal(absence.data.date, "2026-11-14");
  assert.equal(absence.data.reason, "unwell");
  const c = await prisma.gatewayConversation.findUniqueOrThrow({ where: { id: out.conversation.id } });
  assert.match(c.summary ?? "", /Can't make a shift/);
  assert.equal(c.followUp, true);
});

test("anyone who isn't a known carer isn't offered it", async () => {
  toolsOffered.length = 0;
  await receiveMessage({ installation: await installation(), channel: "SMS", contact: "+447700900102", text: "Our carer can't come Saturday" });
  await receiveMessage({ installation: await installation(), channel: "SMS", contact: "+447700900199", text: "I can't make my shift" });
  assert.ok(toolsOffered.length >= 2);
  assert.ok(toolsOffered.every((names) => !names.includes("report_absence")));
});
