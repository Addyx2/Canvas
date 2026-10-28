import { authorizeEmbed, embedDenied, embedJson, isManager } from "@/lib/embed-auth";
import { prisma } from "@/lib/db";
import { balanceOf, balances, ensureRewards, memberFor } from "@/lib/peak/ledger";
import { BADGES as BADGE_TYPES, badgeType } from "@/lib/peak/badges";
import { readPeakSettings } from "@/lib/peak/settings";

export const dynamic = "force-dynamic";

const entrySelect = { id: true, kind: true, points: true, reason: true, byName: true, createdAt: true } as const;
const badgeSelect = { id: true, badge: true, note: true, byName: true, points: true, createdAt: true } as const;

function withName<T extends { badge: string }>(b: T) {
  return { ...b, name: badgeType(b.badge)?.name ?? "Recognition" };
}

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
    const [balance, entries, redemptions, badges, offers, myClaims] = await Promise.all([
      balanceOf(member.id),
      prisma.peakEntry.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "desc" }, take: 30, select: entrySelect }),
      prisma.peakRedemption.findMany({
        where: { memberId: member.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, rewardName: true, points: true, amountPence: true, status: true, createdAt: true, note: true },
      }),
      prisma.peakBadge.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "desc" }, take: 50, select: badgeSelect }),
      // Aultrum's partner offers are open to every carer on Peak.
      prisma.partnerOffer.findMany({
        where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        orderBy: [{ category: "asc" }, { createdAt: "desc" }],
        select: { id: true, partner: true, title: true, description: true, category: true, headline: true, code: true, url: true, expiresAt: true },
      }),
      prisma.partnerOfferClaim.findMany({ where: { memberId: member.id }, select: { offerId: true } }),
    ]);
    const claimed = new Set(myClaims.map((c) => c.offerId));
    return embedJson(ctx, {
      view: "member",
      tenantName: installation.tenantName,
      me: { name: member.name, balance, streak: member.streak, valuePence: balance * settings.pointValuePence },
      settings,
      rewards,
      entries,
      redemptions,
      badges: badges.map(withName),
      // A code is only revealed once the carer opens the offer.
      offers: offers.map(({ code, url, ...o }) => ({ ...o, claimed: claimed.has(o.id), ...(claimed.has(o.id) ? { code, url } : {}) })),
    });
  }

  const platform = await prisma.platform.findUnique({ where: { id: installation.platformId }, select: { builtIn: true, webhookUrl: true } });
  const [members, totals, pending, recent, approved, badges, badgeCounts] = await Promise.all([
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
    prisma.peakRedemption.findMany({
      where: { installationId: installation.id, status: "APPROVED" },
      orderBy: { decidedAt: "desc" },
      take: 10,
      select: { id: true, rewardName: true, kind: true, amountPence: true, decidedAt: true, decidedBy: true, member: { select: { name: true } } },
    }),
    prisma.peakBadge.findMany({ where: { installationId: installation.id }, orderBy: { createdAt: "desc" }, take: 10, select: { ...badgeSelect, member: { select: { name: true } } } }),
    prisma.peakBadge.groupBy({ by: ["memberId"], where: { installationId: installation.id }, _count: true }),
  ]);
  const badgesBy = new Map(badgeCounts.map((b) => [b.memberId, b._count]));
  const board = members
    .map((m) => ({ ...m, balance: totals.get(m.id) ?? 0, badges: badgesBy.get(m.id) ?? 0 }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  // Cash-outs go to a connected system's payroll; on its own, the organisation pays them.
  const paidBySystem = Boolean(platform && !platform.builtIn && platform.webhookUrl);
  return embedJson(ctx, {
    view: "manager",
    tenantName: installation.tenantName,
    settings,
    rewards,
    members: board,
    pending,
    recent,
    approved,
    paidBySystem,
    badges: badges.map(withName),
    badgeTypes: BADGE_TYPES,
  });
}
