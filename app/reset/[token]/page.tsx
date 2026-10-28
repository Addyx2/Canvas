import Link from "next/link";

import { isLive } from "@/lib/auth-tokens";

import { AuthShell } from "../../AuthShell";
import { ResetForm } from "./ResetForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const live = await isLive(token, "reset_password");
  return (
    <AuthShell>
      {live ? (
        <>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Choose a new password</h2>
          <p className="mt-1 text-sm text-slate-500">You&apos;ll be signed out everywhere else.</p>
          <div className="mt-8"><ResetForm token={token} /></div>
        </>
      ) : (
        <>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">This link has ended</h2>
          <p className="mt-3 text-sm text-slate-600">Reset links last an hour and work once.</p>
          <Link href="/forgot" className="mt-6 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800">Send a new link</Link>
        </>
      )}
    </AuthShell>
  );
}
