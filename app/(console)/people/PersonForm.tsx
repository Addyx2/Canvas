"use client";

import { useActionState } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";

import { addPersonAction, type PersonFormState } from "./actions";

export function PersonForm() {
  const [state, action, pending] = useActionState<PersonFormState, FormData>(addPersonAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <label className={labelClass}>Name<input name="name" required maxLength={120} className={`${inputClass} mt-1`} /></label>
      <label className={labelClass}>Phone<input name="phone" placeholder="07700 900123" className={`${inputClass} mt-1`} /></label>
      <label className={labelClass}>Email<input name="email" type="email" className={`${inputClass} mt-1`} /></label>
      <label className={labelClass}>Who they are
        <select name="kind" defaultValue="carer" className={`${inputClass} mt-1`}><option value="carer">Carer</option><option value="client">Client contact</option><option value="other">Other</option></select>
      </label>
      <label className={labelClass}>Organisation<input name="organisation" placeholder="Optional" className={`${inputClass} mt-1`} /></label>
      <div className="flex items-center gap-4 sm:col-span-2 lg:col-span-5">
        <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Adding…" : "Add person"}</button>
        {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : state.ok ? <p role="status" className="text-sm text-emerald-700">{state.ok}</p> : null}
      </div>
    </form>
  );
}
