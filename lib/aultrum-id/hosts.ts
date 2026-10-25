// Which product a request is for, by host. One deployment answers on three
// addresses: id.aultrum.co.uk (Aultrum ID), workspace.aultrum.co.uk
// (Aultrum Workspace) and canvas.aultrum.co.uk (the Canvas console).
// Kept free of Node-only imports: middleware (Edge runtime) uses it.

const strip = (url: string) => url.replace(/\/+$/, "");

/** The Aultrum ID issuer, e.g. https://id.aultrum.co.uk */
export function idUrl(): string {
  return strip(process.env.AULTRUM_ID_URL ?? "http://id.localhost:3200");
}

export function workspaceUrl(): string {
  return strip(process.env.AULTRUM_WORKSPACE_URL ?? "http://workspace.localhost:3200");
}

export type HostKind = "id" | "workspace" | "canvas";

export function hostKind(host: string | null): HostKind {
  if (!host) return "canvas";
  const h = host.toLowerCase();
  if (h === new URL(idUrl()).host) return "id";
  if (h === new URL(workspaceUrl()).host) return "workspace";
  return "canvas";
}

/** Internal route prefixes each host's pages live under (see middleware). */
export const HOST_PREFIX: Record<Exclude<HostKind, "canvas">, string> = { id: "/aid", workspace: "/ws" };

export const ID_SESSION_COOKIE = "aultrum_id";
export const WORKSPACE_SESSION_COOKIE = "aultrum_ws";
export const WORKSPACE_STATE_COOKIE = "aultrum_ws_state";
