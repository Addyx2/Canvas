import { formatDistanceToNowStrict } from "date-fns";

import { Badge, Card, PageHeader, Td, Th } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { cancelInviteAction, removeUserAction } from "./actions";
import { InviteForm } from "./InviteForm";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

const ROLE = { ADMIN: "Admin", MEMBER: "Member", CARER: "Carer" } as const;

export default async function TeamPage() {
  const user = await requireAdmin();
  const org = user.organizationId;
  const [users, invites, carers] = await Promise.all([
    prisma.user.findMany({ where: { organizationId: org }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.invite.findMany({ where: { organizationId: org, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    prisma.person.findMany({ where: { organizationId: org, kind: "carer" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  const signedUp = new Set(users.map((u) => u.personId).filter(Boolean));

  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Who can sign in. Admins and members run Gateway and Peak; carers sign in to see their own points and ask for rewards." />
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold">Invite someone</h2>
        <InviteForm carers={carers.filter((c) => !signedUp.has(c.id))} />
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-slate-50"><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Last signed in</Th><Th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <Td><span className="font-medium text-slate-900">{u.name}</span>{u.id === user.id ? <span className="ml-2 text-xs text-slate-400">You</span> : null}</Td>
                <Td>{u.email}</Td>
                <Td><Badge tone={u.role === "ADMIN" ? "brand" : "slate"}>{ROLE[u.role]}</Badge></Td>
                <Td>{u.lastLoginAt ? formatDistanceToNowStrict(u.lastLoginAt, { addSuffix: true }) : <span className="text-slate-400">Never</span>}</Td>
                <Td className="text-right">
                  {u.id !== user.id ? (
                    <form action={removeUserAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <button type="submit" className="text-sm font-medium text-slate-500 hover:text-red-700">Remove</button>
                    </form>
                  ) : null}
                </Td>
              </tr>
            ))}
            {invites.map((i) => (
              <tr key={i.id} className="bg-slate-50/50">
                <Td><span className="font-medium text-slate-700">{i.name}</span></Td>
                <Td>{i.email}</Td>
                <Td><Badge tone="slate">{ROLE[i.role]}</Badge></Td>
                <Td><span className="text-slate-500">Invited, expires {formatDistanceToNowStrict(i.expiresAt, { addSuffix: true })}</span></Td>
                <Td className="text-right">
                  <form action={cancelInviteAction}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="text-sm font-medium text-slate-500 hover:text-red-700">Cancel invite</button>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
