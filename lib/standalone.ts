import { randomBytes } from "node:crypto";

import type { Installation, Person } from "@prisma/client";

import type { SessionUser } from "./auth";
import { hashSecret } from "./credentials";
import { prisma } from "./db";
import { signEmbedToken } from "./embed-token";
import { applyDirectoryEvent } from "./gateway/directory";
import { memberFor } from "./peak/ledger";
import { authSecret } from "./secret";
import { appUrl } from "./utils";

// Elements used on its own: an organisation that signs up to the console runs
// Gateway and Peak here directly, without connecting another system. Behind
// the scenes it has one built-in "platform" whose installations are its own.

export type ElementKey = "gateway" | "peak";
const SELF = "self";

async function builtInPlatform(organizationId: string) {
  const existing = await prisma.platform.findFirst({ where: { organizationId, builtIn: true } });
  if (existing) return existing;
  return prisma.platform.create({
    data: {
      organizationId,
      name: "Elements",
      builtIn: true,
      clientId: `elements:${organizationId}`,
      // Nothing can authenticate as the built-in platform: these are never shown.
      secretHash: hashSecret(randomBytes(32).toString("hex")),
      webhookSecret: randomBytes(32).toString("hex"),
      allowedOrigins: [new URL(appUrl()).origin],
    },
  });
}

/** The organisation's own installation of an Element, if it is switched on. */
export async function ownInstallation(organizationId: string, key: ElementKey): Promise<Installation | null> {
  return prisma.installation.findFirst({
    where: { organizationId, moduleKey: key, tenantId: SELF, status: "ACTIVE", platform: { builtIn: true } },
  });
}

export async function switchOn(org: { id: string; name: string }, key: ElementKey): Promise<Installation> {
  const platform = await builtInPlatform(org.id);
  const where = { platformId_moduleKey_tenantId: { platformId: platform.id, moduleKey: key, tenantId: SELF } };
  const installation = await prisma.installation.upsert({
    where,
    create: { organizationId: org.id, platformId: platform.id, moduleKey: key, tenantId: SELF, tenantName: org.name },
    update: { status: "ACTIVE", tenantName: org.name },
  });
  const people = await prisma.person.findMany({ where: { organizationId: org.id } });
  for (const person of people) await syncPerson(person, [installation]);
  return installation;
}

export async function switchOff(organizationId: string, key: ElementKey): Promise<void> {
  await prisma.installation.updateMany({
    where: { organizationId, moduleKey: key, tenantId: SELF, platform: { builtIn: true } },
    data: { status: "UNINSTALLED" },
  });
}

/** Keep Gateway's directory and Peak's members in step with People. */
export async function syncPerson(person: Person, installations?: Installation[]) {
  const targets = installations ?? (await prisma.installation.findMany({
    where: { organizationId: person.organizationId, tenantId: SELF, status: "ACTIVE", platform: { builtIn: true } },
  }));
  for (const i of targets) {
    if (i.moduleKey === "gateway") {
      await applyDirectoryEvent(i.id, "platform.person.updated", {
        personId: person.id,
        name: person.name,
        phone: person.phone,
        kind: person.kind,
        organisation: person.organisation,
      });
    }
    if (i.moduleKey === "peak" && person.kind === "carer") await memberFor(i.id, person.id, person.name);
  }
}

export async function forgetPerson(organizationId: string, personId: string) {
  const installs = await prisma.installation.findMany({ where: { organizationId, tenantId: SELF, platform: { builtIn: true } } });
  for (const i of installs) {
    if (i.moduleKey === "gateway") await applyDirectoryEvent(i.id, "platform.person.removed", { personId });
  }
}

/**
 * A screen token for someone signed in to the console: managers see the whole
 * Element, carers only their own Peak.
 */
export async function consoleScreenToken(user: SessionUser, installation: Installation): Promise<string> {
  const carer = user.role === "CARER";
  return signEmbedToken(
    {
      ins: installation.id,
      mod: installation.moduleKey,
      sub: user.id,
      name: user.name,
      origins: [new URL(appUrl()).origin],
      role: carer ? "member" : "manager",
      ...(carer && user.personId ? { person: user.personId } : {}),
    },
    await authSecret(),
  );
}
