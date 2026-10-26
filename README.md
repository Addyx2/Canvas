# Aultrum Canvas

Canvas runs Aultrum's modules, **Gateway** (one conversation layer for every
channel, agent and person) and **Peak** (recognition and rewards), and streams
them into the platforms customers already use, starting with **Pleasant**.

- App and sign-in: `canvas.aultrum.co.uk`
- Marketing: `aultrum.co.uk/canvas`
- Aultrum ID and Aultrum Workspace live in their own repository,
  [`Addyx2/aultrum-id`](https://github.com/Addyx2/aultrum-id).
- Contract between Canvas, modules and platforms: [`docs/MODULE_CONTRACT.md`](docs/MODULE_CONTRACT.md)

## What's here

| Area | Path |
|---|---|
| Console: overview, Elements, connected systems, installations, events, developer guide | `app/(console)` |
| Platform API: modules, installations, events, embed tokens | `app/api/v1` |
| Module screens embedded in platforms | `app/embed/[module]` |
| Module manifests | `lib/modules.ts` |
| Embed tokens, webhook signatures, platform credentials | `lib/embed-token.ts`, `lib/webhook-signature.ts`, `lib/credentials.ts` |

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
