"use client";

import { useActionState } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";

import { addOfferAction, type OfferFormState } from "./actions";

export function OfferForm({ categories }: { categories: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<OfferFormState, FormData>(addOfferAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className={labelClass}>Partner<input name="partner" required maxLength={80} placeholder="CareSkills Academy" className={`${inputClass} mt-1`} /></label>
      <label className={`${labelClass} lg:col-span-2`}>Offer<input name="title" required maxLength={120} placeholder="Care Certificate course" className={`${inputClass} mt-1`} /></label>
      <label className={labelClass}>Headline<input name="headline" required maxLength={30} placeholder="30% off" className={`${inputClass} mt-1`} /></label>
      <label className={`${labelClass} sm:col-span-2 lg:col-span-4`}>Details<input name="description" maxLength={400} placeholder="All 15 standards online, with a certificate employers accept." className={`${inputClass} mt-1`} /></label>
      <label className={labelClass}>Category
        <select name="category" defaultValue="training" className={`${inputClass} mt-1`}>{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
      </label>
      <label className={labelClass}>Code<input name="code" maxLength={60} placeholder="AULTRUM30" className={`${inputClass} mt-1 font-mono`} /></label>
      <label className={labelClass}>Link<input name="url" type="url" maxLength={400} placeholder="https://" className={`${inputClass} mt-1`} /></label>
      <label className={labelClass}>Ends (optional)<input name="expiresAt" type="date" className={`${inputClass} mt-1`} /></label>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
        <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Adding…" : "Add offer"}</button>
        {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : state.ok ? <p role="status" className="text-sm text-emerald-700">{state.ok}</p> : null}
      </div>
    </form>
  );
}
