import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { after, before, test } from "node:test";

import { POST as smsRoute } from "@/app/api/gateway/[id]/sms/route";
import { POST as voiceRoute } from "@/app/api/gateway/[id]/voice/route";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/utils";

import { provisionGatewayNumber } from "./number";
import { readGatewaySettings } from "./settings";

// Gateway's own number and its Allowance, against stand-ins for Aultrum ID
// and Twilio: Elements buys a UK number under the approved bundle it finds,
// pointed at Gateway, and charges its first month; texts in and out on that
// number are charged; with no credits, Gateway answers nobody with AI, sends
// no reply, and leaves the message or the missed call for the team.

const read = (req: IncomingMessage) => new Promise<string>((done) => { let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => done(raw)); });

let aid: Server;
let twilio: Server;
let refuse = false;
const spends: { orgId: string; action: string; quantity: number; key: string }[] = [];
const bought: Record<string, string>[] = [];
const twilioAuth: string[] = [];
let orgId = "";
let installationId = "";
const TOKEN = "aultrum-twilio-token";

before(async () => {
  aid = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && req.url === "/api/v1/allowance/spend") {
      assert.match(req.headers.authorization ?? "", /^Bearer ey/, "Elements signs its requests");
      spends.push(JSON.parse(await read(req)));
      if (refuse) {
        res.statusCode = 402;
        return res.end(JSON.stringify({ ok: false, reason: "empty", message: "Your Allowance has run out of credits." }));
      }
      return res.end(JSON.stringify({ ok: true, enforced: true }));
    }
    res.statusCode = 404;
    res.end("{}");
  });
  twilio = createServer(async (req, res) => {
    twilioAuth.push(req.headers.authorization ?? "");
    const form = new URLSearchParams(await read(req));
    const url = req.url ?? "";
    res.setHeader("Content-Type", "application/json");
    if (url.startsWith("/v2/RegulatoryCompliance/Bundles?")) return res.end(JSON.stringify({ results: [{ sid: "BUaultrum" }] }));
    if (url.startsWith("/v2/RegulatoryCompliance/Bundles/BUaultrum/ItemAssignments")) return res.end(JSON.stringify({ results: [{ object_sid: "ADaultrum" }] }));
    if (url.includes("/AvailablePhoneNumbers/GB/Mobile.json")) return res.end(JSON.stringify({ available_phone_numbers: [{ phone_number: "+447700900222" }] }));
    if (req.method === "POST" && url.endsWith("/IncomingPhoneNumbers.json")) {
      bought.push(Object.fromEntries(form));
      return res.end(JSON.stringify({ sid: "PNgateway", phone_number: "+447700900222" }));
    }
    res.end(JSON.stringify({ sid: "SMx" }));
  });
  await new Promise<void>((d) => aid.listen(0, d));
  await new Promise<void>((d) => twilio.listen(0, d));
  process.env.AULTRUM_ID_URL = `http://localhost:${(aid.address() as { port: number }).port}`;
  process.env.TWILIO_API_BASE = `http://localhost:${(twilio.address() as { port: number }).port}`;
  process.env.TWILIO_ACCOUNT_SID = `AC${"4".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = TOKEN;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.TWILIO_BUNDLE_SID;

  const org = await prisma.organization.create({ data: { name: "Gateway Billing Org" } });
  orgId = org.id;
  const platform = await prisma.platform.create({ data: { organizationId: org.id, name: "Standalone", clientId: `pl_${Date.now()}`, secretHash: "x", webhookSecret: "x", builtIn: true } });
  installationId = (await prisma.installation.create({ data: { organizationId: org.id, platformId: platform.id, moduleKey: "gateway", tenantId: "t1", tenantName: "Brightwater" } })).id;
});

after(async () => {
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
  aid.close();
  twilio.close();
});

function twilioPost(path: string, fields: Record<string, string>) {
  const url = appUrl(path);
  const data = url + Object.keys(fields).sort().map((k) => k + fields[k]).join("");
  const signature = createHmac("sha1", TOKEN).update(data).digest("base64");
  return new Request(url, { method: "POST", headers: { "x-twilio-signature": signature, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
}
const params = () => ({ params: Promise.resolve({ id: installationId }) });

test("Elements buys Gateway a UK number under the approved bundle, pointed at Gateway, and charges its month", async () => {
  const r = await provisionGatewayNumber(installationId);
  assert.ok(r.ok && r.number === "+447700900222");
  assert.equal(bought[0].BundleSid, "BUaultrum");
  assert.equal(bought[0].AddressSid, "ADaultrum");
  assert.equal(bought[0].VoiceUrl, appUrl(`/api/gateway/${installationId}/voice`));
  assert.equal(bought[0].SmsUrl, appUrl(`/api/gateway/${installationId}/sms`));
  const s = readGatewaySettings((await prisma.installation.findUniqueOrThrow({ where: { id: installationId } })).settings);
  assert.equal(s.number.status, "active");
  assert.deepEqual(spends.map((x) => [x.orgId, x.action]), [[orgId, "number_month"]]);
});

test("a text to that number is charged in and out, and answered", async () => {
  spends.length = 0;
  const res = await smsRoute(twilioPost(`/api/gateway/${installationId}/sms`, { From: "+447700900333", Body: "Do you cover Bristol?", MessageSid: "SMbill1", AccountSid: process.env.TWILIO_ACCOUNT_SID! }), params());
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<Message>/);
  assert.deepEqual(spends.map((x) => x.action), ["sms_in", "sms_out"]);
  assert.ok(spends[0].key.endsWith("in:SMbill1"));
});

test("with no credits, a text gets no AI and no reply, and waits for the team", async () => {
  refuse = true;
  process.env.ANTHROPIC_API_KEY = "test-key-never-called";
  const res = await smsRoute(twilioPost(`/api/gateway/${installationId}/sms`, { From: "+447700900444", Body: "Hello", MessageSid: "SMbill2", AccountSid: process.env.TWILIO_ACCOUNT_SID! }), params());
  assert.doesNotMatch(await res.text(), /<Message>/);
  const c = await prisma.gatewayConversation.findFirstOrThrow({ where: { installationId, contact: "+447700900444" } });
  assert.equal(c.status, "NEEDS_PERSON");
  assert.match(c.handoverReason ?? "", /Allowance has run out/);
  delete process.env.ANTHROPIC_API_KEY;
});

test("with no credits, a call is told the team will call back, and noted as a missed call", async () => {
  refuse = true;
  const res = await voiceRoute(twilioPost(`/api/gateway/${installationId}/voice`, { From: "+447700900555", CallSid: "CAbill1", AccountSid: process.env.TWILIO_ACCOUNT_SID! }), params());
  const xml = await res.text();
  assert.match(xml, /call you back/);
  assert.match(xml, /<Hangup\/>/);
  assert.doesNotMatch(xml, /<Gather/);
  const c = await prisma.gatewayConversation.findFirstOrThrow({ where: { installationId, contact: "+447700900555" } });
  assert.equal(c.status, "NEEDS_PERSON");
  assert.match(c.handoverReason ?? "", /Missed call/);
});

test("with credits, a call is answered and its first minute charged", async () => {
  refuse = false;
  spends.length = 0;
  const res = await voiceRoute(twilioPost(`/api/gateway/${installationId}/voice`, { From: "+447700900666", CallSid: "CAbill2", AccountSid: process.env.TWILIO_ACCOUNT_SID! }), params());
  assert.match(await res.text(), /<Gather/);
  assert.deepEqual(spends.map((x) => [x.action, x.key.endsWith("call:CAbill2:0")]), [["call_minute", true]]);
});

test("with a Twilio API key set, requests to Twilio use it; incoming texts are still checked with the auth token", async () => {
  process.env.TWILIO_API_KEY_SID = "SKgatewaykey";
  process.env.TWILIO_API_KEY_SECRET = "gateway-secret";
  refuse = false;
  try {
    twilioAuth.length = 0;
    const { sendSms } = await import("./twilio");
    const { readGatewaySettings: read2, twilioCredentials } = await import("./settings");
    const creds = await twilioCredentials(read2((await prisma.installation.findUniqueOrThrow({ where: { id: installationId } })).settings));
    await sendSms(creds!, "+447700900777", "API key check");
    assert.equal(twilioAuth.at(-1), `Basic ${Buffer.from("SKgatewaykey:gateway-secret").toString("base64")}`);
    const res = await smsRoute(twilioPost(`/api/gateway/${installationId}/sms`, { From: "+447700900888", Body: "Hi", MessageSid: "SMkey1", AccountSid: process.env.TWILIO_ACCOUNT_SID! }), params());
    assert.equal(res.status, 200, "the webhook is still verified with the auth token");
  } finally {
    delete process.env.TWILIO_API_KEY_SID;
    delete process.env.TWILIO_API_KEY_SECRET;
  }
});
