# The Canvas module contract

Aultrum Canvas runs each module (Gateway, Peak, and future modules) **once**, and
streams it into any **platform** that connects to it, such as Pleasant. This is
the contract between Canvas, a module and a platform.

## Terms

| Term | Meaning |
|---|---|
| **Module** | A product that runs on Canvas, e.g. Gateway. Described by a manifest (`lib/modules.ts`). |
| **Platform** | A product that shows modules to its users, e.g. Pleasant. Registered under *Platforms* with a client ID, client secret and webhook signing secret. |
| **Tenant** | A customer of the platform, e.g. one agency in Pleasant. |
| **Installation** | One module switched on for one tenant of one platform. |

## The four connections

1. **Install** – the platform calls `POST /api/v1/installations` with
   `{ module, tenantId, tenantName }`. Idempotent per platform, module and tenant.
   `DELETE /api/v1/installations/:id` uninstalls; events are kept for audit.
2. **Interface** – for each page view, the platform's server calls
   `POST /api/v1/embed-tokens` with `{ installationId, user: { id, name } }`
   and puts the returned `url` in an iframe. Tokens are HMAC-signed, last five
   minutes, and the screen sends `Content-Security-Policy: frame-ancestors` set
   to the platform's allowed origins, so no other site can frame it.
3. **Events** – platform → module: `POST /api/v1/installations/:id/events`
   with `{ type, data }`; only the types in the module's `consumes` list are
   accepted. Module → platform: Canvas posts JSON to the platform's webhook URL
   with `Canvas-Signature: t=<unix seconds>,v1=<hex>` where
   `v1 = HMAC-SHA256(webhookSecret, "<t>.<raw body>")`. Platforms must verify
   the signature and reject timestamps more than five minutes old.
4. **Actions** – a module never writes to a platform's data directly. It asks
   the platform to run one of the actions in its manifest (e.g.
   `mark_shift_uncovered`) through the platform's own tools, exposed over MCP or
   an authenticated endpoint. The platform applies its own permissions,
   approvals and audit log. *(Not built yet: the next step on the Pleasant side.)*

## Authentication

All platform API calls use HTTP Basic auth: `clientId:clientSecret`. Only a
SHA-256 hash of the client secret is stored; secrets are shown once and can be
rotated. Revoking a platform stops its API access and its embeds immediately.

## Safety rules every module follows

- Identity decides access: a caller is matched to a person in the platform
  before anything is shared or changed.
- Changes the platform's data only through platform actions, never directly.
- Emergencies: tell the caller to ring 999 and hand over to a person. A module
  never claims to dispatch help itself.
- Every event is recorded in the Canvas event log.
