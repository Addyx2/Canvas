import type { Installation } from "@prisma/client";

import { prisma } from "./db";
import { signEmbedToken, verifyEmbedToken, type EmbedClaims } from "./embed-token";
import { authSecret } from "./secret";

export interface EmbedContext {
  claims: EmbedClaims;
  installation: Installation;
  /** A fresh token when the current one is close to expiring, for long-open screens. */
  nextToken: string | null;
}

const REFRESH_WITHIN_SECONDS = 120;

/**
 * Authorise a call from a module screen. The screen sends its embed token as
 * `Authorization: Bearer …` (never a cookie, so other sites can't ride on it).
 */
export async function authorizeEmbed(request: Request, moduleKey: string): Promise<EmbedContext | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const secret = await authSecret();
  const claims = await verifyEmbedToken(token, secret);
  if (!claims || claims.mod !== moduleKey) return null;
  const installation = await prisma.installation.findUnique({
    where: { id: claims.ins },
    include: { platform: { select: { revokedAt: true } } },
  });
  if (!installation || installation.moduleKey !== moduleKey || installation.status !== "ACTIVE" || installation.platform.revokedAt) {
    return null;
  }
  let nextToken: string | null = null;
  if (claims.exp - Date.now() / 1000 < REFRESH_WITHIN_SECONDS) {
    const { exp: _exp, ...rest } = claims;
    nextToken = await signEmbedToken(rest, secret);
  }
  return { claims, installation, nextToken };
}

export function isManager(claims: EmbedClaims): boolean {
  return (claims.role ?? "manager") === "manager";
}

export function embedJson(ctx: EmbedContext, body: Record<string, unknown>, status = 200) {
  return Response.json({ ...body, nextToken: ctx.nextToken }, { status, headers: { "Cache-Control": "no-store" } });
}

export function embedDenied() {
  return Response.json({ error: "This screen has expired. Reload the page to continue." }, { status: 401 });
}
