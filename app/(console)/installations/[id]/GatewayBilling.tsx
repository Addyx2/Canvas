import { after } from "next/server";

import { Badge, Card } from "@/components/ui";
import { allowanceView } from "@/lib/allowance";
import { prisma } from "@/lib/db";
import { provisionGatewayNumber, shouldRetryNumber } from "@/lib/gateway/number";
import { aultrumTwilio, readGatewaySettings, usesOwnTwilio } from "@/lib/gateway/settings";

import { allowanceCheckoutAction, getGatewayNumberAction } from "./actions";

const button = "rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700";
const subtle = "rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-300";

/** Gateway's own number and the organisation's Allowance, at the top of its settings. */
export async function GatewayBilling({ installation, organizationId, isAdmin, paid, allowanceError }: { installation: { id: string; settings: unknown }; organizationId: string; isAdmin: boolean; paid?: string; allowanceError?: string }) {
  const s = readGatewaySettings(installation.settings);
  const own = usesOwnTwilio(s);
  // A Gateway without a number gets one by itself (and retries at most once an hour).
  if (!own && aultrumTwilio() && shouldRetryNumber(s)) after(() => provisionGatewayNumber(installation.id).then(() => undefined));
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { id: true, name: true } });
  const allowance = await allowanceView(org);
  const shown = s.number.phoneNumber.startsWith("+44") && s.number.phoneNumber.length === 13 ? `0${s.number.phoneNumber.slice(3, 7)} ${s.number.phoneNumber.slice(7)}` : s.number.phoneNumber;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">Gateway&apos;s number</h2>
        {own ? (
          <p className="text-sm text-slate-600">Gateway answers your own Twilio number, {s.twilio.phoneNumber}. Clear your Twilio details below to have Aultrum give it a number instead.</p>
        ) : s.number.status === "active" ? (
          <>
            <p className="font-display text-2xl font-bold tracking-tight text-slate-900">{shown}</p>
            <p className="text-sm text-slate-600">Calls and texts to this number are answered by Gateway. Put it on your website and letters.</p>
            <Badge tone="green">Answering</Badge>
          </>
        ) : (
          <div className="space-y-2 text-sm">
            <Badge tone={s.number.status === "failed" ? "amber" : "slate"}>{s.number.status === "failed" ? "No number yet" : "Setting up"}</Badge>
            <p className="text-slate-600">{s.number.error || "Gateway gets a UK mobile number of its own, for calls and texts. Web chat works meanwhile."}</p>
            {isAdmin ? <form action={getGatewayNumberAction}><input type="hidden" name="id" value={installation.id} /><button type="submit" className={subtle}>{s.number.status === "failed" ? "Try again" : "Get a number now"}</button></form> : null}
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">Allowance</h2>
        {paid === "paid" ? <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Thank you. Credits appear as soon as the payment is confirmed, usually within a minute.</p> : null}
        {allowanceError ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{allowanceError}</p> : null}
        {!allowance ? (
          <p className="text-sm text-slate-600">Your Allowance can&apos;t be shown right now. Gateway carries on meanwhile.</p>
        ) : !allowance.enforced ? (
          <p className="text-sm text-slate-600">Gateway will spend credits from {org.name}&apos;s Allowance (1 credit = 1p) once Aultrum billing starts. Nothing is charged yet.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="font-display text-2xl font-bold tracking-tight text-slate-900">{allowance.balance.toLocaleString("en-GB")} <span className="text-sm font-medium text-slate-500">credits</span></p>
            {!allowance.covered ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">Gateway needs a plan before it answers calls and texts with AI. Messages still reach your team.</p>
            ) : allowance.balance <= 0 ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">Out of credits: Gateway takes calls and messages for your team to return, without AI.</p>
            ) : null}
            {isAdmin ? (
              <div className="space-y-2">
                {!allowance.covered
                  ? allowance.plans.map((plan) => (
                      <form key={plan.key} action={allowanceCheckoutAction}>
                        <input type="hidden" name="id" value={installation.id} />
                        <input type="hidden" name="plan" value={plan.key} />
                        <button type="submit" className={`${button} w-full`}>{plan.name} plan, £{(plan.pence / 100).toFixed(0)}/month ({plan.credits.toLocaleString("en-GB")} credits)</button>
                      </form>
                    ))
                  : null}
                <div className="grid grid-cols-2 gap-2">
                  {allowance.packs.map((pack) => (
                    <form key={pack.key} action={allowanceCheckoutAction}>
                      <input type="hidden" name="id" value={installation.id} />
                      <input type="hidden" name="pack" value={pack.key} />
                      <button type="submit" className={`${subtle} w-full`}>£{(pack.pence / 100).toFixed(0)}: {pack.credits.toLocaleString("en-GB")}</button>
                    </form>
                  ))}
                </div>
              </div>
            ) : <p className="text-xs text-slate-500">An admin can top up.</p>}
            <details>
              <summary className="cursor-pointer text-slate-600">What Gateway costs</summary>
              <ul className="mt-2 space-y-1 text-slate-600">
                {allowance.prices.map((price) => <li key={price.action} className="flex justify-between gap-3"><span>{price.label} <span className="text-slate-400">{price.unit}</span></span><span className="tabular-nums">{price.credits}</span></li>)}
              </ul>
            </details>
          </div>
        )}
      </Card>
    </div>
  );
}
