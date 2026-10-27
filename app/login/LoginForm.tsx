"use client";

import Link from "next/link";
import { useActionState } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";

import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label htmlFor="email" className={labelClass}>Work email</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className={`mt-1 ${inputClass}`} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className={labelClass}>Password</label>
          <Link href="/forgot" className="text-sm font-medium text-brand-700 hover:text-brand-800">Forgot password?</Link>
        </div>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={`mt-1 ${inputClass}`} />
      </div>
      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={`${buttonClass} w-full py-2.5`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
