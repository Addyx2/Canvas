import { Prisma, type PeakEntryKind, type PeakMember } from "@prisma/client";

import { prisma } from "../db";
import { emitEvent } from "../webhooks";
import { DEFAULT_REWARDS, readPeakSettings } from "./settings";

export class PeakError extends Error {}

/** Find or create the member for one of the platform's people, keeping their name current. */
export async function memberFor(installationId: string, personId: string, name?: string): Promise<PeakMember> {
  const existing = await prisma.peakMember.findUnique({ where: { installationId_personId: { installationId, personId } } });
  if (existing) {
    if (name && name !== existing.name) return prisma.peakMember.update({ where: { id: existing.id }, data: { name } });
    return existing;
  }
  try {
    return await prisma.peakMember.create({ data: { installationId, personId, name: name || personId } });
  } catch (error) {
    // Two events for a new person at once: the other request created them.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.peakMember.findUniqueOrThrow({ where: { installationId_personId: { installationId, personId } } });
    }
    throw error;
  }
}

export async function balanceOf(memberId: string): Promise<number> {
  const sum = await prisma.peakEntry.aggregate({ where: { memberId }, _sum: { points: true } });
  return sum._sum.points ?? 0;
}

export async function balances(installationId: string): Promise<Map<string, number>> {
  const rows = await prisma.peakEntry.groupBy({ by: ["memberId"], where: { installationId }, _sum: { points: true } });
  return new Map(rows.map((r) => [r.memberId, r._sum.points ?? 0]));
}

/**
 * Add a ledger entry. With a sourceKey, the same platform event never scores
 * twice: a repeat returns null instead of adding points again.
 */
export async function addEntry(entry: {
  installationId: string;
  memberId: string;
  kind: PeakEntryKind;
  points: number;
  reason: string;
  sourceKey?: string;
  byName?: string;
}) {
  try {
    return await prisma.peakEntry.create({ data: entry });
  } catch (error) {
    if (entry.sourceKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }
}

export async function ensureRewards(installationId: string) {
  const count = await prisma.peakReward.count({ where: { installationId } });
  if (count === 0) await prisma.peakReward.createMany({ data: DEFAULT_REWARDS.map((r) => ({ ...r, installationId })) });
}

/**
 * A member asks for a reward. The points are held straight away (a REDEMPTION
 * entry) so they can't be spent twice; a declined request gives them back.
 */
export async function requestRedemption(installationId: string, memberId: string, rewardId: string) {
  const installation = await prisma.installation.findUniqueOrThrow({ where: { id: installationId } });
  const settings = readPeakSettings(installation.settings);
  return prisma.$transaction(
    async (tx) => {
      const reward = await tx.peakReward.findFirst({ where: { id: rewardId, installationId, active: true } });
      if (!reward) throw new PeakError("That reward isn't available.");
      const sum = await tx.peakEntry.aggregate({ where: { memberId }, _sum: { points: true } });
      const balance = sum._sum.points ?? 0;
      if (balance < reward.cost) throw new PeakError(`You need ${reward.cost - balance} more points for this.`);
      const redemption = await tx.peakRedemption.create({
        data: {
          installationId,
          memberId,
          rewardId: reward.id,
          rewardName: reward.name,
          kind: reward.kind,
          points: reward.cost,
          amountPence: reward.kind === "CASH_OUT" ? reward.cost * settings.pointValuePence : null,
        },
      });
      await tx.peakEntry.create({
        data: {
          installationId,
          memberId,
          kind: "REDEMPTION",
          points: -reward.cost,
          reason: `Requested: ${reward.name}`,
          sourceKey: `redeem:${redemption.id}`,
        },
      });
      return redemption;
    },
    // Serialisable so two requests can't both pass the balance check.
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** A manager approves or declines a request. Approval tells the platform to pay or give it. */
export async function decideRedemption(installationId: string, redemptionId: string, approve: boolean, byName: string, note?: string) {
  const redemption = await prisma.peakRedemption.findFirst({
    where: { id: redemptionId, installationId },
    include: { member: true },
  });
  if (!redemption) throw new PeakError("That request no longer exists.");
  if (redemption.status !== "PENDING") throw new PeakError("That request has already been decided.");

  const updated = await prisma.peakRedemption.updateMany({
    where: { id: redemption.id, status: "PENDING" },
    data: { status: approve ? "APPROVED" : "DECLINED", decidedBy: byName, decidedAt: new Date(), note: note || null },
  });
  if (updated.count === 0) throw new PeakError("That request has already been decided.");

  if (!approve) {
    await addEntry({
      installationId,
      memberId: redemption.memberId,
      kind: "REVERSAL",
      points: redemption.points,
      reason: `Declined: ${redemption.rewardName}${note ? ` (${note})` : ""}`,
      sourceKey: `decline:${redemption.id}`,
      byName,
    });
    return;
  }
  await emitEvent(installationId, "peak.reward.redeemed", {
    redemptionId: redemption.id,
    personId: redemption.member.personId,
    name: redemption.member.name,
    reward: redemption.rewardName,
    kind: redemption.kind === "CASH_OUT" ? "cash_out" : "perk",
    points: redemption.points,
    amountPence: redemption.amountPence,
    approvedBy: byName,
  });
}
