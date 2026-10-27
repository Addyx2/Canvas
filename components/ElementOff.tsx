import { switchElementAction } from "@/app/(console)/element-actions";
import { Card, buttonClass } from "@/components/ui";

/** Shown on an Element's page until the organisation switches it on. */
export function ElementOff({ elementKey, name, points, isAdmin }: { elementKey: "gateway" | "peak"; name: string; points: string[]; isAdmin: boolean }) {
  return (
    <Card className="max-w-2xl space-y-4 p-6">
      <h2 className="font-display text-lg font-semibold">Switch on {name}</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">{points.map((p) => <li key={p}>{p}</li>)}</ul>
      {isAdmin ? (
        <form action={switchElementAction}>
          <input type="hidden" name="key" value={elementKey} />
          <input type="hidden" name="on" value="true" />
          <button type="submit" className={buttonClass}>Switch on {name}</button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Ask an admin in your organisation to switch it on.</p>
      )}
    </Card>
  );
}
