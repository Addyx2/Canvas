import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { hashSecret } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { authSecret } from "@/lib/secret";

import { workspaceUrl } from "./hosts";

export const WORKSPACE_CLIENT_ID = "aid_workspace";

/** Workspace signs in through Aultrum ID like any product. Its client is created on first use. */
export async function workspaceClient() {
  const redirectUri = `${workspaceUrl()}/callback`;
  return prisma.oAuthClient.upsert({
    where: { clientId: WORKSPACE_CLIENT_ID },
    // Workspace redeems codes in-process, so this secret is never used.
    create: {
      clientId: WORKSPACE_CLIENT_ID,
      secretHash: hashSecret(randomBytes(32).toString("hex")),
      name: "Aultrum Workspace",
      product: "workspace",
      redirectUris: [redirectUri],
      postLogoutRedirectUris: [workspaceUrl()],
    },
    update: { redirectUris: [redirectUri], postLogoutRedirectUris: [workspaceUrl()] },
  });
}

export interface PendingSignIn {
  state: string;
  verifier: string;
  nonce: string;
  exp: number;
}

const mac = (data: string) => createHmac("sha256", authSecret()).update(`aultrum-ws-state.${data}`).digest("base64url");

export function newPendingSignIn(now = Date.now()): { pending: PendingSignIn; cookie: string; challenge: string } {
  const pending = {
    state: randomBytes(16).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    exp: now + 10 * 60_000,
  };
  const data = Buffer.from(JSON.stringify(pending)).toString("base64url");
  return {
    pending,
    cookie: `${data}.${mac(data)}`,
    challenge: createHash("sha256").update(pending.verifier).digest("base64url"),
  };
}

export function readPendingSignIn(cookie: string | undefined, now = Date.now()): PendingSignIn | null {
  if (!cookie) return null;
  const [data, signature] = cookie.split(".");
  if (!data || !signature) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(mac(data));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const pending = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as PendingSignIn;
    return pending.exp > now ? pending : null;
  } catch {
    return null;
  }
}

export interface ProductInfo {
  key: string;
  name: string;
  line: string;
  /** Shown when the product doesn't sign in with Aultrum ID yet. */
  fallback?: { label: string; href: string };
}

export const PRODUCTS: ProductInfo[] = [
  { key: "pleasant", name: "Pleasant", line: "Care staffing: shifts, carers, timesheets, payroll and invoicing." },
  {
    key: "canvas",
    name: "Canvas",
    line: "The console for Persona and Elements in your own systems.",
    fallback: { label: "Open Canvas (its own sign-in for now)", href: "https://canvas.aultrum.co.uk/login" },
  },
  { key: "flowstate", name: "Flowstate", line: "Full care operations for home care providers." },
  { key: "tender", name: "Tender", line: "NHS discharge to assess, from referral to placement." },
];
