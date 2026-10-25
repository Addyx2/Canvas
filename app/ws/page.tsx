import { ArrowUpRight } from "lucide-react";

import { syncEnvClients } from "@/lib/aultrum-id/clients";
import { activityFor } from "@/lib/aultrum-id/feed";
import { requireWorkspaceIdentity } from "@/lib/aultrum-id/session";
import { PRODUCTS } from "@/lib/aultrum-id/workspace";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Badge, Card, buttonClass, subtleButtonClass } from "@/components/ui";

import { ActivityList } from "./ActivityList";

export const metadata = { title: "Platforms" };

function launch(url: string, orgId?: string) {
  const target = new URL(url);
  if (orgId) target.searchParams.set("org", orgId);
  return target.toString();
}

export default async function WorkspaceHome() {
  const identity = await requireWorkspaceIdentity();
  await syncEnvClients();
  const [{ memberships, items }, clients] = await Promise.all([
    activityFor(identity.id, 8),
    prisma.oAuthClient.findMany({ where: { revokedAt: null, product: { not: "workspace" } } }),
  ]);
  const first = identity.name.split(/\s+/)[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Welcome back, {first}</h1>
        <p className="mt-1 text-sm text-slate-500">Every Aultrum platform you use, and what&apos;s happening in each.</p>
      </div>

      <section aria-labelledby="platforms" className="space-y-3">
        <h2 id="platforms" className="text-sm font-semibold text-slate-900">Your platforms</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PRODUCTS.map((product) => {
            const client = clients.find((c) => c.product === product.key);
            const orgs = memberships.filter((m) => m.client.product === product.key);
            return (
              <Card key={product.key} className="flex min-w-0 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-bold tracking-tight text-ink">{product.name}</h3>
                  {orgs.length ? (
                    <Badge tone="green">{orgs.length === 1 ? "1 organisation" : `${orgs.length} organisations`}</Badge>
                  ) : client ? (
                    <Badge tone="slate">Not linked yet</Badge>
                  ) : product.fallback ? (
                    <Badge tone="slate">Separate sign-in</Badge>
                  ) : (
                    <Badge tone="slate">Coming soon</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">{product.line}</p>
                <div className="mt-4 flex-1 space-y-2">
                  {orgs.map((m) => (
                    <a
                      key={m.id}
                      href={client?.launchUrl ? launch(client.launchUrl, m.orgId) : "#"}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 transition hover:border-brand-300 hover:bg-brand-50/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{m.orgName}</span>
                        <span className="block text-xs text-slate-500">{m.role}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand-700">
                        Open <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </a>
                  ))}
                  {!orgs.length && client?.launchUrl ? (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">
                        Already use {product.name}? Open it once and confirm your {product.name} password to link it to your Aultrum ID.
                      </p>
                      <a href={launch(client.launchUrl)} className={cn(buttonClass, "py-2")}>Open {product.name}</a>
                    </div>
                  ) : null}
                  {!client && product.fallback ? (
                    <a href={product.fallback.href} className={cn(subtleButtonClass, "py-2")}>{product.fallback.label}</a>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="recent" className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 id="recent" className="text-sm font-semibold text-slate-900">Recent activity</h2>
          {items.length ? <a href="/activity" className="text-xs font-medium text-brand-700 hover:text-brand-800">All activity →</a> : null}
        </div>
        <Card className="overflow-hidden p-0">
          <ActivityList items={items} empty="Activity from your platforms shows here once you've opened them with your Aultrum ID." />
        </Card>
      </section>
    </div>
  );
}
