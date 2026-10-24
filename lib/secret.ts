// The signing secret for sessions and embed tokens. Kept free of Node-only
// imports so middleware (Edge runtime) can use it too.
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set to a strong value in production");
    }
    return "dev-insecure-canvas-secret-change-me-123456";
  }
  return secret;
}
