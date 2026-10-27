import Link from "next/link";
import { format } from "date-fns";

import { Badge, Card, EmptyState, PageHeader, Td, Th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { findModule } from "@/lib/modules";

import { previewInstallationAction, sendTestEventAction, setInstallationStatusAction } from "./actions";

export const metadata = { title: "Installations" };
export const dynamic = "force-dynamic";

const STATUS = {
  ACTIVE: { label: "Active", tone: "green" },
  PAUSED: { label: "Paused", tone: "amber" },
  UNINSTALLED: { label: "Uninstalled", tone: "slate" },
} as const;

const linkButton = "text-sm font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50";

export default async function InstallationsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const installs = await prisma.installation.findMany({
    where: { organizationId: user.organizationId },
    include: { platform: { select: { name: true, webhookUrl: true } }, _count: { select: { events: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Installations" description="An Element switched on for one service in one of your systems, such as Gateway for one branch. Your systems install and uninstall through the API." />
      {installs.length === 0 ? (
        <EmptyState
          title="No installations yet"
          description="When a connected system switches on an Element for one of its services, it appears here."
          action={<Link href="/developers#install" className={linkButton}>How to switch on an Element →</Link>}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-slate-50"><tr><Th>Element</Th><Th>Service</Th><Th>System</Th><Th>Status</Th><Th>Events</Th><Th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {installs.map((i) => {
                const status = STATUS[i.status];
                return (
                  <tr key={i.id}>
                    <Td><span className="font-medium text-slate-900">{findModule(i.moduleKey)?.name ?? i.moduleKey}</span></Td>
                    <Td>{i.tenantName}<p className="text-xs text-slate-400">since {format(i.createdAt, "d MMM yyyy")}</p></Td>
                    <Td>{i.platform.name}</Td>
                    <Td><Badge tone={status.tone}>{status.label}</Badge></Td>
                    <Td>{i._count.events}</Td>
                    <Td className="text-right">
                      {isAdmin && i.status !== "UNINSTALLED" ? (
                        <div className="flex flex-wrap justify-end gap-4">
                          <Link href={`/installations/${i.id}`} className={linkButton}>Settings</Link>
                          <form action={previewInstallationAction} target="_blank">
                            <input type="hidden" name="id" value={i.id} />
                            <button type="submit" className={linkButton}>Preview</button>
                          </form>
                          {i.status === "ACTIVE" ? (
                            <form action={sendTestEventAction}>
                              <input type="hidden" name="id" value={i.id} />
                              <button type="submit" className={linkButton} title={i.platform.webhookUrl ? undefined : "The system has no webhook URL yet"}>
                                Send test event
                              </button>
                            </form>
                          ) : null}
                          <form action={setInstallationStatusAction}>
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="status" value={i.status === "ACTIVE" ? "PAUSED" : "ACTIVE"} />
                            <button type="submit" className="text-sm font-medium text-slate-500 hover:text-slate-800">
                              {i.status === "ACTIVE" ? "Pause" : "Resume"}
                            </button>
                          </form>
                        </div>
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
