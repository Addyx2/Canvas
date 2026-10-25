import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { OAuthClient } from "@prisma/client";

import { hashSecret, parseBasicAuth, secretMatches } from "@/lib/credentials";
import { prisma } from "@/lib/db";

import { idUrl } from "./hosts";

export const CODE_TTL_MS = 60_000;
export const SUPPORTED_SCOPES = ["openid", "profile", "email"];

export interface AuthorizeRequest {
  client: OAuthClient;
  redirectUri: string;
  state: string;
  nonce: string | null;
  codeChallenge: string;
  scope: string;
}

export type AuthorizeCheck =
  | { ok: true; request: AuthorizeRequest }
  // Unsafe to redirect (unknown client or redirect URI): show the error.
  | { ok: false; show: string }
  // The client and redirect are trusted: send the error back to the product.
  | { ok: false; redirect: string };

/**
 * Validates an OpenID Connect authorization request: authorization code flow
 * with PKCE (S256) only, exact redirect URI match, and the openid scope.
 */
export function checkAuthorize(params: URLSearchParams, client: OAuthClient | null): AuthorizeCheck {
  const redirectUri = params.get("redirect_uri") ?? "";
  if (!client || client.revokedAt) return { ok: false, show: "This app isn't registered with Aultrum ID." };
  if (!client.redirectUris.includes(redirectUri)) return { ok: false, show: "This sign-in link has an address Aultrum ID doesn't recognise." };

  const state = params.get("state") ?? "";
  const back = (error: string, description: string) => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    url.searchParams.set("error_description", description);
    if (state) url.searchParams.set("state", state);
    return { ok: false as const, redirect: url.toString() };
  };
  if (params.get("response_type") !== "code") return back("unsupported_response_type", "Only response_type=code is supported");
  const scopes = (params.get("scope") ?? "").split(/\s+/).filter(Boolean);
  if (!scopes.includes("openid")) return back("invalid_scope", "The openid scope is required");
  const challenge = params.get("code_challenge") ?? "";
  if (params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    return back("invalid_request", "PKCE with S256 is required");
  }
  if (!state) return back("invalid_request", "state is required");
  return {
    ok: true,
    request: {
      client,
      redirectUri,
      state,
      nonce: params.get("nonce")?.slice(0, 200) || null,
      codeChallenge: challenge,
      scope: scopes.filter((s) => SUPPORTED_SCOPES.includes(s)).join(" "),
    },
  };
}

/** Issues a one-time code and returns the URL that hands it to the product. */
export async function issueCode(request: AuthorizeRequest, identityId: string): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  await prisma.authCode.create({
    data: {
      codeHash: hashSecret(code),
      clientId: request.client.id,
      identityId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      nonce: request.nonce,
      scope: request.scope,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  const url = new URL(request.redirectUri);
  url.searchParams.set("code", code);
  url.searchParams.set("state", request.state);
  url.searchParams.set("iss", idUrl());
  return url.toString();
}

export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const a = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Client authentication at the token endpoint: HTTP Basic or form fields. */
export async function authenticateClient(request: Request, form: URLSearchParams): Promise<OAuthClient | null> {
  const basic = parseBasicAuth(request.headers.get("authorization"));
  const clientId = basic?.clientId ?? form.get("client_id") ?? "";
  const secret = basic?.secret ?? form.get("client_secret") ?? "";
  if (!clientId || !secret) return null;
  const client = await prisma.oAuthClient.findUnique({ where: { clientId: decodeURIComponent(clientId) } });
  if (!client || client.revokedAt || !secretMatches(decodeURIComponent(secret), client.secretHash)) return null;
  return client;
}

/**
 * Redeems a code: it must exist, belong to this client, match the redirect
 * URI and PKCE verifier, be unexpired and unused. Single use, enforced by a
 * conditional update.
 */
export async function redeemCode(client: OAuthClient, code: string, redirectUri: string, verifier: string) {
  const row = await prisma.authCode.findUnique({ where: { codeHash: hashSecret(code) }, include: { identity: true } });
  if (!row || row.clientId !== client.id || row.redirectUri !== redirectUri || row.expiresAt < new Date()) return null;
  if (!pkceMatches(verifier, row.codeChallenge)) return null;
  const used = await prisma.authCode.updateMany({ where: { codeHash: row.codeHash, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count === 0) return null;
  return row;
}
