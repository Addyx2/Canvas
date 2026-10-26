"use client";

import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Message { id: string; from: "you" | "agent" | "staff"; name: string | null; text: string }

function visitorKey(): string {
  try {
    const existing = localStorage.getItem("gateway-visitor");
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
    const key = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem("gateway-visitor", key);
    return key;
  } catch {
    // Storage blocked (e.g. a private window): the chat still works for this visit.
    return Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
  }
}

export function ChatWidget({ installationId, serviceName }: { installationId: string; serviceName: string }) {
  const [visitor, setVisitor] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const url = `/api/gateway/${installationId}/webchat`;

  useEffect(() => setVisitor(visitorKey()), []);
  const load = useCallback(async () => {
    if (!visitor) return;
    const res = await fetch(`${url}?visitor=${visitor}`, { cache: "no-store" });
    if (res.ok) setMessages((await res.json()).messages);
  }, [url, visitor]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!visitor || !text.trim()) return;
    setSending(true);
    setProblem(null);
    const pending = text;
    setMessages((m) => [...m, { id: `pending-${Date.now()}`, from: "you", name: null, text: pending }]);
    setText("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitor, text: pending }) });
      if (!res.ok) throw new Error();
      setMessages((await res.json()).messages);
    } catch {
      setProblem("Your message didn't send. Please try again.");
      setText(pending);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{serviceName}</p>
        <p className="text-xs text-slate-500">Ask a question, report an absence or request staff. A person is always available.</p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? <p className="text-sm text-slate-500">Hello! How can we help today?</p> : null}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === "you" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.from === "you" ? "bg-ink text-white" : "bg-slate-100 text-slate-900"}`}>
              {m.from === "staff" && m.name ? <p className="mb-0.5 text-[11px] font-semibold opacity-70">{m.name}</p> : null}
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {problem ? <p role="status" className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{problem}</p> : null}
      <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
        <label htmlFor="chat-text" className="sr-only">Message</label>
        <input id="chat-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Type your message…" autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none focus:border-brand-500" />
        <button type="submit" disabled={sending || !text.trim()} aria-label="Send" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
