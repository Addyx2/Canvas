"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Award, Blocks, Code2, LayoutGrid, MessagesSquare, Plug, Puzzle, UserCog, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: "Elements",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutGrid },
      { href: "/gateway", label: "Gateway", icon: MessagesSquare },
      { href: "/peak", label: "Peak", icon: Award },
      { href: "/people", label: "People", icon: Users },
      { href: "/team", label: "Team", icon: UserCog, adminOnly: true },
    ],
  },
  {
    label: "Developers",
    items: [
      { href: "/systems", label: "Connected systems", icon: Plug },
      { href: "/installations", label: "Installations", icon: Blocks },
      { href: "/events", label: "Events", icon: Activity },
      { href: "/elements", label: "Catalogue", icon: Puzzle },
      { href: "/developers", label: "API", icon: Code2 },
    ],
  },
];

export function ConsoleNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-5">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex gap-1 lg:flex-col">
          <p className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 lg:block">{group.label}</p>
          {group.items.filter((i) => isAdmin || !("adminOnly" in i)).map(({ href, label, icon: Icon }) => {
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
        </div>
      ))}
    </nav>
  );
}
