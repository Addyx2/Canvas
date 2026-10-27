import { Badge, Card, EmptyState, PageHeader, Td, Th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { removePersonAction } from "./actions";
import { PersonForm } from "./PersonForm";

export const metadata = { title: "People" };
export const dynamic = "force-dynamic";

const KIND = { carer: "Carer", client: "Client contact", other: "Other" } as Record<string, string>;

export default async function PeoplePage() {
  const user = await requireUser();
  const [people, logins] = await Promise.all([
    prisma.person.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.user.findMany({ where: { organizationId: user.organizationId, role: "CARER" }, select: { personId: true } }),
  ]);
  const withLogin = new Set(logins.map((l) => l.personId));

  return (
    <div className="space-y-6">
      <PageHeader title="People" description="Carers, client contacts and anyone else you work with. Gateway greets them by name when they call or text, and carers earn Peak points." />
      <Card className="p-5"><PersonForm /></Card>
      {people.length === 0 ? (
        <EmptyState title="No one added yet" description="Add your carers and the contacts who call you most." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50"><tr><Th>Name</Th><Th>Who</Th><Th>Phone</Th><Th>Email</Th><Th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((p) => (
                <tr key={p.id}>
                  <Td><span className="font-medium text-slate-900">{p.name}</span>{p.organisation ? <p className="text-xs text-slate-400">{p.organisation}</p> : null}</Td>
                  <Td><span className="flex flex-wrap items-center gap-1.5">{KIND[p.kind] ?? p.kind}{withLogin.has(p.id) ? <Badge tone="brand">Can sign in</Badge> : null}</span></Td>
                  <Td>{p.phone ?? <span className="text-slate-400">—</span>}</Td>
                  <Td>{p.email ?? <span className="text-slate-400">—</span>}</Td>
                  <Td className="text-right">
                    <form action={removePersonAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="text-sm font-medium text-slate-500 hover:text-red-700">Remove</button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
