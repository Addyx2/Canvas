import Link from "next/link";

import { signupOpen } from "@/lib/signup";

import { AuthShell } from "../AuthShell";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const canSignUp = await signupOpen();
  return (
    <AuthShell>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Sign in to Canvas</h2>
      <p className="mt-1 text-sm text-slate-500">Manage Elements, connected systems and events.</p>
      <div className="mt-8"><LoginForm next={next} /></div>
      <div className="mt-8 space-y-2 text-center text-sm text-slate-500">
        {canSignUp ? (
          <p>
            New to Canvas? <Link href="/signup" className="font-semibold text-brand-700 hover:text-brand-800">Create your organisation</Link>
          </p>
        ) : null}
        <p>
          <a href="https://aultrum.co.uk/canvas/" className="hover:text-slate-800">What is Aultrum Canvas?</a>
        </p>
      </div>
    </AuthShell>
  );
}
