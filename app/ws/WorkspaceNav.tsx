"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutGrid, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Platforms", icon: LayoutGrid },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/account", label: "Account", icon: UserRound },
];

export function WorkspaceNav() {
  // Pages are served from /ws internally; the browser sees the plain path.
  const pathname = usePathname().replace(/^\/ws(?=\/|$)/, "") || "/";
  return (
    <nav aria-label="Workspace" className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-brand-50 text-brand-900 ring-1 ring-inset ring-brand-600/10" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className={cn("h-4 w-4", active ? "text-brand-600" : "text-slate-400")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
