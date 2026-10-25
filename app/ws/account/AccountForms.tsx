"use client";

import { useActionState } from "react";

import { buttonClass, inputClass, labelClass, subtleButtonClass } from "@/components/ui";

import { changePasswordAction, updateNameAction, type AccountState } from "../actions";

function Result({ state }: { state: AccountState }) {
  if (!state.message) return null;
  return <p role="status" className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-600"}>{state.message}</p>;
}

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateNameAction, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="name" className={labelClass}>Name</label>
        <input id="name" name="name" defaultValue={name} required className={`mt-1 ${inputClass}`} />
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className={subtleButtonClass}>{pending ? "Saving…" : "Save name"}</button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="current" className={labelClass}>Current password</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={`mt-1 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="next" className={labelClass}>New password</label>
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required className={`mt-1 ${inputClass}`} />
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Changing…" : "Change password"}</button>
      <p className="text-xs text-slate-500">Changing it signs you out everywhere, including Aultrum ID on other devices.</p>
    </form>
  );
}
