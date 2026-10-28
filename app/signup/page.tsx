import Link from "next/link";

import { signupOpen } from "@/lib/signup";

import { AuthShell } from "../AuthShell";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create your organisation" };

export default async function SignupPage() {
  const open = await signupOpen();
  return (
    <AuthShell>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Create your organisation</h2>
      {open ? (
        <>
          <p className="mt-1 text-sm text-slate-500">You&apos;ll be its first admin.</p>
          <div className="mt-8"><SignupForm /></div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            By creating an organisation you agree to the <a href="https://aultrum.co.uk/terms/" className="underline hover:text-slate-800">terms of service</a> and <a href="https://aultrum.co.uk/dpa/" className="underline hover:text-slate-800">data processing agreement</a>, and confirm you&apos;ve read the <a href="https://aultrum.co.uk/privacy/" className="underline hover:text-slate-800">privacy policy</a>.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-600">Elements is by invitation for now. Ask your admin to invite you.</p>
      )}
      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account? <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">Sign in</Link>
      </p>
    </AuthShell>
  );
}
