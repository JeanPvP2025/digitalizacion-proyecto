# NODRIA

NODRIA is a fictional Spanish technology retailer built as an academic full-stack product demonstration. It brings a B2C storefront, B2B enquiry flow, customer area, PC Builder, and operations foundation into one Next.js application.

> **Demo notice:** the company, products, reviews, orders, and payment outcomes are fictional. The local demo can persist form submissions and orders to ignored files under `.data/`. No real payment is processed. Never enter bank-card details or real personal data.

## Current state

The storefront includes catalogue search/filter/sort, product pages, browser-persisted favorites and compare list, a local file demo checkout, account overview, public support intake and B2B request forms, plus partial PC Builder, CRM and inventory surfaces. Supabase SSR, server-side data modes, migrations/RLS, a fictional seed and a server-resolved simulated payment flow are present and validated locally. Connected checkout and CRM/support routes have unit or database coverage, but there is no browser E2E against local Auth/PostgREST, remote credentials or production deployment. Some operational screens remain demo or partial. See [current status](./docs/STATUS.md) and [known limits](./docs/SECURITY.md).

## Local setup

Requirements: Node.js supported by Next.js 16 and pnpm 10.32.1. Docker Desktop is needed only for Supabase local.

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Open <http://localhost:3000>. For the file-backed local Demo Mode, leave the two Supabase variables empty and keep `DEMO_MODE=true`. It uses fictional records under ignored `.data/` files and does not create an Auth session. For Supabase local with Auth, migrations, seed, environment keys and reset steps, follow [the setup guide](./docs/SETUP.md). Never put a secret/service-role key in a `NEXT_PUBLIC_*` variable.

Follow the [10–15 minute academic demo script](./docs/DEMO_SCRIPT.md) for the approved/rejected checkout, public B2B request and support intake. It labels file Demo Mode separately from workflows that require Supabase local and Auth.

## Commands

```powershell
pnpm dev
pnpm lint
pnpm build
pnpm start
```

Quality gates are available through `pnpm test` and `pnpm test:e2e`. The current eight Playwright tests cover demo catalogue behavior and selected form/empty states; they do not submit checkout, quote or support forms in a browser. Some flows remain local/demo-only or partial. Read [status](./docs/STATUS.md), [security](./docs/SECURITY.md) and [testing](./docs/TESTING.md) before treating a screen as a connected workflow.

## Shared context for contributors

- [Project brief](./docs/PROJECT_BRIEF.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Decisions](./docs/DECISIONS.md)
- [Status](./docs/STATUS.md)
- [Workstreams](./docs/WORKSTREAMS.md)
- [Agent handoff](./docs/AGENT_HANDOFF.md)
- [Agent rules](./AGENTS.md)

The repository and reviewed migrations are the source of truth when docs become stale. Before modifying Next.js code, read the relevant guide under `node_modules/next/dist/docs/` as directed by `AGENTS.md`.
