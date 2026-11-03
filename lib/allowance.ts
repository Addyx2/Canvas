import { randomUUID } from "node:crypto";

import { clientAssertion } from "./canvas-key";

// Gateway spends from the organisation's Allowance in Aultrum Workspace
// (1 credit = 1p): call minutes, texts, AI replies and the number each month.
// Aultrum ID keeps the balance and the prices; Elements asks before each
// action, signing its requests with its own key (client aid_canvas). When
// the answer is no, Gateway pauses; if Aultrum ID can't be reached, Gateway
// carries on rather than miss an enquiry, and the miss is logged.

const live = process.env.NODE_ENV === "production" && process.env.AULTRUM_LOCAL !== "1";
const issuer = () => (process.env.AULTRUM_ID_URL ?? (live ? "https://id.aultrum.co.uk" : "")).replace(/\/+$/, "");
const CLIENT_ID = "aid_canvas";

export type GatewayAction = "call_minute" | "sms_out" | "sms_in" | "chat_turn" | "number_month";
export type Charge = { ok: true; enforced: boolean } | { ok: false; reason: "empty" | "no_plan"; message: string };

export const textParts = (body: string) => (body.length <= 160 ? 1 : Math.ceil(body.length / 153));

async function api<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; json: T } | null> {
  if (!issuer()) return null;
  try {
    const res = await fetch(`${issuer()}/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${await clientAssertion(CLIENT_ID, `${issuer()}/api/v1`)}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(6_000),
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as T };
  } catch (error) {
    console.error(JSON.stringify({ event: "allowance_api_failed", path, error: String(error) }));
    return null;
  }
}

export interface Org {
  id: string;
  name: string;
}

export async function chargeAllowance(org: Org, action: GatewayAction, quantity = 1, key: string = randomUUID()): Promise<Charge> {
  const res = await api<{ enforced?: boolean; reason?: "empty" | "no_plan"; message?: string; error?: string }>("POST", "/allowance/spend", { orgId: org.id, orgName: org.name, action, quantity, key: `${org.id}:${key}` });
  if (res?.status === 402 && res.json.reason) {
    console.log(JSON.stringify({ event: "gateway_allowance_refused", orgId: org.id, action, reason: res.json.reason }));
    return { ok: false, reason: res.json.reason, message: res.json.message ?? "The Allowance has run out." };
  }
  if (!res || res.status !== 200) {
    console.error(JSON.stringify({ event: "gateway_allowance_unreachable", orgId: org.id, action, status: res?.status ?? null, error: res?.json.error ?? null }));
    return { ok: true, enforced: false };
  }
  return { ok: true, enforced: !!res.json.enforced };
}

export interface AllowanceView {
  enforced: boolean;
  balance: number;
  plan: string;
  planStatus: string;
  covered: boolean;
  autoTopUp: boolean;
  manageUrl: string;
  prices: { action: string; credits: number; label: string; unit: string }[];
  packs: { key: string; credits: number; pence: number }[];
  plans: { key: string; name: string; pence: number; credits: number; line: string }[];
}

export async function allowanceView(org: Org): Promise<AllowanceView | null> {
  const res = await api<AllowanceView>("GET", `/allowance?${new URLSearchParams({ orgId: org.id, orgName: org.name })}`);
  return res?.status === 200 ? res.json : null;
}

export async function allowanceCheckout(org: Org, choice: { pack?: string; plan?: string }, returnUrl: string, email?: string): Promise<{ url: string } | { error: string }> {
  const res = await api<{ url?: string; error?: string }>("POST", "/allowance/checkout", { orgId: org.id, orgName: org.name, ...choice, returnUrl, email });
  if (res?.status === 200 && res.json.url) return { url: res.json.url };
  return { error: res?.json.error ?? "Payments couldn't be reached. Try again shortly." };
}
