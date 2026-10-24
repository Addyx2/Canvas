import { prisma } from "@/lib/db";
import { findModule } from "@/lib/modules";
import { apiError, authenticatePlatform, readJson } from "@/lib/platform-auth";
import { installSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const view = (i: { id: string; moduleKey: string; tenantId: string; tenantName: string; status: string; createdAt: Date }) => ({
  id: i.id,
  module: i.moduleKey,
  tenantId: i.tenantId,
  tenantName: i.tenantName,
  status: i.status,
  createdAt: i.createdAt.toISOString(),
});

export async function GET(request: Request) {
  const platform = await authenticatePlatform(request);
  if (!platform) return apiError(401, "Invalid client credentials");
  const installs = await prisma.installation.findMany({
    where: { platformId: platform.id, status: { not: "UNINSTALLED" } },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ installations: installs.map(view) });
}

/** Install a module for one tenant. Idempotent per (platform, module, tenant). */
export async function POST(request: Request) {
  const platform = await authenticatePlatform(request);
  if (!platform) return apiError(401, "Invalid client credentials");
  const parsed = installSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "Body must be JSON with module, tenantId and tenantName");
  const mod = findModule(parsed.data.module);
  if (!mod) return apiError(404, `Unknown module "${parsed.data.module}"`);

  const where = { platformId_moduleKey_tenantId: { platformId: platform.id, moduleKey: mod.key, tenantId: parsed.data.tenantId } };
  const existing = await prisma.installation.findUnique({ where });
  const installation = await prisma.installation.upsert({
    where,
    create: {
      organizationId: platform.organizationId,
      platformId: platform.id,
      moduleKey: mod.key,
      tenantId: parsed.data.tenantId,
      tenantName: parsed.data.tenantName,
    },
    // Reinstalling reactivates; a paused installation stays paused (Canvas admins paused it).
    update: { tenantName: parsed.data.tenantName, ...(existing?.status === "UNINSTALLED" ? { status: "ACTIVE" as const } : {}) },
  });
  return Response.json(view(installation), { status: existing && existing.status !== "UNINSTALLED" ? 200 : 201 });
}
