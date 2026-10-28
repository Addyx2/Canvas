"use client";

import { useActionState } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";

import { forgotAction, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(forgotAction, {});
  if (state.done) {
    return (
      <div role="status" className="space-y-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <p>If there&apos;s an account for that email, we&apos;ve sent a link to reset the password. It lasts an hour.</p>
        {state.link ? <a href={state.link} className="block break-all font-medium text-brand-700">{state.link}</a> : null}
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className={labelClass}>Work email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className={`mt-1 ${inputClass}`} />
      </div>
      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={`${buttonClass} w-full py-2.5`}>{pending ? "Sending…" : "Send reset link"}</button>
    </form>
  );
}
