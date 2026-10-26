import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

process.env.AUTH_SECRET ??= "test-secret-for-sealing-0123456789";

import { GATEWAY_TOOLS } from "./gateway/agent";
import { normalisePhone } from "./gateway/directory";
import { looksLikeEmergency } from "./gateway/emergency";
import { readGatewaySettings } from "./gateway/settings";
import { escapeXml, twilioSignatureValid } from "./gateway/twilio";
import { readPeakSettings } from "./peak/settings";
import { seal, unseal } from "./seal";

test("emergencies are spotted, ordinary messages are not", () => {
  for (const t of ["Mum has fallen and can't get up", "he's not breathing", "Call an ambulance", "I want to report a safeguarding concern", "chest pain", "There's a fire in the kitchen"]) {
    assert.equal(looksLikeEmergency(t), true, t);
  }
  for (const t of ["I can't make my shift tomorrow, I'm sick", "Can we get a nurse for Friday night?", "What are your office hours?"]) {
    assert.equal(looksLikeEmergency(t), false, t);
  }
});

test("phone numbers normalise to E.164", () => {
  assert.equal(normalisePhone("07700 900123"), "+447700900123");
  assert.equal(normalisePhone("+44 7700 900123"), "+447700900123");
  assert.equal(normalisePhone("0044 7700 900123"), "+447700900123");
  assert.equal(normalisePhone("call me"), null);
  assert.equal(normalisePhone(undefined), null);
});

test("Twilio signatures are checked over the URL and sorted params", () => {
  const token = "12345678901234567890123456789012";
  const url = "https://canvas.example/api/gateway/abc/sms";
  const params = { Body: "Hi", From: "+447700900123", To: "+441234567890" };
  const sig = createHmac("sha1", token).update(url + "BodyHiFrom+447700900123To+441234567890").digest("base64");
  assert.equal(twilioSignatureValid(token, url, params, sig), true);
  assert.equal(twilioSignatureValid(token, url, { ...params, Body: "Changed" }, sig), false);
  assert.equal(twilioSignatureValid(token, `${url}?x=1`, params, sig), false);
  assert.equal(twilioSignatureValid(token, url, params, null), false);
});

test("sealed credentials round-trip and reject tampering", async () => {
  const sealed = await seal("secret-token");
  assert.notEqual(sealed, "secret-token");
  assert.equal(await unseal(sealed), "secret-token");
  const [v, iv, tag, data] = sealed.split(".");
  assert.equal(await unseal([v, iv, tag, data.slice(0, -2) + (data.endsWith("A") ? "B" : "A") + data.slice(-1)].join(".")), null);
  assert.equal(await unseal("junk"), null);
});

test("TwiML text is escaped", () => {
  assert.equal(escapeXml(`<Say>"Tom" & 'Jerry'</Say>`), "&lt;Say&gt;&quot;Tom&quot; &amp; &apos;Jerry&apos;&lt;/Say&gt;");
});

test("tool inputs are validated before they run", () => {
  assert.equal(GATEWAY_TOOLS.hand_over.schema.safeParse({ reason: "Wants a person", urgent: true }).success, true);
  assert.equal(GATEWAY_TOOLS.hand_over.schema.safeParse({ reason: "Wants a person" }).success, false);
  assert.equal(GATEWAY_TOOLS.take_message.schema.safeParse({ name: "Sam", contact: "", for_whom: "", message: "" }).success, false);
  assert.equal(GATEWAY_TOOLS.take_enquiry.schema.safeParse({ name: "Sam", contact: "", organisation: "", topic: "Home care", details: "For my dad" }).success, true);
  assert.deepEqual(Object.keys(GATEWAY_TOOLS).sort(), ["close_conversation", "hand_over", "take_enquiry", "take_message"]);
});

test("settings fall back to safe defaults", () => {
  assert.deepEqual(readPeakSettings({ peak: { shift: 20 } }).shift, 20);
  assert.equal(readPeakSettings(null).pointValuePence, 1);
  assert.equal(readPeakSettings({ peak: { shift: -5 } }).shift, 10);
  assert.equal(readGatewaySettings({}).webchat, true);
  assert.equal(readGatewaySettings({ gateway: { twilio: { accountSid: "AC1" } } }).twilio.phoneNumber, "");
});
