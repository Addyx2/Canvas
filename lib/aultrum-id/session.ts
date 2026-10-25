import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/db";
import { authSecret } from "@/lib/secret";

import { ID_SESSION_COOKIE, WORKSPACE_SESSION_COOKIE, workspaceUrl } from "./hosts";

// Two signed cookies, each only on its own host: the Aultrum ID session
// (id.aultrum.co.uk) and the Workspace session (workspace.aultrum.co.uk).
// Each holds `${identityId}.${sessionVersion}.${expires}.${signature}`;
// bumping Identity.sessionVersion signs the person out everywhere.

const TTL_MS: Record<Purpose, number> = { id: 1000 * 60 * 60 * 24 * 14, workspace: 1000 * 60 * 60 * 24 * 7 };
type Purpose = "id" | "workspace";
const COOKIE: Record<Purpose, string> = { id: ID_SESSION_COOKIE, workspace: WORKSPACE_SESSION_COOKIE };

const sign = (purpose: Purpose, payload: string) =>
  createHmac("sha256", authSecret()).update(`aultrum-${purpose}.${payload}`).digest("base64url");

export function createIdentitySession(purpose: Purpose, identityId: string, version: number, now = Date.now()): string {
  const payload = `${identityId}.${version}.${now + TTL_MS[purpose]}`;
  return `${payload}.${sign(purpose, payload)}`;
}

export function readIdentitySession(purpose: Purpose, token: string | undefined | null, now = Date.now()) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [identityId, versionRaw, expiresRaw, signature] = parts;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(purpose, `${identityId}.${versionRaw}.${expiresRaw}`));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!(Number(expiresRaw) > now) || !Number.isInteger(Number(versionRaw))) return null;
  return { identityId, version: Number(versionRaw) };
}

export async function startSession(purpose: Purpose, identity: { id: string; sessionVersion: number }) {
  (await cookies()).set(COOKIE[purpose], createIdentitySession(purpose, identity.id, identity.sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS[purpose] / 1000,
  });
}

export async function endSession(purpose: Purpose) {
  (await cookies()).delete(COOKIE[purpose]);
}

/** The signed-in identity for this host's session, or null. */
export const currentIdentity = cache(async (purpose: Purpose) => {
  const session = readIdentitySession(purpose, (await cookies()).get(COOKIE[purpose])?.value);
  if (!session) return null;
  const identity = await prisma.identity.findUnique({ where: { id: session.identityId } });
  if (!identity || identity.sessionVersion !== session.version) return null;
  return identity;
});

/** Workspace pages: the signed-in identity, or off to sign in. */
export async function requireWorkspaceIdentity() {
  const identity = await currentIdentity("workspace");
  // Absolute, so a client-side navigation does a full load of the sign-in route.
  if (!identity) redirect(`${workspaceUrl()}/signin`);
  return identity;
}
