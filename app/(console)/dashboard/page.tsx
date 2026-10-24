import Link from "next/link";
import { formatDistanceToNowStrict, subDays } from "date-fns";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";

import { Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MODULES } from "@/lib/modules";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const org = user.organizationId;
  const [platforms, installations, events7d, failed, recent] = await Promise.all([
    prisma.platform.count({ where: { organizationId: org, revokedAt: null } }),
    prisma.installation.groupBy({ by: ["moduleKey"], where: { organizationId: org, status: "ACTIVE" }, _count: true }),
    prisma.event.count({ where: { installation: { organizationId: org }, createdAt: { gte: subDays(new Date(), 7) } } }),
    prisma.event.count({ where: { installation: { organizationId: org }, deliveryStatus: "FAILED" } }),
    prisma.event.findMany({
      where: { installation: { organizationId: org } },
      include: { installation: { select: { moduleKey: true, tenantName: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);
  const active = installations.reduce((n, g) => n + g._count, 0);
  const byModule = new Map(installations.map((g) => [g.moduleKey, g._count]));

  const steps = [
    { done: platforms > 0, label: "Connect a system", detail: "Register your software to get API credentials.", href: "/systems" },
    { done: active > 0, label: "Switch on an Element", detail: "Your system installs Gateway or Peak for one of its services through the API.", href: "/developers#install" },
    { done: events7d > 0, label: "Send your first event", detail: "Events flow both ways between the Element and your system.", href: "/developers#events" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description="Your Elements, the systems they appear in, and what's flowing between them." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Elements", value: MODULES.length, hint: `${MODULES.filter((m) => m.status === "pilot").length} in pilot` },
          { label: "Connected systems", value: platforms, hint: "Using Persona and Elements" },
          { label: "Active installations", value: active, hint: "Element × service" },
          { label: "Events, last 7 days", value: events7d, hint: failed > 0 ? `${failed} failed deliveries` : "No failed deliveries" },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight">{s.value}</p>
            <p className={`mt-1 text-xs ${s.label.startsWith("Events") && failed > 0 ? "text-red-600" : "text-slate-500"}`}>{s.hint}</p>
          </Card>
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
        <h2 className="text-sm font-semibold">Elements</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {MODULES.map((m) => (
            <Link key={m.key} href={`/elements/${m.key}`}>
              <Card className="h-full p-5 transition hover:border-slate-300">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">{m.name}</h3>
                  <Badge tone={m.status === "pilot" ? "brand" : "slate"}>{m.status === "pilot" ? "Pilot" : "Planned"}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{m.tagline}</p>
                <p className="mt-4 flex items-center gap-1 text-sm text-slate-500">
                  {byModule.get(m.key) ?? 0} active installation{byModule.get(m.key) === 1 ? "" : "s"} <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent events</h2>
          <Link href="/events" className="text-sm font-medium text-brand-700 hover:text-brand-800">All events →</Link>
        </div>
        <Card className="mt-3 divide-y divide-slate-100">
          {recent.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No events yet.</p>
          ) : (
            recent.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone={e.direction === "INBOUND" ? "blue" : "brand"}>{e.direction === "INBOUND" ? "In" : "Out"}</Badge>
                  <code className="text-[13px] text-slate-800">{e.type}</code>
                  <span className="text-slate-500">· {e.installation.tenantName}</span>
                </span>
                <span className="text-xs text-slate-400">{formatDistanceToNowStrict(e.createdAt, { addSuffix: true })}</span>
              </div>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
