import { notFound } from "next/navigation";

import { ChatWidget } from "@/components/ChatWidget";
import { activeGateway } from "@/lib/gateway/channel";
import { readGatewaySettings, serviceNameOf } from "@/lib/gateway/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat", robots: { index: false } };

/** The web chat a provider embeds on its own website with an iframe. */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const installation = await activeGateway(id);
  const settings = installation ? readGatewaySettings(installation.settings) : null;
  if (!installation || !settings?.webchat) notFound();
  return <ChatWidget installationId={installation.id} serviceName={serviceNameOf(settings, installation.tenantName)} />;
}
