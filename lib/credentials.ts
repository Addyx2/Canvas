import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Platform credentials. The client secret is shown once and only its hash is stored.

export function newClientId(): string {
  return `cv_live_${randomBytes(9).toString("base64url")}`;
}

export function newSecret(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function secretMatches(secret: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(secret));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Parse `Authorization: Basic base64(clientId:secret)`. */
export function parseBasicAuth(header: string | null): { clientId: string; secret: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (i <= 0) return null;
    return { clientId: decoded.slice(0, i), secret: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

/** Normalise an origin list from a textarea: one per line, scheme + host (+ port) only. */
export function parseOrigins(text: string): { origins: string[]; invalid: string[] } {
  const origins: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)) {
    try {
      const url = new URL(raw);
      const ok = url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost");
      if (!ok || url.pathname !== "/" || url.search || url.hash || url.username) invalid.push(raw);
      else if (!origins.includes(url.origin)) origins.push(url.origin);
    } catch {
      invalid.push(raw);
    }
  }
  return { origins, invalid };
}
