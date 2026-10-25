import { hashSecret } from "@/lib/credentials";
import { prisma } from "@/lib/db";

const PRODUCT_NAMES: Record<string, string> = {
  pleasant: "Pleasant",
  canvas: "Canvas",
  flowstate: "Flowstate",
  tender: "Tender",
};

/** The addresses Aultrum ID registers for a product served at `app`. */
export function clientRecord(product: string, name: string, app: string) {
  const base = app.replace(/\/+$/, "");
  return {
    name,
    product,
    redirectUris: [`${base}/api/auth/aultrum/callback`],
    postLogoutRedirectUris: [`${base}/login`],
    launchUrl: `${base}/api/auth/aultrum/start`,
  };
}

export interface EnvClient {
  product: string;
  app: string;
  secret: string;
}

/**
 * Products registered through the environment, one variable each:
 * AULTRUM_ID_CLIENT_PLEASANT="https://pleasant.aultrum.co.uk|<secret>".
 * The product sets the same secret as its AULTRUM_ID_CLIENT_SECRET, and its
 * client ID is aid_<product>. Malformed entries are skipped.
 */
export function envClients(env: Record<string, string | undefined> = process.env): EnvClient[] {
  const out: EnvClient[] = [];
  for (const [key, value] of Object.entries(env)) {
    const match = /^AULTRUM_ID_CLIENT_([A-Z][A-Z0-9_]*)$/.exec(key);
    if (!match || !value) continue;
    const [app, secret] = value.split("|").map((s) => s.trim());
    const product = match[1].toLowerCase();
    if (product === "workspace" || !secret || secret.length < 24) continue;
    try {
      const url = new URL(app);
      const ok = url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost");
      if (ok && url.pathname === "/" && !url.search) out.push({ product, app: url.origin, secret });
    } catch {
      // not a URL: skip
    }
  }
  return out;
}

let synced: Promise<void> | null = null;

/** Creates or updates the environment's products, once per server process. */
export function syncEnvClients(): Promise<void> {
  synced ??= (async () => {
    for (const c of envClients()) {
      const data = { ...clientRecord(c.product, PRODUCT_NAMES[c.product] ?? c.product, c.app), secretHash: hashSecret(c.secret), revokedAt: null };
      await prisma.oAuthClient.upsert({ where: { clientId: `aid_${c.product}` }, create: { clientId: `aid_${c.product}`, ...data }, update: data });
    }
  })().catch((error) => {
    synced = null;
    console.error("aultrum id: couldn't register clients from the environment", error);
  });
  return synced;
}

/** The product asking, when someone signs in to continue to one. */
export async function requestingApp(returnTo?: string): Promise<string | null> {
  if (!returnTo?.startsWith("/authorize?")) return null;
  const clientId = new URLSearchParams(returnTo.slice("/authorize?".length)).get("client_id");
  if (!clientId) return null;
  await syncEnvClients();
  const client = await prisma.oAuthClient.findUnique({ where: { clientId }, select: { name: true } });
  return client?.name ?? null;
}
