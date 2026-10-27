import Link from "next/link";

import { ElementOff } from "@/components/ElementOff";
import { GatewayInbox } from "@/components/embed/GatewayInbox";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { consoleScreenToken, ownInstallation } from "@/lib/standalone";

export const metadata = { title: "Gateway" };
export const dynamic = "force-dynamic";

export default async function GatewayPage() {
  const user = await requireUser();
  const installation = await ownInstallation(user.organizationId, "gateway");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gateway"
        description="Your AI receptionist for enquiries: calls, texts and web chat, answered from your own information. Conversations that need a person come first."
        action={installation && user.role === "ADMIN" ? <Link href={`/installations/${installation.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">Settings: phone, web chat, what Gateway says →</Link> : null}
      />
      {installation ? (
        <GatewayInbox token={await consoleScreenToken(user, installation)} />
      ) : (
        <ElementOff
          elementKey="gateway"
          name="Gateway"
          isAdmin={user.role === "ADMIN"}
          points={[
            "Answers calls, texts and web chat at any hour, from information you write.",
            "Takes down every enquiry and message, and lists them for your team to follow up.",
            "Puts people through to your team whenever they ask. Anyone who may be in danger is told to call 999 and your team is alerted.",
          ]}
        />
      )}
    </div>
  );
}
