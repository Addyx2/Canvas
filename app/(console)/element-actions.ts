"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { switchOff, switchOn, type ElementKey } from "@/lib/standalone";

/** Switch Gateway or Peak on or off for the organisation's own use. */
export async function switchElementAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const key = formData.get("key");
  if (key !== "gateway" && key !== "peak") return;
  const on = formData.get("on") === "true";
  if (on) await switchOn(user.organization, key as ElementKey);
  else await switchOff(user.organizationId, key as ElementKey);
  await recordAudit(user, { action: on ? "element.on" : "element.off", summary: `Switched ${key === "gateway" ? "Gateway" : "Peak"} ${on ? "on" : "off"}` });
  revalidatePath(`/${key}`);
  revalidatePath("/dashboard");
}
