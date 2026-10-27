import Link from "next/link";

import { AuthShell } from "../AuthShell";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <AuthShell>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Reset your password</h2>
      <p className="mt-1 text-sm text-slate-500">We&apos;ll email you a link to choose a new one.</p>
      <div className="mt-8"><ForgotForm /></div>
      <p className="mt-8 text-center text-sm text-slate-500">
        Remembered it? <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">Sign in</Link>
      </p>
    </AuthShell>
  );
}
