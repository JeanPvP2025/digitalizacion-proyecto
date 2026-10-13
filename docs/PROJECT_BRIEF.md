# NODRIA — Project Brief

## Product

NODRIA is a fictional Spanish technology retailer and services company for an academic full-stack demonstration. The product is one modular platform connecting a public B2C storefront, B2B entry point, customer self-service, and internal operations. It is not a real business, payment processor, shipping provider, or source of commercial or legal advice.

## Mission

Build a coherent product that demonstrates workflows across catalogue, discovery, commerce, B2B, CRM, inventory, support, operations, analytics, and staff access. Prefer integrated capabilities over disconnected screens. Every visible action must work, be visibly disabled, or be labeled as a deliberate demo limit.

## Market and identity

- Market: Spain first, with future international expansion in mind.
- Language and currency: Spanish (`es-ES`) and EUR.
- Brand: NODRIA — “Tecnología con sentido.”
- Visual direction: editorial commerce; deep forest green, warm paper, lime accent; Sora display, DM Sans body, IBM Plex Mono technical metadata.
- NODRIA is an academic demonstration brand. The public store uses real manufacturer models, MPNs, observed EUR prices, specifications, and distinct product photos; it presents them as NODRIA's own catalog and provides no outbound retailer purchase links.
- Accounts, organizations, stock, customer orders, payment attempts, and reviews created by the demo are not commercial records. Example review content is labeled as example material; published customer reviews must come from eligible delivered orders.

## Technical baseline

- Next.js App Router, React, strict TypeScript and Tailwind CSS.
- Supabase Auth, PostgreSQL, RLS and Storage for connected deployments.
- Zod request validation; Server Components by default; Client Components only for browser interaction.
- Hosted environment: Vercel project `nodria` at `https://nodria-academico.vercel.app`, connected to Supabase project `ypnhdxpejcbcyjiosrhf` in Europe. The old `nodria-staging.vercel.app` hostname permanently redirects to the final hostname. NODRIA remains a fictional demonstration, not a real retailer or payment service.
- Hosting and public-route smoke checks are live. Remote Supabase Auth email delivery, catalog migration state, RLS and authenticated workflows still require verification from an account with access to the configured Supabase project; see `STATUS.md` and `PRODUCTION_RUNBOOK.md`.

## Demo and security rules

- The storefront checkout is an in-site simulation: it automatically approves a payment outcome and records an order in the configured database. It never moves money, requests or stores card data, or causes real shipping/refunds.
- Do not present demo stock, orders, customers, or reviews as verified commercial activity. Quote and support intake may use local files only during local development.
- Supabase values are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put service-role/secret keys in browser code or `NEXT_PUBLIC_*` variables.
- State clearly when data is local demo data. Do not claim Supabase persistence unless the configured code path is integrated and verified.
- Do not run the local filesystem demo fallback in production.

## Shared project context

Read [Architecture](ARCHITECTURE.md), [Decisions](DECISIONS.md), [Status](STATUS.md), [Workstreams](WORKSTREAMS.md), and [Agent handoff](AGENT_HANDOFF.md) before beginning a delegated task.
