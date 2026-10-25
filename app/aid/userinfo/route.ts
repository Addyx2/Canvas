import { verifyAccessToken } from "@/lib/aultrum-id/tokens";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function userinfo(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const access = token ? await verifyAccessToken(token) : null;
  const identity = access ? await prisma.identity.findUnique({ where: { id: access.sub } }) : null;
  if (!identity) {
    return new Response(null, { status: 401, headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' } });
  }
  return Response.json(
    { sub: identity.id, email: identity.email, email_verified: false, name: identity.name },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = userinfo;
export const POST = userinfo;
