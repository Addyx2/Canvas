"use client";

import { useActionState } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";

import { resetPasswordAction, type ResetState } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className={labelClass}>New password (10+ characters)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className={`mt-1 ${inputClass}`} />
      </div>
      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={`${buttonClass} w-full py-2.5`}>{pending ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
