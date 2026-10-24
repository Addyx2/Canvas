import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Card, PageHeader, Td, Th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { findModule } from "@/lib/modules";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  return { title: findModule((await params).key)?.name ?? "Module" };
}

export default async function ModulePage({ params }: { params: Promise<{ key: string }> }) {
  const user = await requireUser();
  const mod = findModule((await params).key);
  if (!mod) notFound();
  const installs = await prisma.installation.findMany({
    where: { organizationId: user.organizationId, moduleKey: mod.key, status: { not: "UNINSTALLED" } },
    include: { platform: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <Link href="/modules" className="text-sm text-slate-500 hover:text-slate-800">← Modules</Link>
      <PageHeader
        title={mod.name}
        description={mod.description}
        action={<Badge tone={mod.status === "pilot" ? "brand" : "slate"}>{mod.status === "pilot" ? "Pilot" : "Planned"}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Sends to the platform</h2>
          <ul className="mt-3 space-y-2.5">
            {mod.emits.map((e) => (
              <li key={e.type}><code className="text-[13px] text-brand-800">{e.type}</code><p className="text-sm text-slate-500">{e.description}</p></li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Accepts from the platform</h2>
          <ul className="mt-3 space-y-2.5">
            {mod.consumes.map((e) => (
              <li key={e.type}><code className="text-[13px] text-blue-800">{e.type}</code><p className="text-sm text-slate-500">{e.description}</p></li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Actions it asks the platform to carry out</h2>
        <p className="mt-1 text-sm text-slate-500">The platform runs these with its own tools, so its permissions, approvals and audit log still apply.</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {mod.actions.map((a) => (
            <li key={a.name} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <code className="text-[13px]">{a.name}</code>
                <Badge tone={a.changesData ? "amber" : "slate"}>{a.changesData ? "Changes data" : "Read only"}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">{a.description}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4"><h2 className="text-sm font-semibold">Installations</h2></div>
        {installs.length === 0 ? (
          <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">Not installed anywhere yet. Platforms install modules through the <Link className="text-brand-700" href="/developers#install">API</Link>.</p>
        ) : (
          <table className="w-full border-t border-slate-100">
            <thead className="bg-slate-50"><tr><Th>Tenant</Th><Th>Platform</Th><Th>Status</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {installs.map((i) => (
                <tr key={i.id}><Td>{i.tenantName}</Td><Td>{i.platform.name}</Td><Td><Badge tone={i.status === "ACTIVE" ? "green" : "amber"}>{i.status === "ACTIVE" ? "Active" : "Paused"}</Badge></Td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
