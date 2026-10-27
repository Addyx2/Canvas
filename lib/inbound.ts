import type { Installation } from "@prisma/client";

import { applyDirectoryEvent } from "./gateway/directory";
import { scorePeakEvent } from "./peak/scoring";

/** Act on an event a platform sent to a module. Returns what happened, for the API response. */
export async function processInbound(installation: Installation, type: string, data: Record<string, unknown>) {
  if (installation.moduleKey === "peak") return scorePeakEvent(installation, type, data);
  if (installation.moduleKey === "gateway") return applyDirectoryEvent(installation.id, type, data);
  return null;
}
