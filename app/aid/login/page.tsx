import Link from "next/link";

import { requestingApp } from "@/lib/aultrum-id/clients";

import { IdShell } from "../IdShell";
import { IdLoginForm } from "../IdForms";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Sign in · Aultrum ID" } };

export default async function IdLoginPage({ searchParams }: { searchParams: Promise<{ return?: string }> }) {
  const { return: returnTo } = await searchParams;
  const app = await requestingApp(returnTo);
  return (
    <IdShell>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Sign in with Aultrum ID</h2>
      <p className="mt-1 text-sm text-slate-500">{app ? `to continue to ${app}` : "to open Aultrum Workspace"}</p>
      <div className="mt-8"><IdLoginForm returnTo={returnTo} /></div>
      <p className="mt-8 text-center text-sm text-slate-500">
        No Aultrum ID yet?{" "}
        <Link href={`/signup${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ""}`} className="font-semibold text-brand-700 hover:text-brand-800">
          Create one
        </Link>
      </p>
    </IdShell>
  );
}
