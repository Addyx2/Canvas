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

/** Who signs a request to Twilio: an API key (SK...) when there is one, else the account and its auth token. */
export interface TwilioAuth {
  accountSid: string;
  authToken: string;
  apiKeySid?: string;
  apiKeySecret?: string;
}

export function twilioAuthHeader(s: TwilioAuth): string {
  const [user, pass] = s.apiKeySid && s.apiKeySecret ? [s.apiKeySid, s.apiKeySecret] : [s.accountSid, s.authToken];
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

const apiBase = () => process.env.TWILIO_API_BASE ?? "https://api.twilio.com";

/** Send a text through the installation's own Twilio number. */
export async function sendSms(creds: TwilioCredentials, to: string, body: string): Promise<void> {
  const res = await fetch(`${apiBase()}/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: twilioAuthHeader(creds),
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

export type ConnectResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Points the number's incoming calls and texts at Gateway, so nobody has to
 * copy webhook addresses into Twilio. Also proves the credentials work.
 */
export async function connectNumber(creds: TwilioCredentials, urls: { voice: string; sms: string }): Promise<ConnectResult> {
  const auth = twilioAuthHeader(creds);
  const base = `${apiBase()}/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/IncomingPhoneNumbers`;
  try {
    const list = await fetch(`${base}.json?${new URLSearchParams({ PhoneNumber: creds.phoneNumber })}`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(10000) });
    if (list.status === 401 || list.status === 403) return { ok: false, message: "Twilio didn't accept the Account SID and auth token. Check both in your Twilio console." };
    if (!list.ok) return { ok: false, message: `Twilio answered ${list.status}. Try saving again in a minute.` };
    const numbers = ((await list.json()) as { incoming_phone_numbers?: { sid: string }[] }).incoming_phone_numbers ?? [];
    if (numbers.length === 0) return { ok: false, message: `${creds.phoneNumber} isn't a number in this Twilio account.` };
    const update = await fetch(`${base}/${encodeURIComponent(numbers[0].sid)}.json`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ VoiceUrl: urls.voice, VoiceMethod: "POST", SmsUrl: urls.sms, SmsMethod: "POST" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!update.ok) return { ok: false, message: `Twilio wouldn't update ${creds.phoneNumber} (${update.status}).` };
    return { ok: true, message: `Connected: calls and texts to ${creds.phoneNumber} now come to Gateway.` };
  } catch {
    return { ok: false, message: "Couldn't reach Twilio. Try saving again in a minute." };
  }
}

const NUMBERS_BASE = () => (process.env.TWILIO_NUMBERS_API_BASE ?? process.env.TWILIO_API_BASE ?? "https://numbers.twilio.com").replace(/\/+$/, "");

async function twilioJson<T>(url: string, s: TwilioAuth, form?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: form ? "POST" : "GET",
    headers: { Authorization: twilioAuthHeader(s), ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(json.message ?? `Twilio answered ${res.status}`);
  return json;
}

/** The account's approved UK mobile regulatory bundle and the address in it, found through Twilio's API. */
export async function ukMobileBundle(s: TwilioAuth): Promise<{ bundleSid: string; addressSid?: string } | null> {
  const set = process.env.TWILIO_BUNDLE_SID?.trim();
  if (set) return { bundleSid: set, addressSid: process.env.TWILIO_ADDRESS_SID?.trim() || undefined };
  const list = await twilioJson<{ results?: { sid: string }[] }>(`${NUMBERS_BASE()}/v2/RegulatoryCompliance/Bundles?Status=twilio-approved&IsoCountry=GB&NumberType=mobile&PageSize=20`, s);
  const bundleSid = list.results?.[0]?.sid;
  if (!bundleSid) return null;
  const items = await twilioJson<{ results?: { object_sid: string }[] }>(`${NUMBERS_BASE()}/v2/RegulatoryCompliance/Bundles/${bundleSid}/ItemAssignments?PageSize=50`, s).catch(() => ({ results: [] as { object_sid: string }[] }));
  let addressSid = items.results?.find((i) => i.object_sid.startsWith("AD"))?.object_sid;
  if (!addressSid) {
    const a = await twilioJson<{ addresses?: { sid: string }[] }>(`${apiBase()}/2010-04-01/Accounts/${encodeURIComponent(s.accountSid)}/Addresses.json?IsoCountry=GB&PageSize=20`, s).catch(() => ({ addresses: [] as { sid: string }[] }));
    addressSid = a.addresses?.[0]?.sid;
  }
  return { bundleSid, addressSid };
}

/** Buys a UK mobile number for calls and texts, already pointed at Gateway. */
export async function buyUkMobile(s: TwilioAuth, opts: { friendlyName: string; voiceUrl: string; smsUrl: string; bundleSid: string; addressSid?: string }): Promise<{ sid: string; number: string }> {
  const account = `${apiBase()}/2010-04-01/Accounts/${encodeURIComponent(s.accountSid)}`;
  const found = await twilioJson<{ available_phone_numbers?: { phone_number: string }[] }>(`${account}/AvailablePhoneNumbers/GB/Mobile.json?SmsEnabled=true&VoiceEnabled=true&PageSize=5`, s);
  const number = found.available_phone_numbers?.[0]?.phone_number;
  if (!number) throw new Error("Twilio has no UK mobile numbers available to buy right now");
  const bought = await twilioJson<{ sid: string; phone_number: string }>(`${account}/IncomingPhoneNumbers.json`, s, {
    PhoneNumber: number,
    FriendlyName: opts.friendlyName.slice(0, 64),
    VoiceUrl: opts.voiceUrl,
    VoiceMethod: "POST",
    SmsUrl: opts.smsUrl,
    SmsMethod: "POST",
    BundleSid: opts.bundleSid,
    ...(opts.addressSid ? { AddressSid: opts.addressSid } : {}),
  });
  return { sid: bought.sid, number: bought.phone_number };
}
