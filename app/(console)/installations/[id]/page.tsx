import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aiAvailable } from "@/lib/gateway/agent";
import { readGatewaySettings } from "@/lib/gateway/settings";
import { findModule } from "@/lib/modules";
import { ensureRewards } from "@/lib/peak/ledger";
import { formatPence, readPeakSettings } from "@/lib/peak/settings";
import { appUrl } from "@/lib/utils";

import { toggleRewardAction } from "./actions";
import { AddRewardForm, GatewaySettingsForm, PeakSettingsForm } from "./SettingsForms";

export const metadata = { title: "Installation settings" };
export const dynamic = "force-dynamic";

function Copy({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <code className="mt-1 block break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">{value}</code>
    </div>
  );
}

export default async function InstallationSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const installation = await prisma.installation.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { platform: { select: { name: true } } },
  });
  const mod = installation ? findModule(installation.moduleKey) : undefined;
  if (!installation || !mod) notFound();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <Link href="/installations" className="text-sm font-medium text-brand-700 hover:text-brand-800">← Installations</Link>
      <PageHeader title={`${mod.name} for ${installation.tenantName}`} description={`In ${installation.platform.name}. ${mod.tagline}`} />
      {installation.moduleKey === "gateway" ? <GatewaySettings installation={installation} isAdmin={isAdmin} /> : null}
      {installation.moduleKey === "peak" ? <PeakSettings installationId={installation.id} settings={installation.settings} isAdmin={isAdmin} /> : null}
    </div>
  );
}

function GatewaySettings({ installation, isAdmin }: { installation: { id: string; tenantName: string; settings: unknown }; isAdmin: boolean }) {
  const s = readGatewaySettings(installation.settings);
  const chatUrl = appUrl(`/chat/${installation.id}`);
  return (
    <>
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-semibold">How Gateway answers</h2>
          {aiAvailable() ? <Badge tone="green">AI agent on</Badge> : <Badge tone="amber">Rules only</Badge>}
        </div>
        <p className="text-sm text-slate-600">
          {aiAvailable()
            ? "Gateway's agent answers questions from what you write below, takes down enquiries and messages, and passes them to your team. It makes no arrangements itself. Anyone who may be in danger is told to call 999 and a person is alerted."
            : "This deployment has no AI key, so Gateway acknowledges each message and passes it to your team. Anyone who may be in danger is told to call 999 and a person is alerted."}
        </p>
      </Card>
      <Card className="p-5">
        {isAdmin ? (
          <GatewaySettingsForm
            id={installation.id}
            serviceName={s.serviceName}
            tenantName={installation.tenantName}
            about={s.about}
            onCallPhone={s.onCallPhone}
            webchat={s.webchat}
            accountSid={s.twilio.accountSid}
            phoneNumber={s.twilio.phoneNumber}
            hasToken={Boolean(s.twilio.authTokenSealed)}
          />
        ) : (
          <p className="text-sm text-slate-500">Only admins can change Gateway&apos;s settings.</p>
        )}
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Connect your channels</h2>
        <p className="text-sm text-slate-600">In Twilio, open your phone number and set these as the webhooks (HTTP POST).</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Copy label="A message comes in" value={appUrl(`/api/gateway/${installation.id}/sms`)} />
          <Copy label="A call comes in" value={appUrl(`/api/gateway/${installation.id}/voice`)} />
        </div>
        {s.webchat ? (
          <>
            <p className="pt-2 text-sm text-slate-600">To add web chat to your website, paste this where it should appear, or <a className="font-medium text-brand-700" href={chatUrl} target="_blank" rel="noreferrer">open the chat</a> to try it.</p>
            <Copy label="Web chat" value={`<iframe src="${chatUrl}" title="Chat with us" style="width:100%;max-width:400px;height:560px;border:1px solid #e2e8f0;border-radius:12px"></iframe>`} />
          </>
        ) : null}
      </Card>
    </>
  );
}

async function PeakSettings({ installationId, settings, isAdmin }: { installationId: string; settings: unknown; isAdmin: boolean }) {
  await ensureRewards(installationId);
  const s = readPeakSettings(settings);
  const rewards = await prisma.peakReward.findMany({ where: { installationId }, orderBy: [{ active: "desc" }, { cost: "asc" }] });
  return (
    <>
      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Points</h2>
        <p className="text-sm text-slate-600">Your system sends completed shifts, clock-ins and praise; Peak scores them with these rules.</p>
        {isAdmin ? <PeakSettingsForm id={installationId} values={s} /> : <p className="text-sm text-slate-500">Only admins can change the points.</p>}
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-semibold">Rewards</h2>
        <p className="text-sm text-slate-600">Carers ask for these from their Peak screen and a manager approves. Cash-outs are sent to your system to pay through payroll.</p>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {rewards.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className={r.active ? "" : "opacity-50"}>
                <p className="text-sm font-medium text-slate-900">{r.name} {r.active ? null : <span className="text-xs text-slate-500">(hidden)</span>}</p>
                <p className="text-xs text-slate-500">{r.cost.toLocaleString("en-GB")} points · {r.kind === "CASH_OUT" ? `pays ${formatPence(r.cost * s.pointValuePence)} through payroll` : "perk"}{r.description ? ` · ${r.description}` : ""}</p>
              </div>
              {isAdmin ? (
                <form action={toggleRewardAction}>
                  <input type="hidden" name="rewardId" value={r.id} />
                  <button type="submit" className="text-sm font-medium text-brand-700 hover:text-brand-800">{r.active ? "Hide" : "Show"}</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {isAdmin ? <AddRewardForm id={installationId} /> : null}
      </Card>
    </>
  );
}
