import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { EMBED_TOKEN_TTL_SECONDS } from "@/lib/constants";
import { appUrl } from "@/lib/utils";

export const metadata = { title: "Developers" };

function Code({ children }: { children: string }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-4 text-[13px] leading-relaxed text-slate-100"><code>{children}</code></pre>;
}

function Section({ id, step, title, children }: { id: string; step: string; title: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-6 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{step}</p>
      <h2 className="mt-1 font-display text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </Card>
  );
}

export default async function DevelopersPage() {
  await requireUser();
  const base = appUrl();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Developers"
        description="How a platform such as Pleasant streams Canvas modules: install, show, exchange events, and carry out actions. The full contract is in docs/MODULE_CONTRACT.md."
      />

      <Section id="auth" step="Authentication" title="Call the API as your platform">
        <p>Connect your platform under <strong>Platforms</strong> to get a client ID and secret. Send them as HTTP Basic auth on every request. Keep the secret on your server only.</p>
        <Code>{`curl ${base}/api/v1/modules -u "$CANVAS_CLIENT_ID:$CANVAS_CLIENT_SECRET"`}</Code>
      </Section>

      <Section id="install" step="Step 1" title="Install a module for one of your tenants">
        <p>Call this when an admin switches the module on, for example Gateway for one agency. It is safe to repeat: the same tenant gets the same installation.</p>
        <Code>{`curl -X POST ${base}/api/v1/installations \\
  -u "$CANVAS_CLIENT_ID:$CANVAS_CLIENT_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"module":"gateway","tenantId":"agency_123","tenantName":"Brightwater Care"}'

# → 201 {"id":"cm…","module":"gateway","tenantId":"agency_123","status":"ACTIVE"}`}</Code>
        <p>Uninstall with <code>DELETE /api/v1/installations/:id</code>. List yours with <code>GET /api/v1/installations</code>.</p>
      </Section>

      <Section id="embed" step="Step 2" title="Show the module inside your app">
        <p>Each time a user opens the module, ask for a short-lived embed URL from your server, then put it in an iframe. Tokens last {EMBED_TOKEN_TTL_SECONDS / 60} minutes, and the screen can only be framed by the origins you allowed for your platform.</p>
        <Code>{`curl -X POST ${base}/api/v1/embed-tokens \\
  -u "$CANVAS_CLIENT_ID:$CANVAS_CLIENT_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"installationId":"cm…","user":{"id":"user_42","name":"Amara Okafor"}}'

# → {"url":"${base}/embed/gateway?token=…","expiresIn":${EMBED_TOKEN_TTL_SECONDS}}

<iframe src="{url}" title="Gateway" style="width:100%;height:720px;border:0"></iframe>`}</Code>
      </Section>

      <Section id="events" step="Step 3" title="Exchange events">
        <p><strong>To the module:</strong> send events the module accepts, listed on each module&apos;s page.</p>
        <Code>{`curl -X POST ${base}/api/v1/installations/cm…/events \\
  -u "$CANVAS_CLIENT_ID:$CANVAS_CLIENT_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"platform.shift.assigned","data":{"shiftId":"s_1","carer":"Daniel Nowak"}}'`}</Code>
        <p><strong>From the module:</strong> Canvas posts JSON to your webhook URL, signed with your webhook secret. Verify every request before acting on it:</p>
        <Code>{`// Canvas-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">
const [t, v1] = header.split(",").map((p) => p.split("=")[1]);
const expected = createHmac("sha256", WEBHOOK_SECRET).update(\`\${t}.\${rawBody}\`).digest("hex");
const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
if (!fresh || !timingSafeEqual(Buffer.from(v1), Buffer.from(expected))) return 401;`}</Code>
      </Section>

      <Section id="actions" step="Step 4" title="Let modules act through your tools">
        <p>Modules never write to your database. When Gateway needs to, say, mark a shift uncovered, it asks your platform to run that action through your own tools, so your permissions, approvals and audit log apply. Expose those tools to Canvas over MCP or an authenticated endpoint. Each module page lists the actions it needs and whether they change data.</p>
      </Section>
    </div>
  );
}
