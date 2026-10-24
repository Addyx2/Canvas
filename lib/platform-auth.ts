import { prisma } from "./db";
import { parseBasicAuth, secretMatches } from "./credentials";

/**
 * Authenticate a platform calling the Canvas API with
 * `Authorization: Basic base64(clientId:clientSecret)`.
 */
export async function authenticatePlatform(request: Request) {
  const creds = parseBasicAuth(request.headers.get("authorization"));
  if (!creds) return null;
  const platform = await prisma.platform.findUnique({ where: { clientId: creds.clientId } });
  if (!platform || platform.revokedAt || !secretMatches(creds.secret, platform.secretHash)) return null;
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
