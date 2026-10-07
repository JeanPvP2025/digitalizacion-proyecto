# NODRIA

NODRIA is a fictional Spanish technology retailer built as an academic full-stack product demonstration. It brings a B2C storefront, B2B enquiry flow, customer area, PC Builder, and operations foundation into one Next.js application.

> **Demo notice:** the company, products, reviews, orders, and payment outcomes are fictional. The local demo can persist form submissions and orders to ignored files under `.data/`. No real payment is processed. Never enter bank-card details or real personal data.

## Current state

The storefront includes catalogue search/filter/sort, product pages, browser-persisted favorites and compare list, demo cart/checkout, account overview, support intake, B2B request form, PC compatibility builder, CRM and inventory views. Supabase SSR, server-side data modes, migrations/RLS and a fictional seed are present and validated against local PostgreSQL. The connected checkout still stops at pending payment; no remote credentials or production deployment exist. See [current status](./docs/STATUS.md).

## Local setup

Requirements: Node.js supported by Next.js 16 and pnpm 10.32.1.

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Open <http://localhost:3000>. The `.env.example` enables only the local development demo mode. For a connected Supabase project, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Never use a service-role key in a public variable.

## Commands

```powershell
pnpm dev
pnpm lint
pnpm build
pnpm start
```

Quality gates are available through `pnpm test` and `pnpm test:e2e`. Some flows remain local/demo-only or partial. Read [status](./docs/STATUS.md), [security](./docs/SECURITY.md) and [testing](./docs/TESTING.md) before treating a screen as a connected workflow.

## Shared context for contributors

- [Project brief](./docs/PROJECT_BRIEF.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Decisions](./docs/DECISIONS.md)
- [Status](./docs/STATUS.md)
- [Workstreams](./docs/WORKSTREAMS.md)
- [Agent handoff](./docs/AGENT_HANDOFF.md)
- [Agent rules](./AGENTS.md)

The repository and reviewed migrations are the source of truth when docs become stale. Before modifying Next.js code, read the relevant guide under `node_modules/next/dist/docs/` as directed by `AGENTS.md`.
