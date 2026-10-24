import assert from "node:assert/strict";
import { test } from "node:test";

import { hashSecret, parseBasicAuth, parseOrigins, secretMatches } from "./credentials";
import { frameAncestors, signEmbedToken, verifyEmbedToken } from "./embed-token";
import { acceptsEvent, MODULES } from "./modules";
import { signWebhook, verifyWebhook } from "./webhook-signature";

const SECRET = "test-secret-0123456789abcdef";
const claims = { ins: "ins_1", mod: "gateway", sub: "user_1", name: "Amara", origins: ["https://pleasant.aultrum.co.uk"] };

test("embed tokens round-trip and carry their claims", async () => {
  const token = await signEmbedToken(claims, SECRET);
  const verified = await verifyEmbedToken(token, SECRET);
  assert.equal(verified?.ins, "ins_1");
  assert.deepEqual(verified?.origins, claims.origins);
});

test("embed tokens reject tampering, the wrong secret and expiry", async () => {
  const token = await signEmbedToken(claims, SECRET, 60, 1_000_000_000_000);
  const [body, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...claims, ins: "ins_2", exp: 9_999_999_999 })).toString("base64url");
  assert.equal(await verifyEmbedToken(`${forged}.${sig}`, SECRET, 1_000_000_000_000), null);
  assert.equal(await verifyEmbedToken(token, "another-secret-0123456789", 1_000_000_000_000), null);
  assert.equal(await verifyEmbedToken(token, SECRET, 1_000_000_000_000 + 61_000), null);
  assert.equal(await verifyEmbedToken(`${body}.${sig}.extra`, SECRET), null);
  assert.equal(await verifyEmbedToken("", SECRET), null);
});

test("frame-ancestors only lists clean origins", () => {
  assert.equal(frameAncestors([]), "frame-ancestors 'none'");
  assert.equal(
    frameAncestors(["https://pleasant.aultrum.co.uk", "javascript:alert(1)", "https://x.com; script-src *"]),
    "frame-ancestors https://pleasant.aultrum.co.uk",
  );
});

test("webhook signatures verify, and reject tampering and replays", () => {
  const body = JSON.stringify({ type: "gateway.call.completed" });
  const now = 1_700_000_000_000;
  const header = signWebhook(body, SECRET, now);
  assert.equal(verifyWebhook(body, header, SECRET, now), true);
  assert.equal(verifyWebhook(body + " ", header, SECRET, now), false);
  assert.equal(verifyWebhook(body, header, "wrong-secret-0123456789", now), false);
  assert.equal(verifyWebhook(body, header, SECRET, now + 10 * 60_000), false);
  assert.equal(verifyWebhook(body, null, SECRET, now), false);
});

test("client credentials: basic auth parsing and secret hashing", () => {
  const header = `Basic ${Buffer.from("cv_live_abc:cvs_secret:with:colons").toString("base64")}`;
  assert.deepEqual(parseBasicAuth(header), { clientId: "cv_live_abc", secret: "cvs_secret:with:colons" });
  assert.equal(parseBasicAuth("Bearer x"), null);
  assert.equal(parseBasicAuth(`Basic ${Buffer.from("nocolon").toString("base64")}`), null);
  assert.equal(secretMatches("cvs_secret", hashSecret("cvs_secret")), true);
  assert.equal(secretMatches("cvs_other", hashSecret("cvs_secret")), false);
});

test("origins are normalised and unsafe ones rejected", () => {
  const { origins, invalid } = parseOrigins(
    "https://pleasant.aultrum.co.uk/\nhttps://pleasant.aultrum.co.uk\nhttp://localhost:3100\nhttp://evil.com\nhttps://x.com/path\nnot a url",
  );
  assert.deepEqual(origins, ["https://pleasant.aultrum.co.uk", "http://localhost:3100"]);
  assert.deepEqual(invalid, ["http://evil.com", "https://x.com/path", "not", "a", "url"]);
});

test("module manifests are well formed", () => {
  const keys = MODULES.map((m) => m.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const m of MODULES) {
    assert.ok(m.embedPath.startsWith("/embed/"), m.key);
    for (const e of [...m.emits]) assert.ok(e.type.startsWith(`${m.key}.`), `${m.key} emits ${e.type}`);
    for (const e of m.consumes) assert.ok(e.type.startsWith("platform."), `${m.key} consumes ${e.type}`);
  }
  assert.equal(acceptsEvent("gateway", "platform.shift.assigned"), true);
  assert.equal(acceptsEvent("gateway", "platform.clock.in"), false);
  assert.equal(acceptsEvent("nope", "platform.shift.assigned"), false);
});
