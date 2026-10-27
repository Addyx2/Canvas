"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Award, Check, Flame, Gift, Heart, Trophy, X } from "lucide-react";
import { useState } from "react";

import { usePolling, useEmbedApi } from "./useEmbedApi";

type Kind = "SHIFT" | "ON_TIME" | "STREAK" | "PRAISE" | "AWARD" | "REDEMPTION" | "REVERSAL";
interface Entry { id: string; kind: Kind; points: number; reason: string; byName: string | null; createdAt: string; member?: { name: string } }
interface Reward { id: string; name: string; description: string; kind: "CASH_OUT" | "PERK"; cost: number }
interface Settings { pointValuePence: number; praise: number; shift: number; onTime: number; streakEvery: number; streakBonus: number }
interface ManagerData {
  view: "manager"; tenantName: string; settings: Settings; rewards: Reward[];
  members: { id: string; personId: string; name: string; streak: number; balance: number }[];
  pending: { id: string; rewardName: string; kind: string; points: number; amountPence: number | null; createdAt: string; member: { name: string } }[];
  recent: Entry[];
  approved: { id: string; rewardName: string; kind: "CASH_OUT" | "PERK"; amountPence: number | null; decidedAt: string; decidedBy: string | null; member: { name: string } }[];
  paidBySystem: boolean;
}
interface MemberData {
  view: "member"; tenantName: string; settings: Settings; rewards: Reward[];
  me: { name: string; balance: number; streak: number; valuePence: number };
  entries: Entry[];
  redemptions: { id: string; rewardName: string; points: number; amountPence: number | null; status: "PENDING" | "APPROVED" | "DECLINED"; createdAt: string; note: string | null }[];
}

const pounds = (pence: number) => `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
const card = "rounded-xl border border-slate-200 bg-white";
const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50";

function Points({ value }: { value: number }) {
  return <span className={`tabular-nums font-semibold ${value < 0 ? "text-slate-500" : "text-emerald-700"}`}>{value > 0 ? "+" : ""}{value}</span>;
}

function Notice({ message, tone = "red" }: { message: string | null; tone?: "red" | "green" }) {
  if (!message) return null;
  return <p role="status" className={`rounded-lg px-3 py-2 text-sm ${tone === "red" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{message}</p>;
}

export function PeakScreen({ token }: { token: string }) {
  const api = useEmbedApi(token);
  const { data, error, refresh } = usePolling(() => api<ManagerData | MemberData>("/api/embed/peak"), 20000);
  if (!data) return <p className="p-6 text-sm text-slate-500">{error ?? "Loading Peak…"}</p>;
  return data.view === "manager" ? <Manager data={data} api={api} refresh={refresh} /> : <Member data={data} api={api} refresh={refresh} />;
}

type Api = ReturnType<typeof useEmbedApi>;

