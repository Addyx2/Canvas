# Aultrum Canvas

Canvas runs Aultrum's modules, **Gateway** (one conversation layer for every
channel, agent and person) and **Peak** (recognition and rewards), and streams
them into the platforms customers already use, starting with **Pleasant**.

- App and sign-in: `canvas.aultrum.co.uk`
- Aultrum ID, one account across Aultrum's platforms: `id.aultrum.co.uk`
- Aultrum Workspace, where people open their platforms: `workspace.aultrum.co.uk`
- Marketing: `aultrum.co.uk/canvas`

One deployment answers on all three addresses; `middleware.ts` picks the
product by host. Aultrum ID's pages live under `app/aid` and Workspace's
under `app/ws`; those prefixes are never reachable on the Canvas host.
- Contract between Canvas, modules and platforms: [`docs/MODULE_CONTRACT.md`](docs/MODULE_CONTRACT.md)

## What's here

| Area | Path |
|---|---|
| Console: overview, Elements, connected systems, installations, events, developer guide | `app/(console)` |
| Platform API: modules, installations, events, embed tokens | `app/api/v1` |
| Module screens embedded in platforms | `app/embed/[module]` |
| Module manifests | `lib/modules.ts` |
| Embed tokens, webhook signatures, platform credentials | `lib/embed-token.ts`, `lib/webhook-signature.ts`, `lib/credentials.ts` |
| Aultrum ID: OpenID Connect provider (sign-in, authorize, token, userinfo, JWKS, logout) and the product API products report memberships and activity to | `app/aid`, `lib/aultrum-id` |
| Aultrum Workspace: platforms, activity, account | `app/ws` |
| Register a product with Aultrum ID | `scripts/aultrum-client.ts` |

## Aultrum ID for products

Aultrum ID is a standard OpenID Connect provider: authorization code flow,
PKCE (S256) required, RS256 ID tokens. Discovery is at
`https://id.aultrum.co.uk/.well-known/openid-configuration`.

1. Register the product: `npx tsx scripts/aultrum-client.ts --product pleasant --name Pleasant --app https://pleasant.aultrum.co.uk`.
   It prints the client ID and a secret (shown once).
2. The product sends people to `/authorize`, redeems the code at `/token` and
   verifies the ID token against `/jwks`. The redirect address is
   `<app>/api/auth/aultrum/callback`; Workspace's Open button goes to
   `<app>/api/auth/aultrum/start`.
3. Products link an Aultrum ID to their own account only after the person
   confirms that account's password once. Aultrum ID doesn't verify email
   addresses yet (`email_verified` is false), so the email alone must never
   grant access.
4. After sign-in, products tell Workspace where the person belongs and share
   summaries, with the same client credentials (HTTP Basic):
   - `PUT /api/v1/memberships` `{ sub, orgId, orgName, role }`, `DELETE` with `{ sub, orgId }`
   - `POST /api/v1/activity` `{ orgId, items: [{ id, kind, title, detail?, url?, roles?, occurredAt }] }`.
     Items with the same `id` are updated. `roles` limits who sees an item.
     Links must be on the product's own address. Never send care records or
     personal details.

## Run locally

```bash
cp .env.example .env        # set DATABASE_URL and AUTH_SECRET
npm install
npm run db:push
npm run db:seed             # admin@canvas.demo / canvas-demo-123
npm run dev -- -p 3200
```

`npm run check` runs typecheck, lint and tests.

## Deploy (Vercel)

1. Import this repository as a new Vercel project.
2. Set `DATABASE_URL` (its own Postgres database), `AUTH_SECRET`
   (`openssl rand -hex 32`) and `APP_URL=https://canvas.aultrum.co.uk`.
3. Add the domain `canvas.aultrum.co.uk` to the project, and the CNAME record
   Vercel shows to your DNS.
4. Open the site and create the first organisation; sign-up then closes
   (set `ALLOW_SIGNUP=true` to reopen it).
5. For Aultrum ID and Workspace: add the domains `id.aultrum.co.uk` and
   `workspace.aultrum.co.uk` to the same project, and set
   `AULTRUM_ID_URL=https://id.aultrum.co.uk`,
   `AULTRUM_WORKSPACE_URL=https://workspace.aultrum.co.uk` and
   `AULTRUM_ID_SIGNING_KEY` (an RSA private key:
   `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048`, pasted
   whole). Keep the key safe: anyone with it can sign people in to every
   Aultrum product.
6. Register each product with Aultrum ID by adding one variable per product,
   `AULTRUM_ID_CLIENT_<PRODUCT>="<product address>|<secret>"`, e.g.
   `AULTRUM_ID_CLIENT_PLEASANT="https://pleasant.aultrum.co.uk|<secret>"`
   (secret from `openssl rand -base64 32`). Give the product the same secret
   as `AULTRUM_ID_CLIENT_SECRET`, with `AULTRUM_ID_CLIENT_ID=aid_pleasant`.
   (`scripts/aultrum-client.ts` does the same against a database directly.)
