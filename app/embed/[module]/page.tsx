import { formatDistanceToNowStrict } from "date-fns";
import { MessageSquare, PhoneCall, Sparkles, Trophy } from "lucide-react";

import { CanvasMark } from "@/components/Logo";
import { Badge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { verifyEmbedToken } from "@/lib/embed-token";
import { findModule } from "@/lib/modules";
import { authSecret } from "@/lib/secret";

export const dynamic = "force-dynamic";
export const metadata = { title: "Module", robots: { index: false } };

function Problem({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm text-center">
        <CanvasMark className="mx-auto" />
        <p className="mt-4 text-sm font-semibold text-slate-800">This module can&apos;t be shown</p>
        <p className="mt-1 text-sm text-slate-500">{message}</p>
      </div>
    </main>
  );
}

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ module: moduleKey }, { token }] = await Promise.all([params, searchParams]);
  const claims = await verifyEmbedToken(token, await authSecret());
  if (!claims || claims.mod !== moduleKey) return <Problem message="The link has expired. Reload the page in your app to get a fresh one." />;

  const installation = await prisma.installation.findUnique({
    where: { id: claims.ins },
    include: { platform: { select: { name: true, revokedAt: true } } },
  });
  const mod = findModule(moduleKey);
  if (!installation || !mod || installation.moduleKey !== moduleKey || installation.platform.revokedAt) {
    return <Problem message="This module isn't installed for your organisation." />;
  }
  if (installation.status !== "ACTIVE") return <Problem message="This module is paused. Contact your Canvas admin." />;

  const events = await prisma.event.findMany({
    where: { installationId: installation.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return (
    <main className="min-h-screen bg-white p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-brand-300">
            {mod.key === "gateway" ? <PhoneCall className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
          </span>
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold">{mod.name}</p>
            <p className="text-xs text-slate-500">{installation.tenantName} · in {installation.platform.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Badge tone={mod.status === "pilot" ? "brand" : "slate"}>{mod.status === "pilot" ? "Pilot" : "Coming soon"}</Badge>
          <span>Signed in as {claims.name}</span>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            {mod.key === "gateway" ? <MessageSquare className="h-4 w-4 text-brand-600" /> : <Sparkles className="h-4 w-4 text-brand-600" />}
            <h2 className="text-sm font-semibold">{mod.key === "gateway" ? "Conversations" : "Leaderboard"}</h2>
          </div>
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">
              {mod.key === "gateway" ? "No conversations yet" : "Peak is coming soon"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              {mod.key === "gateway"
                ? `When Gateway answers calls and messages for ${installation.tenantName}, they appear here. You'll be able to watch, take over and hand back.`
                : `Points, streaks and rewards for ${installation.tenantName}'s carers will appear here, built from clock-ins and praise.`}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200">
          <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold">Activity</h2></div>
          {events.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Nothing yet. Events between {installation.platform.name} and {mod.name} show here.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge tone={e.direction === "INBOUND" ? "blue" : "brand"}>{e.direction === "INBOUND" ? "In" : "Out"}</Badge>
                    <code className="truncate text-[12px] text-slate-700">{e.type}</code>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDistanceToNowStrict(e.createdAt, { addSuffix: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400"><CanvasMark className="h-5 w-5 rounded p-[4px]" /> Streamed from Aultrum Canvas</p>
    </main>
  );
}
