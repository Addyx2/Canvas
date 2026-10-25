import type { ActivityItem } from "@prisma/client";

const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ActivityList({ items, empty }: { items: (ActivityItem & { source: string })[]; empty: string }) {
  if (items.length === 0) return <p className="px-5 py-8 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => {
        const body = (
          <>
            <p className="text-sm font-medium text-slate-900">{item.title}</p>
            {item.detail ? <p className="mt-0.5 text-sm text-slate-600">{item.detail}</p> : null}
            <p className="mt-1 text-xs text-slate-400">
              {item.source} · {when.format(item.occurredAt)}
            </p>
          </>
        );
        return (
          <li key={item.id}>
            {item.url ? (
              <a href={item.url} className="block px-5 py-3 transition hover:bg-slate-50">{body}</a>
            ) : (
              <div className="px-5 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
