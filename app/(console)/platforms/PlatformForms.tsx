"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

import { buttonClass, inputClass, labelClass, subtleButtonClass } from "@/components/ui";

import {
  createPlatformAction,
  revokePlatformAction,
  rotateSecretsAction,
  updatePlatformAction,
  type PlatformFormState,
} from "./actions";

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <code className="flex-1 truncate text-[13px]">{value}</code>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}
          className="text-slate-400 hover:text-slate-700"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Credentials({ credentials }: { credentials: NonNullable<PlatformFormState["credentials"]> }) {
  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <KeyRound className="h-4 w-4" /> Copy these now. The secrets won&apos;t be shown again.
      </p>
      <CopyValue label="Client ID" value={credentials.clientId} />
      <CopyValue label="Client secret" value={credentials.clientSecret} />
      <CopyValue label="Webhook signing secret" value={credentials.webhookSecret} />
    </div>
  );
}

function Fields({ defaults }: { defaults?: { name: string; webhookUrl: string | null; allowedOrigins: string[] } }) {
  return (
    <>
      <div>
        <label className={labelClass} htmlFor="name">Platform name</label>
        <input id="name" name="name" required defaultValue={defaults?.name} placeholder="Pleasant" className={`mt-1 ${inputClass}`} />
      </div>
      <div>
        <label className={labelClass} htmlFor="webhookUrl">Webhook URL</label>
        <input id="webhookUrl" name="webhookUrl" defaultValue={defaults?.webhookUrl ?? ""} placeholder="https://pleasant.aultrum.co.uk/api/canvas/webhooks" className={`mt-1 ${inputClass}`} />
        <p className="mt-1 text-xs text-slate-500">Where modules send events. Leave blank until the platform is ready.</p>
      </div>
      <div>
        <label className={labelClass} htmlFor="allowedOrigins">Origins allowed to show module screens</label>
        <textarea id="allowedOrigins" name="allowedOrigins" rows={2} defaultValue={defaults?.allowedOrigins.join("\n")} placeholder="https://pleasant.aultrum.co.uk" className={`mt-1 ${inputClass}`} />
        <p className="mt-1 text-xs text-slate-500">One per line. Module screens can only be embedded on these sites.</p>
      </div>
    </>
  );
}

export function CreatePlatformForm() {
  const [state, action, pending] = useActionState<PlatformFormState, FormData>(createPlatformAction, {});
  if (state.credentials) return <Credentials credentials={state.credentials} />;
  return (
    <form action={action} className="space-y-4">
      <Fields />
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Connecting…" : "Connect platform"}</button>
    </form>
  );
}

export function EditPlatformForm({ platform }: { platform: { id: string; name: string; webhookUrl: string | null; allowedOrigins: string[] } }) {
  const [state, action, pending] = useActionState<PlatformFormState, FormData>(updatePlatformAction, {});
  const [rotateState, rotate, rotating] = useActionState<PlatformFormState, FormData>(rotateSecretsAction, {});
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={platform.id} />
        <Fields defaults={platform} />
        {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
        <button type="submit" disabled={pending} className={subtleButtonClass}>{pending ? "Saving…" : "Save changes"}</button>
      </form>
      {rotateState.credentials ? (
        <Credentials credentials={rotateState.credentials} />
      ) : (
        <form
          action={rotate}
          onSubmit={(e) => {
            if (!window.confirm("Rotate secrets? The platform stops working until it uses the new ones.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={platform.id} />
          {rotateState.error ? <p role="alert" className="mb-2 text-sm text-red-700">{rotateState.error}</p> : null}
          <button type="submit" disabled={rotating} className={subtleButtonClass}>{rotating ? "Rotating…" : "Rotate secrets"}</button>
        </form>
      )}
    </div>
  );
}

export function RevokePlatformForm({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={revokePlatformAction}
      onSubmit={(e) => {
        if (!window.confirm(`Revoke ${name}? Its API access and module screens stop working immediately. This can't be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700">Revoke</button>
    </form>
  );
}
