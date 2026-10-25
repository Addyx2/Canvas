import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import type { OAuthClient } from "@prisma/client";

import { clientRecord, envClients } from "./clients";
import { hostKind } from "./hosts";
import { checkAuthorize, pkceMatches } from "./oidc";
import { createIdentitySession, readIdentitySession } from "./session";
import { newPendingSignIn, readPendingSignIn } from "./workspace";

const client = {
  id: "c1",
  clientId: "aid_pleasant",
  redirectUris: ["https://pleasant.example/api/auth/aultrum/callback"],
  revokedAt: null,
} as unknown as OAuthClient;

const verifier = "v".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const good = () =>
  new URLSearchParams({
    response_type: "code",
    client_id: "aid_pleasant",
    redirect_uri: client.redirectUris[0],
    scope: "openid email profile offline_access",
    state: "s1",
    nonce: "n1",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

test("hostKind routes the ID and Workspace hosts", () => {
  assert.equal(hostKind("id.localhost:3200"), "id");
  assert.equal(hostKind("WORKSPACE.localhost:3200"), "workspace");
  assert.equal(hostKind("canvas.aultrum.co.uk"), "canvas");
  assert.equal(hostKind(null), "canvas");
});

test("checkAuthorize accepts a well-formed PKCE request and keeps supported scopes", () => {
  const check = checkAuthorize(good(), client);
  assert.ok(check.ok);
  if (check.ok) {
    assert.equal(check.request.scope, "openid email profile");
    assert.equal(check.request.nonce, "n1");
  }
});

test("checkAuthorize never redirects to an unregistered address", () => {
  const p = good();
  p.set("redirect_uri", "https://evil.example/callback");
  assert.deepEqual(checkAuthorize(p, client), { ok: false, show: "This sign-in link has an address Aultrum ID doesn't recognise." });
  assert.ok("show" in (checkAuthorize(good(), null) as object));
  assert.ok("show" in (checkAuthorize(good(), { ...client, revokedAt: new Date() } as OAuthClient) as object));
});

test("checkAuthorize sends protocol errors back to the registered address", () => {
  for (const [key, value] of [
    ["code_challenge_method", "plain"],
    ["response_type", "token"],
    ["scope", "email"],
    ["state", ""],
  ]) {
    const p = good();
    p.set(key, value);
    const check = checkAuthorize(p, client);
    assert.ok(!check.ok && "redirect" in check, key);
    if (!check.ok && "redirect" in check) assert.ok(check.redirect.startsWith(client.redirectUris[0]));
  }
});

test("pkceMatches checks the S256 challenge", () => {
  assert.ok(pkceMatches(verifier, challenge));
  assert.ok(!pkceMatches("w".repeat(43), challenge));
  assert.ok(!pkceMatches("short", challenge));
});

test("identity sessions are signed per purpose and expire", () => {
  const token = createIdentitySession("id", "ident1", 2, 1_000);
  assert.deepEqual(readIdentitySession("id", token, 2_000), { identityId: "ident1", version: 2 });
  assert.equal(readIdentitySession("workspace", token, 2_000), null);
  assert.equal(readIdentitySession("id", token.replace("ident1", "ident2"), 2_000), null);
  assert.equal(readIdentitySession("id", token, 1_000 + 1000 * 60 * 60 * 24 * 15), null);
});

test("Workspace's pending sign-in cookie is tamper-proof", () => {
  const { pending, cookie, challenge: c } = newPendingSignIn(1_000);
  assert.deepEqual(readPendingSignIn(cookie, 2_000), pending);
  assert.equal(c, createHash("sha256").update(pending.verifier).digest("base64url"));
  assert.equal(readPendingSignIn(cookie, 1_000 + 11 * 60_000), null);
  const [data, sig] = cookie.split(".");
  assert.equal(readPendingSignIn(`${data}x.${sig}`, 2_000), null);
});

test("envClients reads AULTRUM_ID_CLIENT_<PRODUCT> as address|secret and skips bad entries", () => {
  const secret = "s".repeat(32);
  assert.deepEqual(
    envClients({
      AULTRUM_ID_CLIENT_PLEASANT: `https://pleasant.aultrum.co.uk/|${secret}`,
      AULTRUM_ID_CLIENT_SHORT: "https://short.example|abc",
      AULTRUM_ID_CLIENT_PLAIN: `http://evil.example|${secret}`,
      AULTRUM_ID_CLIENT_WORKSPACE: `https://ws.example|${secret}`,
      AULTRUM_ID_CLIENT_PATH: `https://x.example/app|${secret}`,
      AULTRUM_ID_URL: "https://id.aultrum.co.uk",
    }),
    [{ product: "pleasant", app: "https://pleasant.aultrum.co.uk", secret }],
  );
  assert.deepEqual(clientRecord("pleasant", "Pleasant", "https://p.example/").redirectUris, ["https://p.example/api/auth/aultrum/callback"]);
});
