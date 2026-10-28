"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Award, Banknote, Check, Clock, Copy, Download, ExternalLink, Flame, Gift, GraduationCap, Heart, HeartHandshake, Medal, Moon, ShieldCheck, Sparkles, Tag, Trophy, Users, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { usePolling, useEmbedApi } from "./useEmbedApi";

type Kind = "SHIFT" | "ON_TIME" | "STREAK" | "PRAISE" | "AWARD" | "REDEMPTION" | "REVERSAL";
interface Entry { id: string; kind: Kind; points: number; reason: string; byName: string | null; createdAt: string; member?: { name: string } }
interface Reward { id: string; name: string; description: string; kind: "CASH_OUT" | "PERK"; cost: number }
interface Settings { pointValuePence: number; praise: number; shift: number; onTime: number; streakEvery: number; streakBonus: number }
interface Badge { id: string; badge: string; name: string; note: string; byName: string; points: number; createdAt: string; member?: { name: string } }
interface BadgeType { key: string; name: string; meaning: string }
interface Offer { id: string; partner: string; title: string; description: string; category: string; headline: string; expiresAt: string | null; claimed: boolean; code?: string | null; url?: string | null }

const BADGE_ICON: Record<string, LucideIcon> = {
  above_and_beyond: Sparkles, kindness: HeartHandshake, always_there: Clock, team_player: Users,
  night_hero: Moon, safe_hands: ShieldCheck, learning: GraduationCap, family_praise: Heart,
};
const CATEGORY: Record<string, string> = { training: "Training", wellbeing: "Wellbeing", money: "Money", shopping: "Shopping", other: "Other" };

function BadgeIcon({ badge, className = "h-5 w-5" }: { badge: string; className?: string }) {
  const Icon = BADGE_ICON[badge] ?? Medal;
  return <Icon className={className} aria-hidden="true" />;
}

interface ManagerData {
  view: "manager"; tenantName: string; settings: Settings; rewards: Reward[];
  members: { id: string; personId: string; name: string; streak: number; balance: number; badges: number }[];
  pending: { id: string; rewardName: string; kind: string; points: number; amountPence: number | null; createdAt: string; member: { name: string } }[];
  recent: Entry[];
  approved: { id: string; rewardName: string; kind: "CASH_OUT" | "PERK"; amountPence: number | null; decidedAt: string; decidedBy: string | null; member: { name: string } }[];
  paidBySystem: boolean;
  badges: Badge[];
  badgeTypes: BadgeType[];
}
interface MemberData {
  view: "member"; tenantName: string; settings: Settings; rewards: Reward[];
  me: { name: string; balance: number; streak: number; valuePence: number };
  entries: Entry[];
  redemptions: { id: string; rewardName: string; points: number; amountPence: number | null; status: "PENDING" | "APPROVED" | "DECLINED"; createdAt: string; note: string | null }[];
  badges: Badge[];
  offers: Offer[];
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
  const [giving, setGiving] = useState<{ memberId: string; kind: "PRAISE" | "AWARD" | "BADGE" } | null>(null);
  const [badge, setBadge] = useState(data.badgeTypes[0]?.key ?? "");
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