function Manager({ data, api, refresh }: { data: ManagerData; api: Api; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "red" | "green" } | null>(null);
  const [giving, setGiving] = useState<{ memberId: string; kind: "PRAISE" | "AWARD" } | null>(null);
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState("25");

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage({ text: done, tone: "green" });
      await refresh();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "That didn't work", tone: "red" });
    } finally {
      setBusy(null);
    }
  }

  const givingTo = giving ? data.members.find((m) => m.id === giving.memberId) : null;

  return (
    <div className="space-y-5">
      <Notice message={message?.text ?? null} tone={message?.tone} />

      {data.pending.length > 0 ? (
        <section className={card}>
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold"><Gift className="h-4 w-4 text-brand-600" />Rewards to approve <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">{data.pending.length}</span></h2>
          <ul className="divide-y divide-slate-100">
            {data.pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{r.member.name}: {r.rewardName}</p>
                  <p className="text-xs text-slate-500">{r.points} points{r.amountPence ? ` · pays ${pounds(r.amountPence)} through payroll` : ""} · {ago(r.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <button className={`${btn} bg-ink text-white hover:bg-slate-800`} disabled={!!busy} onClick={() => run(r.id, () => api(`/api/embed/peak/redemptions/${r.id}`, { decision: "approve" }), `Approved ${r.rewardName} for ${r.member.name}.`)}>
                    <Check className="h-4 w-4" />Approve
                  </button>
                  <button className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`} disabled={!!busy} onClick={() => run(r.id, () => api(`/api/embed/peak/redemptions/${r.id}`, { decision: "decline" }), `Declined. ${r.member.name}'s points were returned.`)}>
                    <X className="h-4 w-4" />Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className={card}>
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold"><Trophy className="h-4 w-4 text-brand-600" />Leaderboard</h2>
          {data.members.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Points appear here as carers complete shifts and clock in on time.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.members.map((m, i) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-5 text-right text-xs font-semibold text-slate-400">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.balance.toLocaleString("en-GB")} points{m.streak > 1 ? ` · ${m.streak} on time in a row` : ""}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`} onClick={() => { setGiving({ memberId: m.id, kind: "PRAISE" }); setReason(""); }}><Heart className="h-3.5 w-3.5" />Praise</button>
                    <button className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`} onClick={() => { setGiving({ memberId: m.id, kind: "AWARD" }); setReason(""); }}><Award className="h-3.5 w-3.5" />Bonus</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          {giving && givingTo ? (
            <form
              className={`${card} space-y-3 p-4`}
              onSubmit={(e) => {
                e.preventDefault();
                void run("give", () => api("/api/embed/peak/award", { memberId: giving.memberId, kind: giving.kind, reason, points: giving.kind === "AWARD" ? Number(points) : undefined }), giving.kind === "PRAISE" ? `Praise sent to ${givingTo.name} (+${data.settings.praise}).` : `Gave ${givingTo.name} ${points} bonus points.`).then(() => setGiving(null));
              }}
            >
              <p className="text-sm font-semibold">{giving.kind === "PRAISE" ? `Praise ${givingTo.name}` : `Bonus points for ${givingTo.name}`}</p>
              <label className="block text-xs font-medium text-slate-600">{giving.kind === "PRAISE" ? "What did they do well?" : "What's it for?"}
                <input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={2} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </label>
              {giving.kind === "AWARD" ? (
                <label className="block text-xs font-medium text-slate-600">Points
                  <input type="number" min={1} max={1000} value={points} onChange={(e) => setPoints(e.target.value)} className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                </label>
              ) : <p className="text-xs text-slate-500">Praise gives {data.settings.praise} points.</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy === "give"} className={`${btn} bg-ink text-white hover:bg-slate-800`}>Give</button>
                <button type="button" onClick={() => setGiving(null)} className={`${btn} text-slate-600 hover:bg-slate-50`}>Cancel</button>
              </div>
            </form>
          ) : null}

          <section className={card}>
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Recent points</h2>
            {data.recent.length === 0 ? <p className="p-6 text-sm text-slate-500">Nothing yet.</p> : (
              <ul className="divide-y divide-slate-100">
                {data.recent.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0"><p className="truncate text-slate-800">{e.member?.name}</p><p className="truncate text-xs text-slate-500">{e.reason} · {ago(e.createdAt)}</p></div>
                    <Points value={e.points} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.approved.length > 0 ? (
            <section className={card}>
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Recently approved</h2>
              <p className="px-4 pt-3 text-xs text-slate-500">{data.paidBySystem ? "Cash-outs were sent to your system to pay through payroll." : "Pay cash-outs yourself, and give perks by hand: Peak isn't connected to a payroll."}</p>
              <ul className="divide-y divide-slate-100">
                {data.approved.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0"><p className="truncate text-slate-800">{r.member.name}: {r.rewardName}</p><p className="text-xs text-slate-500">Approved {ago(r.decidedAt)}{r.decidedBy ? ` by ${r.decidedBy}` : ""}</p></div>
                    {r.amountPence ? <span className="tabular-nums font-semibold text-slate-800">{pounds(r.amountPence)}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={`${card} p-4 text-xs leading-relaxed text-slate-500`}>
            <p className="font-semibold text-slate-700">How points are earned</p>
            <p className="mt-1">{data.settings.shift} per completed shift, {data.settings.onTime} for clocking in on time{data.settings.streakEvery > 0 ? `, ${data.settings.streakBonus} bonus every ${data.settings.streakEvery} on time in a row` : ""}, {data.settings.praise} for praise. 100 points cash out at {pounds(100 * data.settings.pointValuePence)}.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Member({ data, api, refresh }: { data: MemberData; api: Api; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "red" | "green" } | null>(null);
  const status = { PENDING: "Waiting for approval", APPROVED: "Approved", DECLINED: "Declined" } as const;

  async function redeem(reward: Reward) {
    setBusy(reward.id);
    setMessage(null);
    try {
      await api("/api/embed/peak/redeem", { rewardId: reward.id });
      setMessage({ text: `Requested ${reward.name}. Your manager will approve it.`, tone: "green" });
      await refresh();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "That didn't work", tone: "red" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className={`${card} p-4`}><p className="text-xs text-slate-500">Your points</p><p className="mt-1 font-display text-3xl font-bold tabular-nums">{data.me.balance.toLocaleString("en-GB")}</p></div>
        <div className={`${card} p-4`}><p className="text-xs text-slate-500">Worth</p><p className="mt-1 font-display text-3xl font-bold tabular-nums">{pounds(data.me.valuePence)}</p></div>
        <div className={`${card} p-4`}><p className="flex items-center gap-1 text-xs text-slate-500"><Flame className="h-3.5 w-3.5 text-amber-500" />On time in a row</p><p className="mt-1 font-display text-3xl font-bold tabular-nums">{data.me.streak}</p></div>
      </section>
      <Notice message={message?.text ?? null} tone={message?.tone} />

      <section className={card}>
        <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold"><Gift className="h-4 w-4 text-brand-600" />Rewards</h2>
        <ul className="divide-y divide-slate-100">
          {data.rewards.map((r) => {
            const short = r.cost - data.me.balance;
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0"><p className="text-sm font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{r.cost.toLocaleString("en-GB")} points{r.description ? ` · ${r.description}` : ""}</p></div>
                <button className={`${btn} ${short <= 0 ? "bg-ink text-white hover:bg-slate-800" : "border border-slate-200 text-slate-400"}`} disabled={short > 0 || !!busy} onClick={() => redeem(r)}>
                  {short > 0 ? `${short.toLocaleString("en-GB")} to go` : "Redeem"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {data.redemptions.length > 0 ? (
        <section className={card}>
          <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Your requests</h2>
          <ul className="divide-y divide-slate-100">
            {data.redemptions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">{r.rewardName}<span className="text-xs text-slate-500"> · {ago(r.createdAt)}</span></span>
                <span className={`text-xs font-semibold ${r.status === "APPROVED" ? "text-emerald-700" : r.status === "DECLINED" ? "text-slate-500" : "text-amber-700"}`}>{status[r.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={card}>
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">History</h2>
        {data.entries.length === 0 ? <p className="p-6 text-sm text-slate-500">Complete shifts and clock in on time to start earning.</p> : (
          <ul className="divide-y divide-slate-100">
            {data.entries.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0"><p className="text-slate-800">{e.reason}</p><p className="text-xs text-slate-500">{ago(e.createdAt)}</p></div>
                <Points value={e.points} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
