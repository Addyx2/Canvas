import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/Logo";
import { PeakScreen } from "@/components/embed/PeakScreen";
import { Card } from "@/components/ui";
import { requireSignedIn } from "@/lib/auth";
import { consoleScreenToken, ownInstallation } from "@/lib/standalone";

import { logoutAction } from "../login/actions";

export const metadata = { title: "My Peak" };
export const dynamic = "force-dynamic";

/** A carer's whole view of Elements: their own Peak points and rewards. */
export default async function MePage() {
  const user = await requireSignedIn();
  if (user.role !== "CARER") redirect("/dashboard");
  const installation = await ownInstallation(user.organizationId, "peak");
  return (
    <div className="min-h-screen bg-slate-50/60">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Wordmark />
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-slate-500 sm:inline">{user.name} · {user.organization.name}</span>
            <form action={logoutAction}>
              <button type="submit" className="flex items-center gap-1.5 font-medium text-slate-500 hover:text-slate-900"><LogOut className="h-4 w-4" /> Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-8">
        {installation && user.personId ? (
          <PeakScreen token={await consoleScreenToken(user, installation)} />
        ) : (
          <Card className="p-6">
            <h1 className="font-display text-lg font-semibold">Peak isn&apos;t on yet</h1>
            <p className="mt-1 text-sm text-slate-600">{user.organization.name} hasn&apos;t switched on Peak. Your points will show here once they do.</p>
          </Card>
        )}
      </main>
    </div>
  );
}
