import { authorizeEmbed, embedDenied, embedJson, isManager } from "@/lib/embed-auth";
import { prisma } from "@/lib/db";
import { balanceOf, balances, ensureRewards, memberFor } from "@/lib/peak/ledger";
import { readPeakSettings } from "@/lib/peak/settings";

export const dynamic = "force-dynamic";

const entrySelect = { id: true, kind: true, points: true, reason: true, byName: true, createdAt: true } as const;

/** Everything a Peak screen shows: the whole team for managers, one person for members. */
export async function GET(request: Request) {
  const ctx = await authorizeEmbed(request, "peak");
  if (!ctx) return embedDenied();
  const { installation, claims } = ctx;
  await ensureRewards(installation.id);
  const settings = readPeakSettings(installation.settings);
  const rewards = await prisma.peakReward.findMany({
    where: { installationId: installation.id, active: true },
    orderBy: { cost: "asc" },
    select: { id: true, name: true, description: true, kind: true, cost: true },
  });

  if (!isManager(claims)) {
    const member = await memberFor(installation.id, claims.person!, claims.name);
    const [balance, entries, redemptions] = await Promise.all([
      balanceOf(member.id),
      prisma.peakEntry.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "desc" }, take: 30, select: entrySelect }),
      prisma.peakRedemption.findMany({
        where: { memberId: member.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, rewardName: true, points: true, amountPence: true, status: true, createdAt: true, note: true },
      }),
    ]);
    return embedJson(ctx, {
      view: "member",
      tenantName: installation.tenantName,
      me: { name: member.name, balance, streak: member.streak, valuePence: balance * settings.pointValuePence },
      settings,
      rewards,
      entries,
      redemptions,
    });
  }

  const [members, totals, pending, recent] = await Promise.all([
    prisma.peakMember.findMany({ where: { installationId: installation.id }, select: { id: true, personId: true, name: true, streak: true } }),
    balances(installation.id),
    prisma.peakRedemption.findMany({
      where: { installationId: installation.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, rewardName: true, kind: true, points: true, amountPence: true, createdAt: true, member: { select: { name: true, personId: true } } },
    }),
    prisma.peakEntry.findMany({
      where: { installationId: installation.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { ...entrySelect, member: { select: { name: true } } },
    }),
  ]);
  const board = members
    .map((m) => ({ ...m, balance: totals.get(m.id) ?? 0 }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  return embedJson(ctx, { view: "manager", tenantName: installation.tenantName, settings, rewards, members: board, pending, recent });
}
