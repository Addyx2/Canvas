import Link from "next/link";

import { requestingApp } from "@/lib/aultrum-id/clients";

import { IdShell } from "../IdShell";
import { IdSignupForm } from "../IdForms";


export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Create your Aultrum ID" } };

export default async function IdSignupPage({ searchParams }: { searchParams: Promise<{ return?: string }> }) {
  const { return: returnTo } = await searchParams;
  const app = await requestingApp(returnTo);
  return (
    <IdShell>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Create your Aultrum ID</h2>
      <p className="mt-1 text-sm text-slate-500">
        {app ? `Then continue to ${app}.` : "Use your work email."} If you already use an Aultrum platform, use the same email:
        you&apos;ll confirm it&apos;s you the first time you open it.
      </p>
      <div className="mt-8"><IdSignupForm returnTo={returnTo} /></div>
      <p className="mt-8 text-center text-sm text-slate-500">
        Already have one?{" "}
        <Link href={`/login${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ""}`} className="font-semibold text-brand-700 hover:text-brand-800">
          Sign in
        </Link>
      </p>
    </IdShell>
  );
}
