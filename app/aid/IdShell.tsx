import { AultrumWordmark } from "@/components/AultrumMark";

const PRODUCTS = [
  { name: "Pleasant", line: "Care staffing" },
  { name: "Canvas", line: "Persona and Elements in your own systems" },
  { name: "Flowstate", line: "Full care operations" },
  { name: "Tender", line: "NHS discharge to assess" },
];

/** Split layout for Aultrum ID: what one account opens on the left, the form on the right. */
export function IdShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-600/30 blur-3xl" />
        <div className="relative"><AultrumWordmark product="ID" dark /></div>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">
            One account for every <span className="text-brand-300">Aultrum</span> platform.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Sign in once, then open any platform your organisation uses from Aultrum Workspace.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3">
            {PRODUCTS.map((p) => (
              <li key={p.name} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="mt-0.5 text-xs text-white/60">{p.line}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">&copy; 2026 Aultrum Technologies Ltd.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><AultrumWordmark product="ID" /></div>
          {children}
        </div>
      </section>
    </main>
  );
}
