import { AultrumWordmark } from "@/components/AultrumMark";
import { requireWorkspaceIdentity } from "@/lib/aultrum-id/session";

import { signOutAction } from "./actions";
import { WorkspaceNav } from "./WorkspaceNav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: { default: "Aultrum Workspace", template: "%s · Aultrum Workspace" },
  description: "Every Aultrum platform you use, in one place.",
};

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const identity = await requireWorkspaceIdentity();
  const initials = identity.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50/60 lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="px-5 py-4 lg:py-6">
          <AultrumWordmark product="Workspace" />
        </div>
        <div className="px-3 pb-3 lg:flex-1">
          <WorkspaceNav />
        </div>
        <div className="hidden border-t border-slate-200 p-4 lg:block">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/10">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{identity.name}</p>
              <p className="truncate text-xs text-slate-500">{identity.email}</p>
            </div>
          </div>
          <form action={signOutAction} className="mt-3">
            <button type="submit" className="text-sm font-medium text-slate-500 hover:text-slate-900">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
