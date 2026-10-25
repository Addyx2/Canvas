"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth";
import { idUrl, workspaceUrl } from "@/lib/aultrum-id/hosts";
import { currentIdentity, endSession } from "@/lib/aultrum-id/session";
import { WORKSPACE_CLIENT_ID } from "@/lib/aultrum-id/workspace";
import { prisma } from "@/lib/db";

/** Signs out of Workspace, then of Aultrum ID itself. */
export async function signOutAction(): Promise<void> {
  await endSession("workspace");
  const url = new URL(`${idUrl()}/logout`);
  url.searchParams.set("client_id", WORKSPACE_CLIENT_ID);
  url.searchParams.set("post_logout_redirect_uri", workspaceUrl());
  redirect(url.toString());
}

export interface AccountState {
  ok?: boolean;
  message?: string;
}

export async function updateNameAction(_prev: AccountState, form: FormData): Promise<AccountState> {
  const identity = await currentIdentity("workspace");
  if (!identity) redirect(`${workspaceUrl()}/signin`);
  const name = z.string().trim().min(2).max(120).safeParse(form.get("name"));
  if (!name.success) return { ok: false, message: "Enter your name (at least 2 characters)." };
  await prisma.identity.update({ where: { id: identity.id }, data: { name: name.data } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. Platforms pick up the new name next time you open them." };
}

export async function changePasswordAction(_prev: AccountState, form: FormData): Promise<AccountState> {
  const identity = await currentIdentity("workspace");
  if (!identity) redirect(`${workspaceUrl()}/signin`);
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (!(await verifyPassword(current, identity.passwordHash))) return { ok: false, message: "Your current password isn't right." };
  if (next.length < 10) return { ok: false, message: "Use at least 10 characters for the new password." };
  // A new password signs out every other device.
  await prisma.identity.update({
    where: { id: identity.id },
    data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 } },
  });
  await endSession("workspace");
  redirect(`${workspaceUrl()}/signin`);
}

export async function signOutEverywhereAction(): Promise<void> {
  const identity = await currentIdentity("workspace");
  if (identity) await prisma.identity.update({ where: { id: identity.id }, data: { sessionVersion: { increment: 1 } } });
  await signOutAction();
}
