import { cn } from "@/lib/utils";

/** The Aultrum mark, for Aultrum ID and Workspace. */
export function AultrumMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white", className)} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20 12 4l8 16" />
        <path d="M8 13h8" className="text-brand-300" stroke="currentColor" />
      </svg>
    </span>
  );
}

export function AultrumWordmark({ product, dark = false }: { product: string; dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <AultrumMark className={dark ? "bg-white/10" : undefined} />
      <span className="leading-tight">
        <span className={cn("block text-[11px] font-semibold uppercase tracking-[0.18em]", dark ? "text-white/50" : "text-slate-400")}>Aultrum</span>
        <span className={cn("block font-display text-[17px] font-bold tracking-tight", dark ? "text-white" : "text-ink")}>{product}</span>
      </span>
    </span>
  );
}
