import { prisma } from "@/lib/db";
import { apiError, authenticatePlatform } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

/** Uninstall. Events are kept for the audit trail. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const platform = await authenticatePlatform(request);
  if (!platform) return apiError(401, "Invalid client credentials");
  const { id } = await params;
  const installation = await prisma.installation.findFirst({ where: { id, platformId: platform.id } });
  if (!installation) return apiError(404, "Installation not found");
  await prisma.installation.update({ where: { id }, data: { status: "UNINSTALLED" } });
  return new Response(null, { status: 204 });
}
