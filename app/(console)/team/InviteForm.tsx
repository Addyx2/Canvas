"use client";

import { useActionState, useState } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";

import { inviteAction, type InviteFormState } from "./actions";

export function InviteForm({ carers }: { carers: { id: string; name: string; email: string | null }[] }) {
  const [state, action, pending] = useActionState<InviteFormState, FormData>(inviteAction, {});
  const [role, setRole] = useState("MEMBER");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  function pickCarer(id: string) {
    const carer = carers.find((c) => c.id === id);
    if (!carer) return;
    setName(carer.name);
    if (carer.email) setEmail(carer.email);
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <label className={labelClass}>Role
          <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className={`${inputClass} mt-1`}>
            <option value="MEMBER">Member: runs Gateway and Peak</option>
            <option value="ADMIN">Admin: also settings and team</option>
            <option value="CARER">Carer: sees only their own Peak</option>
          </select>
        </label>
        {role === "CARER" ? (
          <label className={labelClass}>Carer
            <select name="personId" required defaultValue="" onChange={(e) => pickCarer(e.target.value)} className={`${inputClass} mt-1`}>
              <option value="" disabled>{carers.length ? "Choose from People" : "Add carers in People first"}</option>
              {carers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        ) : <input type="hidden" name="personId" value="" />}
        <label className={labelClass}>Name<input name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} /></label>
        <label className={labelClass}>Email<input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} mt-1`} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Creating…" : "Create invite link"}</button>
        {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
      </div>
      {state.link ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="text-emerald-800">{state.ok}</p>
          <input readOnly value={state.link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" className={`${inputClass} mt-2 font-mono text-xs`} />
        </div>
      ) : null}
    </form>
  );
}
