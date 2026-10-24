// Short-lived tokens that let a platform show a module screen inside its own
// app. Signed with HMAC-SHA256 using Web Crypto, so both the API (Node) and
// middleware (Edge) can create and check them.
import { EMBED_TOKEN_TTL_SECONDS } from "./constants";

export interface EmbedClaims {
  /** Installation ID. */
  ins: string;
  /** Module key. */
  mod: string;
  /** The platform's user, for display and audit. */
  sub: string;
  name: string;
  /** Origins allowed to frame the screen. */
  origins: string[];
  /** Expiry, seconds since epoch. */
  exp: number;
}

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signEmbedToken(
  claims: Omit<EmbedClaims, "exp">,
  secret: string,
  ttlSeconds = EMBED_TOKEN_TTL_SECONDS,
  now = Date.now(),
): Promise<string> {
  const body = base64url(encoder.encode(JSON.stringify({ ...claims, exp: Math.floor(now / 1000) + ttlSeconds })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(body)));
  return `${body}.${base64url(sig)}`;
}

export async function verifyEmbedToken(
  token: string | null | undefined,
  secret: string,
  now = Date.now(),
): Promise<EmbedClaims | null> {
  if (!token) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromBase64url(sig), encoder.encode(body));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as EmbedClaims;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < now) return null;
    if (!Array.isArray(claims.origins) || typeof claims.ins !== "string" || typeof claims.mod !== "string") return null;
    return claims;
  } catch {
    return null;
  }
}

/** CSP frame-ancestors for an embed: only the platform's own origins. */
export function frameAncestors(origins: string[]): string {
  const safe = origins.filter((o) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o));
  return safe.length > 0 ? `frame-ancestors ${safe.join(" ")}` : "frame-ancestors 'none'";
}
