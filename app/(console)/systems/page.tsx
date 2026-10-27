import { format } from "date-fns";

import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { ConnectByKeyForm, CreatePlatformForm, EditPlatformForm, RevokePlatformForm } from "./PlatformForms";

export const metadata = { title: "Connected systems" };
export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  // Pleasant publishes its key here; connecting it is one click.
  const pleasantOrigin = (process.env.PLEASANT_URL ?? (process.env.NODE_ENV === "production" ? "https://pleasant.aultrum.co.uk" : "http://localhost:3100")).replace(/\/$/, "");
  const pleasantConnected = await prisma.platform.findFirst({ where: { clientId: new URL(pleasantOrigin).host, revokedAt: null } });
  const platforms = await prisma.platform.findMany({
    where: { organizationId: user.organizationId, builtIn: false },
    include: { _count: { select: { installations: { where: { status: "ACTIVE" } } } } },
    orderBy: [{ revokedAt: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connected systems"
        description="Your own software, or an Aultrum platform such as Flowstate or Pleasant, that uses Persona and Elements. Each one gets a client ID and secret for the API, and a signing secret for the webhooks it receives."
      />

      {isAdmin && !pleasantConnected ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Connect Pleasant</h2>
          <p className="mt-1 text-sm text-slate-500">So Pleasant agencies can switch on Gateway and Peak. Pleasant signs its own requests, so there is nothing to copy.</p>
          <div className="mt-4 max-w-xl"><ConnectByKeyForm suggested={{ name: "Pleasant", jwksUri: `${pleasantOrigin}/.well-known/jwks.json` }} /></div>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Connect another system</h2>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-700">With its public key (recommended)</summary>
            <div className="mt-4 max-w-xl"><ConnectByKeyForm /></div>
          </details>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-700">With a client ID and secret</summary>
            <div className="mt-4 max-w-xl"><CreatePlatformForm /></div>
          </details>
        </Card>
      ) : null}

      {platforms.length === 0 ? (
        <EmptyState title="No systems connected" description="Connect your software to use Elements such as Gateway inside it." />
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
