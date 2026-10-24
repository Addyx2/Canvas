import { Wordmark } from "@/components/Logo";
import { MODULES } from "@/lib/modules";

/** Split layout for sign-in and sign-up: brand panel on the left, form on the right. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 right-[-120px] h-[420px] w-[420px] rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative"><Wordmark dark /></div>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">
            The console for <span className="text-brand-300">Persona</span> and Elements.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Bring Aultrum&apos;s AI and care modules into the systems you already run, and build custom modules on the same foundations.
          </p>
          <ul className="mt-8 space-y-3">
            {MODULES.map((m) => (
              <li key={m.key} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-300" />
                <div>
                  <p className="text-sm font-semibold">{m.name} <span className="ml-1 text-xs font-medium text-white/50">{m.status === "pilot" ? "Pilot" : "Coming soon"}</span></p>
                  <p className="mt-0.5 text-sm text-white/60">{m.tagline}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">&copy; 2026 Aultrum Technologies Ltd.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Wordmark /></div>
          {children}
        </div>
      </section>
    </main>
  );
}
