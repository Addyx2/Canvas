import { requireWorkspaceIdentity } from "@/lib/aultrum-id/session";
import { prisma } from "@/lib/db";
import { Card, subtleButtonClass } from "@/components/ui";

import { signOutEverywhereAction } from "../actions";
import { NameForm, PasswordForm } from "./AccountForms";

export const metadata = { title: "Account" };

const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });

export default async function AccountPage() {
  const identity = await requireWorkspaceIdentity();
  const linked = await prisma.platformMembership.findMany({
    where: { identityId: identity.id },
    include: { client: { select: { name: true } } },
    orderBy: { lastSeenAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Your Aultrum ID</h1>
        <p className="mt-1 text-sm text-slate-500">
          {identity.email} · since {date.format(identity.createdAt)}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Profile</h2>
          <NameForm name={identity.name} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Password</h2>
          <PasswordForm />
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Linked platforms</h2>
          <p className="mt-1 text-sm text-slate-500">Platforms that know you by this Aultrum ID. Each still decides what you can do there.</p>
          <ul className="mt-4 divide-y divide-slate-100">
            {linked.length ? (
              linked.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="font-medium text-slate-900">{m.client.name} · {m.orgName}</span>
                  <span className="text-slate-500">{m.role} · last opened {date.format(m.lastSeenAt)}</span>
                </li>
              ))
            ) : (
              <li className="py-2.5 text-sm text-slate-500">None yet.</li>
            )}
          </ul>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Devices</h2>
          <p className="mt-1 text-sm text-slate-500">Lost a device or signed in somewhere shared? Sign out of Aultrum ID everywhere.</p>
          <form action={signOutEverywhereAction} className="mt-4">
            <button type="submit" className={subtleButtonClass}>Sign out everywhere</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
