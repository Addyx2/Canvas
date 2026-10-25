import { z } from "zod";

import { authenticateClient } from "./oidc";

// The API products call to keep Workspace up to date, authenticated with the
// same client ID and secret they use to sign people in.

export async function productClient(request: Request) {
  const client = await authenticateClient(request, new URLSearchParams());
  return client && client.product !== "workspace" ? client : null;
}

export const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const membershipSchema = z.object({
  sub: z.string().min(1).max(64),
  orgId: z.string().trim().min(1).max(200),
  orgName: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(60),
});

export const membershipRemovalSchema = z.object({
  sub: z.string().min(1).max(64),
  orgId: z.string().trim().min(1).max(200),
});

const safeUrl = z
  .string()
  .url()
  .max(500)
  .refine((u) => /^https?:\/\//.test(u), "Must be an http(s) address");

export const activitySchema = z.object({
  orgId: z.string().trim().min(1).max(200),
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(200),
        kind: z.string().trim().min(1).max(40),
        title: z.string().trim().min(1).max(200),
        detail: z.string().trim().max(500).optional(),
        url: safeUrl.optional(),
        roles: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
        occurredAt: z.coerce.date(),
      }),
    )
    .min(1)
    .max(50),
});
