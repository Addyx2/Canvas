import { redirect } from "next/navigation";

import { getSessionUser, homeFor } from "@/lib/auth";

import { AuthShell } from "../AuthShell";
import { logoutAction } from "../login/actions";
import { ResendForm } from "./ResendForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.emailVerified) redirect(homeFor(user.role));
  return (
    <AuthShell>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Check your email</h2>
      {expired ? <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">That link has expired or was already used. Send a new one below.</p> : null}
      <p className="mt-2 text-sm text-slate-600">
        We sent a link to <strong className="font-medium text-slate-900">{user.email}</strong>. Open it to confirm it&apos;s you, and you&apos;ll go straight to {user.organization.name}.
      </p>
      <p className="mt-2 text-sm text-slate-500">It can take a minute to arrive. Check your spam folder too.</p>
      <div className="mt-8"><ResendForm /></div>
      <form action={logoutAction} className="mt-8 border-t border-slate-200 pt-6">
        <button type="submit" className="text-sm font-medium text-slate-500 hover:text-slate-900">Wrong email? Sign out</button>
      </form>
    </AuthShell>
  );
}
