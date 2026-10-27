"use client";

import { useActionState } from "react";

import { subtleButtonClass } from "@/components/ui";

import { resendVerificationAction, type ResendState } from "./actions";

export function ResendForm() {
  const [state, action, pending] = useActionState<ResendState>(resendVerificationAction, {});
  return (
    <form action={action} className="space-y-3">
      <button type="submit" disabled={pending} className={subtleButtonClass}>{pending ? "Sending…" : "Send the link again"}</button>
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
      {state.ok ? <p role="status" className="text-sm text-emerald-700">{state.ok}</p> : null}
      {state.link ? <a href={state.link} className="block break-all text-sm font-medium text-brand-700">{state.link}</a> : null}
    </form>
  );
}
