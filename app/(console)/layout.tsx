import { LogOut } from "lucide-react";

import { Wordmark } from "@/components/Logo";
import { requireUser } from "@/lib/auth";

import { logoutAction } from "../login/actions";
import { ConsoleNav } from "./ConsoleNav";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-slate-50/60 lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4 lg:py-6">
          <Wordmark />
        </div>
        <div className="px-3 pb-3 lg:flex-1">
          <ConsoleNav />
        </div>
        <div className="hidden border-t border-slate-200 p-4 lg:block">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.organization.name} · {user.role === "ADMIN" ? "Admin" : "Member"}</p>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
