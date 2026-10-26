import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { processInbound } from "@/lib/inbound";
import { acceptsEvent, findModule } from "@/lib/modules";
import { apiError, authenticatePlatform, readJson } from "@/lib/platform-auth";
import { inboundEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

/** A platform sends an event to a module, e.g. "platform.shift.assigned". */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const platform = await authenticatePlatform(request);
  if (!platform) return apiError(401, "Invalid client credentials");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return apiError(413, "Event too large");

  const { id } = await params;
  const installation = await prisma.installation.findFirst({ where: { id, platformId: platform.id } });
  if (!installation) return apiError(404, "Installation not found");
  if (installation.status !== "ACTIVE") return apiError(409, `Installation is ${installation.status.toLowerCase()}`);

  const parsed = inboundEventSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "Body must be JSON with a type and optional data object");
  if (!acceptsEvent(installation.moduleKey, parsed.data.type)) {
    const accepted = findModule(installation.moduleKey)?.consumes.map((e) => e.type) ?? [];
    return apiError(422, `${installation.moduleKey} doesn't accept "${parsed.data.type}"`, { accepted });
  }

  const event = await prisma.event.create({
    data: {
      installationId: installation.id,
      direction: "INBOUND",
      type: parsed.data.type,
      payload: parsed.data.data as Prisma.InputJsonValue,
    },
  });
  // The event is stored first, so it is in the log even if acting on it fails.
  let result: unknown = null;
  try {
    result = await processInbound(installation, parsed.data.type, parsed.data.data);
  } catch (error) {
    console.error("inbound event not processed", event.id, error);
    return apiError(500, "The event was received but couldn't be processed", { id: event.id });
  }
  return Response.json({ id: event.id, received: true, result }, { status: 202 });
}
