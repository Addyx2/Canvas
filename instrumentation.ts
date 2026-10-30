import type { Instrumentation } from "next";

// Every server error (pages, route handlers, server actions, middleware) as
// one JSON log line, with the request id when the request carried one, so it
// can be found in the Vercel logs beside the request. If ALERT_WEBHOOK_URL is
// set (a Slack or Discord incoming webhook), the same error also posts there,
// at most once every 10 minutes for the same error.

const APP = "Elements";
const QUIET_MS = 10 * 60_000;
const lastAlert = new Map<string, number>();

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error instanceof Error ? (error as Error & { digest?: string }) : new Error(String(error));
  const header = (name: string) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const entry = {
    event: "server_error",
    app: APP,
    digest: "digest" in err ? err.digest : undefined,
    message: err.message.slice(0, 500),
    stack: err.stack?.split("\n").slice(0, 8).join("\n"),
    method: request.method,
    path: request.path.split("?")[0],
    requestId: header("x-request-id"),
    route: context.routePath,
    routeType: context.routeType,
  };
  console.error(JSON.stringify(entry));

  const hook = process.env.ALERT_WEBHOOK_URL;
  if (!hook) return;
  const key = `${entry.route}|${entry.message}`;
  const now = Date.now();
  if (now - (lastAlert.get(key) ?? 0) < QUIET_MS) return;
  lastAlert.set(key, now);
  const text = `${APP} error on ${entry.method} ${entry.path}: ${entry.message}${entry.digest ? ` (ref ${entry.digest})` : ""}`;
  await fetch(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, content: text }),
    signal: AbortSignal.timeout(3_000),
  }).catch(() => undefined);
};
