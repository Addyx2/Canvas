import Link from "next/link";

import { signupOpen } from "@/lib/signup";

import { AuthShell } from "../AuthShell";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; verified?: string }> }) {
  const { next, reset, verified } = await searchParams;
  const canSignUp = await signupOpen();
  return (
    <AuthShell>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Sign in to Elements</h2>
      <p className="mt-1 text-sm text-slate-500">Gateway, Peak, your people and your team.</p>
      {verified ? <p role="status" className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Your email is confirmed. Sign in to carry on.</p> : null}
      {reset ? <p role="status" className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Password changed. Sign in with your new password.</p> : null}
      <div className="mt-8"><LoginForm next={next} /></div>
      <div className="mt-8 space-y-2 text-center text-sm text-slate-500">
        {canSignUp ? (
          <p>
            New to Elements? <Link href="/signup" className="font-semibold text-brand-700 hover:text-brand-800">Create your organisation</Link>
          </p>
        ) : null}
        <p>
          <a href="https://aultrum.co.uk/elements" className="hover:text-slate-800">What is Aultrum Elements?</a>
        </p>
      </div>
    </AuthShell>
  );
}
