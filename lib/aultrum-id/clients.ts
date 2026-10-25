import { prisma } from "@/lib/db";

/** The product asking, when someone signs in to continue to one. */
export async function requestingApp(returnTo?: string): Promise<string | null> {
  if (!returnTo?.startsWith("/authorize?")) return null;
  const clientId = new URLSearchParams(returnTo.slice("/authorize?".length)).get("client_id");
  if (!clientId) return null;
  const client = await prisma.oAuthClient.findUnique({ where: { clientId }, select: { name: true } });
  return client?.name ?? null;
}
