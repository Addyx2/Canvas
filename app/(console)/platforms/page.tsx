import { format } from "date-fns";

import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { CreatePlatformForm, EditPlatformForm, RevokePlatformForm } from "./PlatformForms";

export const metadata = { title: "Platforms" };
export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const platforms = await prisma.platform.findMany({
    where: { organizationId: user.organizationId },
    include: { _count: { select: { installations: { where: { status: "ACTIVE" } } } } },
    orderBy: [{ revokedAt: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platforms"
        description="Products that stream Canvas modules, such as Pleasant. Each one gets a client ID and secret for the API, and a signing secret for the webhooks it receives."
      />

      {isAdmin ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Connect a platform</h2>
          <div className="mt-4 max-w-xl"><CreatePlatformForm /></div>
        </Card>
      ) : null}

      {platforms.length === 0 ? (
        <EmptyState title="No platforms connected" description="Connect Pleasant to stream Gateway and Peak into it." />
      ) : (
        <div className="space-y-4">
          {platforms.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-semibold">{p.name}</h2>
                    {p.revokedAt ? <Badge tone="red">Revoked</Badge> : <Badge tone="green">Connected</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Client ID <code className="text-slate-700">{p.clientId}</code> · {p._count.installations} active installation{p._count.installations === 1 ? "" : "s"} · since {format(p.createdAt, "d MMM yyyy")}
                  </p>
                </div>
                {isAdmin && !p.revokedAt ? (
                  <RevokePlatformForm id={p.id} name={p.name} />
                ) : null}
              </div>
              {isAdmin && !p.revokedAt ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-brand-700">Settings and secrets</summary>
                  <div className="mt-4 max-w-xl"><EditPlatformForm platform={p} /></div>
                </details>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
