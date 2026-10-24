import { createHmac, timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { SESSION_COOKIE } from "./constants";
import { prisma } from "./db";
import { authSecret } from "./secret";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(`session.${payload}`).digest("base64url");
}

// Token: `${userId}.${sessionVersion}.${expires}.${signature}`. Bumping
// User.sessionVersion revokes every session (sign out everywhere).
export function createSessionToken(userId: string, sessionVersion = 0, ttlMs = SESSION_TTL_MS): string {
  const payload = `${userId}.${sessionVersion}.${Date.now() + ttlMs}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): { userId: string; version: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, versionRaw, expiresRaw, signature] = parts;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(`${userId}.${versionRaw}.${expiresRaw}`));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const expires = Number(expiresRaw);
  const version = Number(versionRaw);
  if (!Number.isFinite(expires) || expires < Date.now() || !Number.isInteger(version)) return null;
  return { userId, version };
}

export async function setSessionCookie(user: { id: string; sessionVersion: number }) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user.id, user.sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export const getSessionUser = cache(async () => {
  const store = await cookies();
  const session = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, include: { organization: true } });
  if (!user || user.sessionVersion !== session.version) return null;
  return user;
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Managing platforms and credentials is admin-only. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
