import Link from "next/link";

import { ElementOff } from "@/components/ElementOff";
import { PeakScreen } from "@/components/embed/PeakScreen";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { consoleScreenToken, ownInstallation } from "@/lib/standalone";

export const metadata = { title: "Peak" };
export const dynamic = "force-dynamic";

export default async function PeakPage() {
  const user = await requireUser();
  const installation = await ownInstallation(user.organizationId, "peak");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Peak"
        description="Recognition that pays. Give praise and bonuses, approve the rewards carers ask for, and see who is leading."
        action={installation && user.role === "ADMIN" ? <Link href={`/installations/${installation.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">Settings: points and rewards →</Link> : null}
      />
      {installation ? (
        <PeakScreen token={await consoleScreenToken(user, installation)} />
      ) : (
        <ElementOff
          elementKey="peak"
          name="Peak"
          isAdmin={user.role === "ADMIN"}
          points={[
            "Carers earn points for praise and bonuses from you, and for shifts and on-time clock-ins sent from your rota system.",
            "They ask for rewards from their own Peak page; you approve or decline.",
            "Every point is kept in a ledger. Cash-outs you approve are yours to pay.",
          ]}
        />
      )}
    </div>
  );
}
