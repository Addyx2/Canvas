import { randomBytes } from "node:crypto";

import { prisma } from "./db";

let cached: Promise<string> | null = null;

/**
 * The signing secret for sessions and embed tokens: AUTH_SECRET when set,
 * otherwise one Canvas makes on first start and keeps in its database. Safe
 * when several servers start at once: the first write wins.
 */
export function authSecret(): Promise<string> {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return Promise.resolve(fromEnv);
  cached ??= (async () => {
    const name = "auth-secret";
    const existing = await prisma.serviceKey.findUnique({ where: { name } });
    if (existing) return existing.value;
    await prisma.serviceKey.createMany({ data: [{ name, value: randomBytes(32).toString("hex") }], skipDuplicates: true });
    return (await prisma.serviceKey.findUniqueOrThrow({ where: { name } })).value;
  })().catch((error) => {
    cached = null;
    throw error;
  });
  return cached;
}
