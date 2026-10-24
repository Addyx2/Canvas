"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Blocks, Code2, LayoutGrid, Plug, Puzzle } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/modules", label: "Modules", icon: Puzzle },
  { href: "/platforms", label: "Platforms", icon: Plug },
  { href: "/installations", label: "Installations", icon: Blocks },
  { href: "/events", label: "Events", icon: Activity },
  { href: "/developers", label: "Developers", icon: Code2 },
];

export function ConsoleNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto lg:flex-col">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-brand-50 text-brand-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
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
