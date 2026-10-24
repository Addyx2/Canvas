import Link from "next/link";
import { format } from "date-fns";

import { Badge, Card, EmptyState, PageHeader, Td, Th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

import { retryEventAction } from "./actions";

export const metadata = { title: "Events" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "in", label: "From your systems" },
  { key: "out", label: "To your systems" },
  { key: "failed", label: "Failed" },
] as const;

const DELIVERY: Record<string, { label: string; tone: "green" | "red" | "slate" | "amber" }> = {
  DELIVERED: { label: "Delivered", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  SKIPPED: { label: "Not sent", tone: "slate" },
  PENDING: { label: "Pending", tone: "amber" },
};

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser();
  const filter = (await searchParams).filter ?? "all";
  const events = await prisma.event.findMany({
    where: {
      installation: { organizationId: user.organizationId },
      ...(filter === "in" ? { direction: "INBOUND" as const } : {}),
      ...(filter === "out" ? { direction: "OUTBOUND" as const } : {}),
      ...(filter === "failed" ? { deliveryStatus: "FAILED" } : {}),
    },
    include: { installation: { select: { moduleKey: true, tenantName: true, platform: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Events" description="Everything flowing between Elements and your systems: events your systems send in, and webhooks Elements send out, with delivery status." />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/events" : `/events?filter=${f.key}`}
            className={cn("rounded-full border px-3 py-1 text-sm", filter === f.key ? "border-ink bg-ink text-white" : "border-slate-300 text-slate-600 hover:bg-slate-100")}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {events.length === 0 ? (
        <EmptyState title="No events" description="Events appear here as your systems and Elements talk to each other." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-slate-50"><tr><Th>Event</Th><Th>Installation</Th><Th>Delivery</Th><Th>Time</Th><Th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((e) => {
                const delivery = e.deliveryStatus ? DELIVERY[e.deliveryStatus] : null;
                return (
                  <tr key={e.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Badge tone={e.direction === "INBOUND" ? "blue" : "brand"}>{e.direction === "INBOUND" ? "In" : "Out"}</Badge>
                        <code className="text-[13px] text-slate-800">{e.type}</code>
                      </div>
                    </Td>
                    <Td>{e.installation.tenantName}<p className="text-xs text-slate-400">{e.installation.platform.name} · {e.installation.moduleKey}</p></Td>
                    <Td>
                      {delivery ? <Badge tone={delivery.tone}>{delivery.label}</Badge> : <span className="text-xs text-slate-400">Received</span>}
                      {e.lastError ? <p className="mt-1 max-w-[260px] truncate text-xs text-red-600" title={e.lastError}>{e.lastError}</p> : null}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-slate-500">{format(e.createdAt, "d MMM, HH:mm:ss")}</Td>
                    <Td className="text-right">
                      {user.role === "ADMIN" && e.direction === "OUTBOUND" && e.deliveryStatus === "FAILED" ? (
                        <form action={retryEventAction}>
                          <input type="hidden" name="id" value={e.id} />
                          <button type="submit" className="text-sm font-medium text-brand-700 hover:text-brand-800">Retry</button>
                        </form>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
