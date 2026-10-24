// Shared by server code and middleware, so nothing server-only here.
export const SESSION_COOKIE = "canvas_session";
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
/** How long an embed token is valid. Platforms request a fresh one per page view. */
export const EMBED_TOKEN_TTL_SECONDS = 300;
