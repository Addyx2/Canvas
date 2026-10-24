"use client";

import { useActionState } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";

import { signupAction, type SignupState } from "./actions";

const FIELDS = [
  { name: "organization", label: "Organisation", type: "text", autoComplete: "organization" },
  { name: "name", label: "Your name", type: "text", autoComplete: "name" },
  { name: "email", label: "Work email", type: "email", autoComplete: "email" },
  { name: "password", label: "Password (10+ characters)", type: "password", autoComplete: "new-password" },
];

export function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signupAction, {});
  return (
    <form action={formAction} className="space-y-4">
      {FIELDS.map((f) => (
        <div key={f.name}>
          <label htmlFor={f.name} className={labelClass}>{f.label}</label>
          <input id={f.name} name={f.name} type={f.type} autoComplete={f.autoComplete} required defaultValue={f.name === "password" ? undefined : state.values?.[f.name]} className={`mt-1 ${inputClass}`} />
        </div>
      ))}
      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={`${buttonClass} w-full py-2.5`}>
        {pending ? "Creating…" : "Create organisation"}
      </button>
    </form>
  );
}
