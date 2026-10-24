"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deliverEvent } from "@/lib/webhooks";

export async function retryEventAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const event = await prisma.event.findFirst({
    where: { id: String(formData.get("id") ?? ""), direction: "OUTBOUND", installation: { organizationId: user.organizationId } },
  });
  if (!event || event.deliveryStatus === "DELIVERED") return;
  await deliverEvent(event.id);
  revalidatePath("/events");
}
