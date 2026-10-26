import { PhoneCall, Trophy } from "lucide-react";

import { CanvasMark } from "@/components/Logo";
import { GatewayInbox } from "@/components/embed/GatewayInbox";
import { PeakScreen } from "@/components/embed/PeakScreen";
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

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-brand-300">
            {mod.key === "gateway" ? <PhoneCall className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
          </span>
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold">{mod.name}</p>
            <p className="text-xs text-slate-500">{installation.tenantName} · in {installation.platform.name}</p>
          </div>
        </div>
        <span className="text-xs text-slate-500">Signed in as {claims.name}</span>
      </header>
      {mod.key === "gateway" ? <GatewayInbox token={token!} /> : <PeakScreen token={token!} />}
    </main>
  );
}
