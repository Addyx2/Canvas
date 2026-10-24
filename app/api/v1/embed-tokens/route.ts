import { EMBED_TOKEN_TTL_SECONDS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { signEmbedToken } from "@/lib/embed-token";
import { findModule } from "@/lib/modules";
import { apiError, authenticatePlatform, readJson } from "@/lib/platform-auth";
import { authSecret } from "@/lib/secret";
import { appUrl } from "@/lib/utils";
import { embedTokenSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** A short-lived URL for showing a module screen inside the platform. */
export async function POST(request: Request) {
  const platform = await authenticatePlatform(request);
  if (!platform) return apiError(401, "Invalid client credentials");
  const parsed = embedTokenSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "Body must be JSON with installationId and user {id, name}");

  const installation = await prisma.installation.findFirst({
    where: { id: parsed.data.installationId, platformId: platform.id },
  });
  if (!installation) return apiError(404, "Installation not found");
  if (installation.status !== "ACTIVE") return apiError(409, `Installation is ${installation.status.toLowerCase()}`);
  if (platform.allowedOrigins.length === 0) {
    return apiError(409, "Add the platform's origin under Platforms before embedding module screens");
  }
  const mod = findModule(installation.moduleKey)!;

  const token = await signEmbedToken(
    {
      ins: installation.id,
      mod: mod.key,
      sub: parsed.data.user.id,
      name: parsed.data.user.name,
      origins: platform.allowedOrigins,
    },
    authSecret(),
  );
  return Response.json(
    { url: appUrl(`${mod.embedPath}?token=${encodeURIComponent(token)}`), expiresIn: EMBED_TOKEN_TTL_SECONDS },
    { headers: { "Cache-Control": "no-store" } },
  );
}
