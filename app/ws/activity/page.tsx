import { activityFor } from "@/lib/aultrum-id/feed";
import { requireWorkspaceIdentity } from "@/lib/aultrum-id/session";
import { Card } from "@/components/ui";

import { ActivityList } from "../ActivityList";

export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  const identity = await requireWorkspaceIdentity();
  const { items } = await activityFor(identity.id, 100);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Activity</h1>
        <p className="mt-1 text-sm text-slate-500">
          Summaries your platforms share, newest first. Care records and personal details stay inside each platform.
        </p>
      </div>
      <Card className="overflow-hidden p-0">
        <ActivityList items={items} empty="Nothing yet." />
      </Card>
    </div>
  );
}
