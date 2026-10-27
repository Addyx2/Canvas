"use client";

import { useActionState } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";

import { acceptInviteAction, type AcceptState } from "./actions";

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInviteAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" value={email} readOnly autoComplete="username" className={`mt-1 ${inputClass} bg-slate-50`} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>Choose a password (10+ characters)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className={`mt-1 ${inputClass}`} />
      </div>
      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={`${buttonClass} w-full py-2.5`}>{pending ? "Joining…" : "Join"}</button>
    </form>
  );
}
