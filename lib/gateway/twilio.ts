import { createHmac, timingSafeEqual } from "node:crypto";

import type { TwilioCredentials } from "./settings";

/**
 * Twilio signs each webhook: HMAC-SHA1 of the full URL followed by every
 * POST parameter (sorted by name, name then value), base64 encoded.
 */
export function twilioSignatureValid(authToken: string, url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function readTwilioForm(request: Request): Promise<Record<string, string>> {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  return params;
}

const API_BASE = process.env.TWILIO_API_BASE ?? "https://api.twilio.com";

/** Send a text through the installation's own Twilio number. */
export async function sendSms(creds: TwilioCredentials, to: string, body: string): Promise<void> {
  const res = await fetch(`${API_BASE}/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: creds.phoneNumber, Body: body.slice(0, 1500) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Twilio answered ${res.status}`);
}

export function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

export function twiml(inner: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}
