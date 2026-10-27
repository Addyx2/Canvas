import Link from "next/link";
import { formatDistanceToNowStrict, subDays } from "date-fns";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";

import { Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ownInstallation } from "@/lib/standalone";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const org = user.organizationId;
  const [gateway, peak] = await Promise.all([ownInstallation(org, "gateway"), ownInstallation(org, "peak")]);
  const [followUps, waiting, conversations7d, pendingRewards, people, team, platforms, events7d, failed, recent] = await Promise.all([
    gateway ? prisma.gatewayConversation.count({ where: { installationId: gateway.id, followUp: true, followUpDoneAt: null } }) : 0,
    gateway ? prisma.gatewayConversation.count({ where: { installationId: gateway.id, status: "NEEDS_PERSON" } }) : 0,
    gateway ? prisma.gatewayConversation.count({ where: { installationId: gateway.id, createdAt: { gte: subDays(new Date(), 7) } } }) : 0,
    peak ? prisma.peakRedemption.count({ where: { installationId: peak.id, status: "PENDING" } }) : 0,
    prisma.person.count({ where: { organizationId: org } }),
    prisma.user.count({ where: { organizationId: org } }),
    prisma.platform.count({ where: { organizationId: org, revokedAt: null, builtIn: false } }),
    prisma.event.count({ where: { installation: { organizationId: org }, createdAt: { gte: subDays(new Date(), 7) } } }),
    prisma.event.count({ where: { installation: { organizationId: org }, deliveryStatus: "FAILED" } }),
    prisma.event.findMany({
      where: { installation: { organizationId: org, platform: { builtIn: false } } },
      include: { installation: { select: { moduleKey: true, tenantName: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const steps = [
    { done: !!gateway, label: "Switch on Gateway", detail: "It answers calls, texts and web chat, and takes enquiries and messages for you.", href: "/gateway" },
    { done: !!peak, label: "Switch on Peak", detail: "Points, praise and rewards for your carers.", href: "/peak" },
    { done: people > 0, label: "Add your people", detail: "Carers and contacts, so Gateway knows who's calling and carers can earn points.", href: "/people" },
    ...(user.role === "ADMIN" ? [{ done: team > 1, label: "Invite your team", detail: "Colleagues run the inbox with you; carers sign in to see their points.", href: "/team" }] : []),
  ];

  const cards = [
    {
      name: "Gateway",
      href: "/gateway",
      on: !!gateway,
      lines: gateway
        ? [
            { value: followUps, label: "to follow up", alert: followUps > 0 },
            { value: waiting, label: "waiting for a person", alert: waiting > 0 },
            { value: conversations7d, label: "conversations this week" },
          ]
        : [],
      off: "Answers calls, texts and web chat around the clock, and takes enquiries and messages.",
    },
    {
      name: "Peak",
      href: "/peak",
      on: !!peak,
      lines: peak ? [{ value: pendingRewards, label: `reward${pendingRewards === 1 ? "" : "s"} to approve`, alert: pendingRewards > 0 }] : [],
      off: "Recognition that pays: carers earn points and ask for rewards you approve.",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={`What needs you today at ${user.organization.name}.`} />

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.name} href={c.href}>
            <Card className="h-full p-5 transition hover:border-slate-300">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{c.name}</h2>
                <Badge tone={c.on ? "green" : "slate"}>{c.on ? "On" : "Off"}</Badge>
              </div>
              {c.on ? (
                <ul className="mt-3 space-y-1.5">
                  {c.lines.map((l) => (
                    <li key={l.label} className="flex items-baseline gap-2 text-sm">
                      <span className={`font-display text-2xl font-bold tracking-tight ${l.alert ? "text-amber-600" : "text-slate-900"}`}>{l.value}</span>
                      <span className="text-slate-600">{l.label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600">{c.off}</p>
              )}
              <p className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-700">{c.on ? `Open ${c.name}` : `Switch on ${c.name}`} <ArrowRight className="h-3.5 w-3.5" /></p>
            </Card>
          </Link>
        ))}
      </div>

      {steps.some((s) => !s.done) ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Get started</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((s) => (
              <li key={s.label} className="flex items-start gap-3">
                {s.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <Circle className="mt-0.5 h-5 w-5 text-slate-300" />}
                <div className="flex-1">
                  <Link href={s.href} className="text-sm font-medium text-slate-900 hover:text-brand-700">{s.label}</Link>
                  <p className="text-sm text-slate-500">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Developers</h2>
          <Link href="/developers" className="text-sm font-medium text-brand-700 hover:text-brand-800">API →</Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">Run Gateway and Peak inside your own software, such as Pleasant.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <p className="text-sm text-slate-500">Connected systems</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight">{platforms}</p>
            <Link href="/systems" className="mt-1 inline-block text-xs text-brand-700 hover:text-brand-800">Manage →</Link>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-slate-500">Events, last 7 days</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight">{events7d}</p>
            <p className={`mt-1 text-xs ${failed > 0 ? "text-red-600" : "text-slate-500"}`}>{failed > 0 ? `${failed} failed deliveries` : "No failed deliveries"}</p>
          </Card>
        </div>
        {recent.length > 0 ? (
          <Card className="mt-4 divide-y divide-slate-100">
            {recent.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone={e.direction === "INBOUND" ? "blue" : "brand"}>{e.direction === "INBOUND" ? "In" : "Out"}</Badge>
                  <code className="text-[13px] text-slate-800">{e.type}</code>
                  <span className="text-slate-500">· {e.installation.tenantName}</span>
                </span>
                <span className="text-xs text-slate-400">{formatDistanceToNowStrict(e.createdAt, { addSuffix: true })}</span>
              </div>
            ))}
          </Card>
        ) : null}
      </section>
    </div>
  );
}