      {data.paidBySystem ? null : <CashOuts api={api} version={data.approved.map((r) => r.id).join()} />}

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
                      <p className="text-xs text-slate-500">{m.balance.toLocaleString("en-GB")} points{m.badges > 0 ? ` · ${m.badges} badge${m.badges === 1 ? "" : "s"}` : ""}{m.streak > 1 ? ` · ${m.streak} on time in a row` : ""}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`} onClick={() => { setGiving({ memberId: m.id, kind: "PRAISE" }); setReason(""); }}><Heart className="h-3.5 w-3.5" />Praise</button>
                    <button className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`} onClick={() => { setGiving({ memberId: m.id, kind: "BADGE" }); setReason(""); setPoints("0"); }}><Medal className="h-3.5 w-3.5" />Badge</button>
                    <button className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`} onClick={() => { setGiving({ memberId: m.id, kind: "AWARD" }); setReason(""); setPoints("25"); }}><Award className="h-3.5 w-3.5" />Bonus</button>
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
                if (giving.kind === "BADGE") {
                  const name = data.badgeTypes.find((b) => b.key === badge)?.name ?? "badge";
                  void run("give", () => api("/api/embed/peak/badge", { memberId: giving.memberId, badge, note: reason, points: Number(points) || 0 }), `Gave ${givingTo.name} the ${name} badge${Number(points) > 0 ? ` and ${points} points` : ""}.`).then(() => setGiving(null));
                  return;
                }
                void run("give", () => api("/api/embed/peak/award", { memberId: giving.memberId, kind: giving.kind, reason, points: giving.kind === "AWARD" ? Number(points) : undefined }), giving.kind === "PRAISE" ? `Praise sent to ${givingTo.name} (+${data.settings.praise}).` : `Gave ${givingTo.name} ${points} bonus points.`).then(() => setGiving(null));
              }}
            >
              <p className="text-sm font-semibold">{giving.kind === "PRAISE" ? `Praise ${givingTo.name}` : giving.kind === "BADGE" ? `Give ${givingTo.name} a badge` : `Bonus points for ${givingTo.name}`}</p>
              {giving.kind === "BADGE" ? (
                <fieldset className="grid grid-cols-2 gap-2">
                  <legend className="sr-only">Badge</legend>
                  {data.badgeTypes.map((b) => (
                    <label key={b.key} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs ${badge === b.key ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <input type="radio" name="badge" value={b.key} checked={badge === b.key} onChange={() => setBadge(b.key)} className="sr-only" />
                      <BadgeIcon badge={b.key} className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      <span><span className="block font-semibold text-slate-800">{b.name}</span><span className="text-slate-500">{b.meaning}</span></span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <label className="block text-xs font-medium text-slate-600">{giving.kind === "AWARD" ? "What's it for?" : "What did they do well?"}
                <input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={2} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </label>
              {giving.kind === "PRAISE" ? <p className="text-xs text-slate-500">Praise gives {data.settings.praise} points.</p> : (
                <label className="block text-xs font-medium text-slate-600">{giving.kind === "BADGE" ? "Bonus points (optional)" : "Points"}
                  <input type="number" min={giving.kind === "BADGE" ? 0 : 1} max={1000} value={points} onChange={(e) => setPoints(e.target.value)} className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                </label>
              )}
              <div className="flex gap-2">
                <button type="submit" disabled={busy === "give"} className={`${btn} bg-ink text-white hover:bg-slate-800`}>Give</button>
                <button type="button" onClick={() => setGiving(null)} className={`${btn} text-slate-600 hover:bg-slate-50`}>Cancel</button>
              </div>
            </form>
          ) : null}

          {data.badges.length > 0 ? (
            <section className={card}>
              <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold"><Medal className="h-4 w-4 text-brand-600" />Recent recognition</h2>
              <ul className="divide-y divide-slate-100">
                {data.badges.map((b) => (
                  <li key={b.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"><BadgeIcon badge={b.badge} className="h-4 w-4" /></span>
                    <div className="min-w-0"><p className="text-slate-800"><span className="font-medium">{b.member?.name}</span>: {b.name}</p><p className="truncate text-xs text-slate-500">“{b.note}” · {b.byName} · {ago(b.createdAt)}</p></div>
                  </li>
                ))}
              </ul>
            </section>
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
              <p className="px-4 pt-3 text-xs text-slate-500">{data.paidBySystem ? "Cash-outs were sent to your system to pay through payroll." : "Cash-outs appear under Cash-outs to pay. Give perks by hand."}</p>
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

      <BadgeShelf badges={data.badges} />

      <Offers offers={data.offers} api={api} refresh={refresh} />

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

function BadgeShelf({ badges }: { badges: Badge[] }) {
  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold"><Medal className="h-4 w-4 text-brand-600" />Your badges{badges.length > 0 ? <span className="rounded-full bg-brand-50 px-2 text-xs text-brand-700">{badges.length}</span> : null}</h2>
      {badges.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">When your manager recognises your work, your badges appear here.</p>
      ) : (
        <ul className="grid gap-3 p-4 sm:grid-cols-2">
          {badges.map((b) => (
            <li key={b.id} className="flex gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-brand-50/40 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><BadgeIcon badge={b.badge} /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{b.name}{b.points > 0 ? <span className="ml-1.5 text-xs font-medium text-emerald-700">+{b.points}</span> : null}</p>
                <p className="text-sm text-slate-700">“{b.note}”</p>
                <p className="mt-0.5 text-xs text-slate-500">{b.byName} · {ago(b.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Offers({ offers, api, refresh }: { offers: Offer[]; api: Api; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  if (offers.length === 0) return null;

  async function open(offer: Offer) {
    setBusy(offer.id);
    setError(null);
    try {
      await api(`/api/embed/peak/offers/${offer.id}`, {});
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold"><Tag className="h-4 w-4 text-brand-600" />Offers for you</h2>
      <p className="px-4 pt-3 text-xs text-slate-500">From Aultrum&apos;s partners, for everyone on Peak. They don&apos;t use your points.</p>
      {error ? <div className="px-4 pt-3"><Notice message={error} /></div> : null}
      <ul className="grid gap-3 p-4 sm:grid-cols-2">
        {offers.map((o) => (
          <li key={o.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{o.partner} · {CATEGORY[o.category] ?? o.category}</p>
                <p className="text-sm font-semibold text-slate-900">{o.title}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">{o.headline}</span>
            </div>
            {o.description ? <p className="text-sm text-slate-600">{o.description}</p> : null}
            {o.expiresAt ? <p className="text-xs text-slate-500">Ends {new Date(o.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p> : null}
            {o.claimed ? (
              <div className="mt-auto flex flex-wrap items-center gap-2">
                {o.code ? (
                  <button type="button" className={`${btn} border border-dashed border-slate-300 font-mono text-slate-800 hover:bg-slate-50`} onClick={() => { void navigator.clipboard?.writeText(o.code ?? ""); setCopied(o.id); }}>
                    {o.code}<Copy className="h-3.5 w-3.5" />{copied === o.id ? <span className="font-sans text-xs text-emerald-700">Copied</span> : null}
                  </button>
                ) : null}
                {o.url ? <a href={o.url} target="_blank" rel="noreferrer" className={`${btn} bg-ink text-white hover:bg-slate-800`}>Use offer<ExternalLink className="h-3.5 w-3.5" /></a> : null}
              </div>
            ) : (
              <button type="button" className={`${btn} mt-auto self-start bg-ink text-white hover:bg-slate-800`} disabled={busy === o.id} onClick={() => open(o)}>Get offer</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface CashOutRow { id: string; name: string; email: string | null; amountPence: number; points: number; reward: string; approvedAt: string | null; approvedBy: string | null; paidAt: string | null; paidBy: string | null }
interface CashOutData { unpaid: CashOutRow[]; paid: CashOutRow[]; totalPence: number; csv: string }

/** Approved cash-outs the organisation pays through its own payroll. */
function CashOuts({ api, version }: { api: Api; version: string }) {
  const [data, setData] = useState<CashOutData | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "red" | "green" } | null>(null);
  const [showPaid, setShowPaid] = useState(false);

  const load = useCallback(async () => {
    const next = await api<CashOutData>("/api/embed/peak/cashouts");
    setData(next);
    setChosen(new Set(next.unpaid.map((r) => r.id)));
  }, [api]);
  // Reload whenever a reward is approved.
  useEffect(() => { void load().catch(() => undefined); }, [load, version]);

  if (!data || (data.unpaid.length === 0 && data.paid.length === 0)) return null;
  const selected = data.unpaid.filter((r) => chosen.has(r.id));
  const selectedPence = selected.reduce((n, r) => n + r.amountPence, 0);

  function download() {
    const url = URL.createObjectURL(new Blob([data!.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `peak-cash-outs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function markPaid() {
    if (selected.length === 0) return;
    if (!window.confirm(`Mark ${selected.length} cash-out${selected.length === 1 ? "" : "s"} (${pounds(selectedPence)}) as paid? Only do this once they've gone through payroll.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ count: number }>("/api/embed/peak/cashouts", { ids: selected.map((r) => r.id) });
      setMessage({ text: `Marked ${res.count} as paid.`, tone: "green" });
      await load();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "That didn't work", tone: "red" });
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) => setChosen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Banknote className="h-4 w-4 text-brand-600" />Cash-outs to pay{data.unpaid.length > 0 ? <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">{data.unpaid.length} · {pounds(data.totalPence)}</span> : null}</h2>
        {data.unpaid.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`} onClick={download}><Download className="h-4 w-4" />Download for payroll</button>
            <button type="button" className={`${btn} bg-ink text-white hover:bg-slate-800`} disabled={busy || selected.length === 0} onClick={markPaid}><Check className="h-4 w-4" />Mark {selected.length === data.unpaid.length ? "all" : selected.length} paid</button>
          </div>
        ) : null}
      </div>
      <p className="px-4 pt-3 text-xs text-slate-500">Cash-outs are earnings: pay them through your payroll so tax and National Insurance are taken, then mark them paid here.</p>
      {message ? <div className="px-4 pt-3"><Notice message={message.text} tone={message.tone} /></div> : null}
      {data.unpaid.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">Nothing to pay. Approved cash-outs will appear here.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.unpaid.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <label className="flex min-w-0 cursor-pointer items-center gap-3">
                <input type="checkbox" checked={chosen.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4" />
                <span className="min-w-0"><span className="block truncate text-slate-800">{r.name}: {r.reward}</span><span className="text-xs text-slate-500">Approved {r.approvedAt ? ago(r.approvedAt) : ""}{r.approvedBy ? ` by ${r.approvedBy}` : ""}{r.email ? "" : " · no email in People"}</span></span>
              </label>
              <span className="tabular-nums font-semibold text-slate-800">{pounds(r.amountPence)}</span>
            </li>
          ))}
        </ul>
      )}
      {data.paid.length > 0 ? (
        <div className="border-t border-slate-100 px-4 py-2.5">
          <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-800" onClick={() => setShowPaid((v) => !v)}>{showPaid ? "Hide" : "Show"} recently paid ({data.paid.length})</button>
          {showPaid ? (
            <ul className="mt-2 space-y-1.5">
              {data.paid.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-xs text-slate-600">
                  <span className="min-w-0 truncate">{r.name}: {r.reward} · paid {r.paidAt ? ago(r.paidAt) : ""}{r.paidBy ? ` by ${r.paidBy}` : ""}</span>
                  <span className="tabular-nums">{pounds(r.amountPence)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
