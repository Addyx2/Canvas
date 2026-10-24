import { cn } from "@/lib/utils";

/** The Canvas mark: four tiles, one lit, for modules on a canvas. */
export function CanvasMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid h-8 w-8 grid-cols-2 gap-[3px] rounded-lg bg-ink p-[6px]", className)} aria-hidden="true">
      <span className="rounded-[2px] bg-brand-400" />
      <span className="rounded-[2px] bg-white/25" />
      <span className="rounded-[2px] bg-white/25" />
      <span className="rounded-[2px] bg-white/60" />
    </span>
  );
}

export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <CanvasMark className={dark ? "bg-white/10" : undefined} />
      <span className="leading-tight">
        <span className={cn("block text-[11px] font-semibold uppercase tracking-[0.18em]", dark ? "text-white/50" : "text-slate-400")}>Aultrum</span>
        <span className={cn("block font-display text-[17px] font-bold tracking-tight", dark ? "text-white" : "text-ink")}>Canvas</span>
      </span>
    </span>
  );
}
