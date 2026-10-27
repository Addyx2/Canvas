import { headers } from "next/headers";

import { prisma } from "./db";

// Fixed-window limits kept in Postgres, so they hold across serverless instances.

export interface Limit {
  /** Most attempts allowed in the window. */
  max: number;
  windowSeconds: number;
}

export const LIMITS = {
  login: { max: 10, windowSeconds: 15 * 60 },
  signup: { max: 5, windowSeconds: 60 * 60 },
  resetRequest: { max: 5, windowSeconds: 60 * 60 },
  resetPerEmail: { max: 3, windowSeconds: 60 * 60 },
  verifyResend: { max: 3, windowSeconds: 60 * 60 },
  tokenUse: { max: 20, windowSeconds: 15 * 60 },
  webchat: { max: 40, windowSeconds: 10 * 60 },
} satisfies Record<string, Limit>;

/** Counts an attempt; returns false once `key` is over its limit for this window. */
export async function allow(key: string, limit: Limit): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${limit.windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN now() + make_interval(secs => ${limit.windowSeconds}) ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  return (rows[0]?.count ?? 0) <= limit.max;
}

/** The caller's IP address, as Vercel reports it. */
export async function clientIp(): Promise<string> {
  return ipFrom(await headers());
}

export function ipFrom(h: Headers): string {
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
