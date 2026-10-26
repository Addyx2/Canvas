import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

import { prisma } from "./db";
import { parseBasicAuth, secretMatches } from "./credentials";
import { appUrl } from "./utils";

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function keySet(uri: string) {
  let set = keySets.get(uri);
  if (!set) {
    set = createRemoteJWKSet(new URL(uri), { cacheMaxAge: 10 * 60_000, cooldownDuration: 30_000 });
    keySets.set(uri, set);
  }
  return set;
}

/**
 * Authenticate a platform calling the Canvas API, either with
 * `Authorization: Basic base64(clientId:clientSecret)`, or, for systems
 * connected by public key, `Authorization: Bearer <JWT>` signed with their
 * own key (iss = client ID, aud = this Canvas, valid for at most two minutes).
 */
export async function authenticatePlatform(request: Request) {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    let iss: string | undefined;
    try {
      iss = decodeJwt(token).iss;
    } catch {
      return null;
    }
    if (!iss) return null;
    const platform = await prisma.platform.findUnique({ where: { clientId: iss } });
    if (!platform?.jwksUri || platform.revokedAt) return null;
    try {
      await jwtVerify(token, keySet(platform.jwksUri), {
        issuer: platform.clientId,
        audience: new URL(appUrl()).origin,
        maxTokenAge: "2m",
        requiredClaims: ["exp", "iat"],
      });
      return platform;
    } catch {
      return null;
    }
  }
  const creds = parseBasicAuth(header);
  if (!creds) return null;
  const platform = await prisma.platform.findUnique({ where: { clientId: creds.clientId } });
  if (!platform || platform.revokedAt || platform.jwksUri || !secretMatches(creds.secret, platform.secretHash)) return null;
  return platform;
}

export function apiError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) return undefined;
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
