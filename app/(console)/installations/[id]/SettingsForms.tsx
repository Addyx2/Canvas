"use client";

import { useActionState } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";

import { addRewardAction, saveGatewaySettingsAction, savePeakSettingsAction, type FormState } from "./actions";

function Result({ state, saved = "Saved." }: { state: FormState; saved?: string }) {
  if (state.error) return <p role="alert" className="text-sm text-red-700">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm text-emerald-700">{saved}</p>;
  return null;
}

export function GatewaySettingsForm(props: {
  id: string; serviceName: string; tenantName: string; about: string; onCallPhone: string; webchat: boolean;
  accountSid: string; phoneNumber: string; hasToken: boolean;
}) {
  const [state, action, pending] = useActionState(saveGatewaySettingsAction, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={props.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>Name callers hear
          <input name="serviceName" defaultValue={props.serviceName} placeholder={props.tenantName} maxLength={120} className={`${inputClass} mt-1`} />
        </label>
        <label className={labelClass}>Put calls through to
          <input name="onCallPhone" defaultValue={props.onCallPhone} placeholder="07700 900123" className={`${inputClass} mt-1`} />
          <span className="mt-1 block text-xs font-normal text-slate-500">When a caller needs a person. Leave empty to promise a call back instead.</span>
        </label>
      </div>
      <label className={labelClass}>What Gateway can tell people
        <textarea name="about" defaultValue={props.about} rows={6} maxLength={4000} className={`${inputClass} mt-1`}
          placeholder={"Office hours: Mon–Fri 8am–6pm.\nAreas: Bristol and South Gloucestershire.\nWhat we do: staff for care homes and home care providers.\nJobs: apply at example.co.uk/jobs"} />
        <span className="mt-1 block text-xs font-normal text-slate-500">Gateway answers questions only from this. Anything else goes to your team.</span>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="webchat" defaultChecked={props.webchat} className="h-4 w-4" />Web chat on your website</label>

      <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-800">Phone and text (Twilio)</legend>
        <p className="text-xs text-slate-500">From your Twilio account. The auth token is encrypted and never shown again.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={labelClass}>Account SID<input name="accountSid" defaultValue={props.accountSid} placeholder="AC…" className={`${inputClass} mt-1`} autoComplete="off" /></label>
          <label className={labelClass}>Auth token<input name="authToken" type="password" placeholder={props.hasToken ? "Saved. Enter a new one to replace it" : ""} className={`${inputClass} mt-1`} autoComplete="new-password" /></label>
          <label className={labelClass}>Twilio phone number<input name="phoneNumber" defaultValue={props.phoneNumber} placeholder="+441234567890" className={`${inputClass} mt-1`} /></label>
        </div>
        {props.hasToken ? <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="clearToken" className="h-4 w-4" />Remove the saved auth token</label> : null}
      </fieldset>
      <div className="flex items-center gap-4"><button type="submit" disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Save Gateway settings"}</button><Result state={state} /></div>
    </form>
  );
}

export function PeakSettingsForm({ id, values }: { id: string; values: Record<string, number> }) {
  const [state, action, pending] = useActionState(savePeakSettingsAction, {});
  const field = (name: string, label: string, hint?: string) => (
    <label className={labelClass}>{label}
      <input name={name} type="number" min={0} defaultValue={values[name]} className={`${inputClass} mt-1`} />
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {field("shift", "Completed shift")}
        {field("onTime", "On-time clock-in")}
        {field("graceMinutes", "Grace period (minutes)", "Still counts as on time")}
        {field("praise", "Praise")}
        {field("streakEvery", "Streak every", "On-time clock-ins in a row; 0 turns streaks off")}
        {field("streakBonus", "Streak bonus")}
        {field("pointValuePence", "Pence per point", "1 means 100 points cash out at £1")}
      </div>
      <div className="flex items-center gap-4"><button type="submit" disabled={pending} className={buttonClass}>{pending ? "Saving…" : "Save points"}</button><Result state={state} /></div>
    </form>
  );
}

export function AddRewardForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(addRewardAction, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1.2fr_1.5fr_0.9fr_0.7fr_auto] sm:items-end">
      <input type="hidden" name="id" value={id} />
      <label className={labelClass}>Reward<input name="name" required maxLength={80} placeholder="£10 shopping voucher" className={`${inputClass} mt-1`} /></label>
      <label className={labelClass}>Description<input name="description" maxLength={200} placeholder="Optional" className={`${inputClass} mt-1`} /></label>
      <label className={labelClass}>Type
        <select name="kind" className={`${inputClass} mt-1`} defaultValue="PERK"><option value="PERK">Perk</option><option value="CASH_OUT">Cash out (payroll)</option></select>
      </label>
      <label className={labelClass}>Points<input name="cost" type="number" min={1} required className={`${inputClass} mt-1`} /></label>
      <button type="submit" disabled={pending} className={buttonClass}>Add</button>
      <div className="sm:col-span-5"><Result state={state} saved="Reward added." /></div>
    </form>
  );
}
