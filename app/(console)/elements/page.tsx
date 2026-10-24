import Link from "next/link";

import { Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { MODULES } from "@/lib/modules";

export const metadata = { title: "Elements" };

export default async function ModulesPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader title="Elements" description="Ready-made care modules. Each runs once on Canvas and appears inside your connected systems: its screens, its events, and the actions it asks your system to take." />
      <div className="grid gap-4 md:grid-cols-2">
        {MODULES.map((m) => (
          <Link key={m.key} href={`/elements/${m.key}`}>
            <Card className="h-full p-6 transition hover:border-slate-300">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">{m.name}</h2>
                <Badge tone={m.status === "pilot" ? "brand" : "slate"}>{m.status === "pilot" ? "Pilot" : "Planned"}</Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{m.description}</p>
              <p className="mt-4 text-xs text-slate-500">
                Sends {m.emits.length} event types · accepts {m.consumes.length} · asks for {m.actions.length} actions
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
