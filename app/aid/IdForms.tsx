"use client";

import { useActionState, useEffect } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";

import { idLoginAction, idSignupAction, type IdFormState } from "./actions";

// After signing in, go on with a full page load: the next stop is usually the
// authorize endpoint, a route handler that redirects to another product.
function useContinue(state: IdFormState) {
  useEffect(() => {
    if (state.next) window.location.assign(state.next);
  }, [state.next]);
}

export function IdLoginForm({ returnTo }: { returnTo?: string }) {
  const [state, action, pending] = useActionState<IdFormState, FormData>(idLoginAction, {});
  useContinue(state);
  const busy = pending || !!state.next;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="return" value={returnTo ?? ""} />
      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.values?.email} className={`mt-1 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={`mt-1 ${inputClass}`} />
      </div>
      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={busy} className={`${buttonClass} w-full py-2.5`}>
        {busy ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}

export function IdSignupForm({ returnTo }: { returnTo?: string }) {
  const [state, action, pending] = useActionState<IdFormState, FormData>(idSignupAction, {});
  useContinue(state);
  const busy = pending || !!state.next;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="return" value={returnTo ?? ""} />
      <div>
        <label htmlFor="name" className={labelClass}>Your name</label>
        <input id="name" name="name" autoComplete="name" required defaultValue={state.values?.name} className={`mt-1 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>Work email</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.values?.email} className={`mt-1 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={`mt-1 ${inputClass}`} />
        <p className="mt-1 text-xs text-slate-500">At least 10 characters.</p>
      </div>
      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={busy} className={`${buttonClass} w-full py-2.5`}>
        {busy ? "Creating…" : "Create Aultrum ID"}
      </button>
    </form>
  );
}
