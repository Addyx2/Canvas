import { createHmac, timingSafeEqual } from "node:crypto";

// Webhooks to platforms carry `Canvas-Signature: t=<unix seconds>,v1=<hex>`,
// where v1 = HMAC-SHA256(webhookSecret, "<t>.<raw body>"). Platforms reject
// signatures older than the tolerance to stop replays.
export const SIGNATURE_HEADER = "Canvas-Signature";
const TOLERANCE_SECONDS = 300;

export function signWebhook(body: string, secret: string, now = Date.now()): string {
  const t = Math.floor(now / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

export function verifyWebhook(body: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1) return false;
  if (Math.abs(Math.floor(now / 1000) - t) > TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"));
  const given = Buffer.from(parts.v1);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
