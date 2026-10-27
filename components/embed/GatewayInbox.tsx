"use client";

import { format, formatDistanceToNowStrict } from "date-fns";
import { Bot, Globe, Hand, MessageSquare, Phone, Send, Siren, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { usePolling, useEmbedApi } from "./useEmbedApi";

type Status = "NEEDS_PERSON" | "WITH_PERSON" | "WITH_AI" | "CLOSED";
type Channel = "WEBCHAT" | "SMS" | "VOICE";
interface Summary {
  id: string; channel: Channel; contact: string; contactName: string | null; intent: string; status: Status;
  summary: string | null; handoverReason: string | null; staffName: string | null; lastMessageAt: string; preview: string;
  followUp: boolean;
}
interface Detail extends Omit<Summary, "preview" | "lastMessageAt"> {
  createdAt: string;
  messages: { id: string; sender: "CONTACT" | "AGENT" | "STAFF" | "SYSTEM"; body: string; staffName: string | null; createdAt: string }[];
}

const STATUS: Record<Status, { label: string; className: string }> = {
  NEEDS_PERSON: { label: "Needs a person", className: "bg-red-50 text-red-700" },
  WITH_PERSON: { label: "With staff", className: "bg-blue-50 text-blue-800" },
  WITH_AI: { label: "Gateway answering", className: "bg-emerald-50 text-emerald-800" },
  CLOSED: { label: "Closed", className: "bg-slate-100 text-slate-600" },
};
const INTENT: Record<string, string> = { ENQUIRY: "Enquiry", MESSAGE: "Message", EMERGENCY: "Possible emergency", OTHER: "Other", ABSENCE: "Message", COVER_REQUEST: "Enquiry" };
const ChannelIcon = ({ channel }: { channel: Channel }) =>
  channel === "VOICE" ? <Phone className="h-3.5 w-3.5" /> : channel === "SMS" ? <MessageSquare className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />;
const btn = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50";

export function GatewayInbox({ token }: { token: string }) {
  const api = useEmbedApi(token);
  const list = usePolling(() => api<{ conversations: Summary[]; channels: { webchat: boolean; phone: string | null } }>("/api/embed/gateway"), 5000);
  const [selected, setSelected] = useState<string | null>(null);
  const conversations = list.data?.conversations ?? [];
  const needs = conversations.filter((c) => c.status === "NEEDS_PERSON").length;
  const toFollow = conversations.filter((c) => c.followUp);

  if (!list.data) return <p className="p-6 text-sm text-slate-500">{list.error ?? "Loading conversations…"}</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section className={`rounded-xl border border-slate-200 bg-white ${selected ? "hidden lg:block" : ""}`}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold">Conversations</h2>
          {needs > 0 ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{needs} need a person</span> : null}
        </div>
        {toFollow.length > 0 ? (
          <div className="border-b border-slate-100 bg-amber-50/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">To follow up · {toFollow.length}</p>
            <ul className="mt-2 space-y-1.5">
              {toFollow.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <button onClick={() => setSelected(c.id)} className="w-full truncate text-left text-sm text-slate-800 hover:text-brand-700">
                    <span className="font-medium">{c.contactName ?? c.contact}</span> · {c.summary ?? c.preview}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {conversations.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No conversations yet. {list.data.channels.phone ? `Calls and texts to ${list.data.channels.phone}` : "Calls and texts"}{list.data.channels.webchat ? " and your web chat" : ""} appear here.
          </p>
        ) : (
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {conversations.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSelected(c.id)} className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 ${selected === c.id ? "bg-brand-50/60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-900">
                      {c.intent === "EMERGENCY" ? <Siren className="h-4 w-4 shrink-0 text-red-600" /> : <ChannelIcon channel={c.channel} />}
                      <span className="truncate">{c.contactName ?? c.contact}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{formatDistanceToNowStrict(new Date(c.lastMessageAt))}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{c.summary ?? c.preview}</p>
                  <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {selected ? (
        <Conversation key={selected} id={selected} api={api} onBack={() => setSelected(null)} onChange={list.refresh} />
      ) : (
        <section className="hidden rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 lg:block">Choose a conversation to read it, reply or take over.</section>
      )}
    </div>
  );
}

function Conversation({ id, api, onBack, onChange }: { id: string; api: ReturnType<typeof useEmbedApi>; onBack: () => void; onChange: () => Promise<void> }) {
  const { data, error, refresh } = usePolling(() => api<{ conversation: Detail }>(`/api/embed/gateway/${id}`), 4000);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const count = data?.conversation.messages.length ?? 0;
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [count]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/api/embed/gateway/${id}`, body);
      if (body.action === "reply") setText("");
      await Promise.all([refresh(), onChange()]);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{error ?? "Loading…"}</section>;
  const c = data.conversation;
  const closed = c.status === "CLOSED";
  return (
    <section className="flex min-h-[60vh] flex-col rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <button onClick={onBack} className="mb-1 text-xs font-medium text-brand-700 lg:hidden">← All conversations</button>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><ChannelIcon channel={c.channel} />{c.contactName ?? c.contact}</p>
          <p className="text-xs text-slate-500">{c.contactName && c.channel !== "WEBCHAT" ? `${c.contact} · ` : ""}{INTENT[c.intent] ?? c.intent} · started {format(new Date(c.createdAt), "d MMM, HH:mm")}</p>
          {c.handoverReason && c.status === "NEEDS_PERSON" ? <p className="mt-1 text-xs font-medium text-red-700">{c.handoverReason}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {c.followUp ? (
            <button className={`${btn} bg-amber-500 text-white hover:bg-amber-600`} disabled={busy} onClick={() => act({ action: "followed_up" })}>Mark followed up</button>
          ) : null}
          {c.status === "WITH_AI" || c.status === "NEEDS_PERSON" ? (
            <button className={`${btn} bg-ink text-white hover:bg-slate-800`} disabled={busy} onClick={() => act({ action: "take_over" })}><Hand className="h-4 w-4" />Take over</button>
          ) : null}
          {c.status === "WITH_PERSON" || c.status === "NEEDS_PERSON" ? (
            <button className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`} disabled={busy} onClick={() => act({ action: "hand_back" })}><Undo2 className="h-4 w-4" />Hand back to Gateway</button>
          ) : null}
          {!closed ? <button className={`${btn} text-slate-600 hover:bg-slate-50`} disabled={busy} onClick={() => act({ action: "close" })}><X className="h-4 w-4" />Close</button> : null}
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {c.messages.map((m) =>
          m.sender === "SYSTEM" ? (
            <p key={m.id} className="text-center text-xs text-slate-400">{m.body} · {format(new Date(m.createdAt), "HH:mm")}</p>
          ) : (
            <div key={m.id} className={`flex ${m.sender === "CONTACT" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.sender === "CONTACT" ? "bg-slate-100 text-slate-900" : m.sender === "STAFF" ? "bg-ink text-white" : "bg-brand-50 text-slate-900"}`}>
                <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold opacity-70">
                  {m.sender === "AGENT" ? <><Bot className="h-3 w-3" />Gateway</> : m.sender === "STAFF" ? m.staffName ?? "Staff" : c.contactName ?? "Them"} · {format(new Date(m.createdAt), "HH:mm")}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          ),
        )}
        <div ref={end} />
      </div>

      {problem ? <p role="status" className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p> : null}
      {!closed ? (
        <form className="flex gap-2 border-t border-slate-100 p-3" onSubmit={(e) => { e.preventDefault(); void act({ action: "reply", text }); }}>
          <label className="sr-only" htmlFor="gateway-reply">Reply</label>
          <textarea id="gateway-reply" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1500}
            placeholder={c.channel === "WEBCHAT" ? "Reply in the web chat…" : "Reply by text message…"}
            className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          <button type="submit" disabled={busy || !text.trim()} className={`${btn} self-end bg-ink text-white hover:bg-slate-800`}><Send className="h-4 w-4" />Send</button>
        </form>
      ) : (
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Closed{c.summary ? `: ${c.summary}` : ""}. The record was sent to your system.</p>
      )}
    </section>
  );
}
