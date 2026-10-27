import { cn } from "@/lib/utils";

// Brand images are masks painted in the current colour, so one file serves every theme.
const mask = (src: string) => ({ WebkitMask: `url(${src}) center / contain no-repeat`, mask: `url(${src}) center / contain no-repeat` });

/** The Elements app mark: the Aultrum "a" on an Aultrum blue tile. */
export function AppMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0021cc]", className)} aria-hidden="true">
      <span className="h-[55%] w-[55%] bg-white" style={mask("/brand/aultrum-mark.svg")} />
    </span>
  );
}

/** The Aultrum wordmark. Set its height; the width follows. */
export function AultrumLogo({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block aspect-[3251/638] bg-current", className)} style={mask("/brand/aultrum.svg")} />;
}

export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5" aria-label="Aultrum Elements">
      <AppMark className={dark ? "bg-white/10" : undefined} />
      <span className="flex flex-col gap-1 leading-none">
        <AultrumLogo className={cn("h-[11px]", dark ? "text-white/60" : "text-slate-500")} />
        <span className={cn("font-display text-[17px] font-bold tracking-tight", dark ? "text-white" : "text-ink")}>Elements</span>
      </span>
    </span>
  );
}
