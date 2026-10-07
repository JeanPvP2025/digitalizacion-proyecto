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
- All identities, organizations, tax IDs, product brands, reviews, orders, and transactions are fictional.

## Technical baseline

- Next.js App Router, React, strict TypeScript and Tailwind CSS.
- Supabase Auth, PostgreSQL, RLS and Storage for connected deployments.
- Zod request validation; Server Components by default; Client Components only for browser interaction.
- Vercel is the intended hosting target. No production project or credentials are configured.

## Demo and security rules

- No real money, Stripe, or bank-card collection. Never request or store a card number.
- Local checkout records demo orders, payment attempts and events beneath ignored `.data/` files. Quote and support intake also use local files. This filesystem fallback is only for local development.
- Supabase values are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put service-role/secret keys in browser code or `NEXT_PUBLIC_*` variables.
- State clearly when data is local demo data. Do not claim Supabase persistence unless the configured code path is integrated and verified.
- Do not run the local filesystem demo fallback in production.

## Shared project context

Read [Architecture](ARCHITECTURE.md), [Decisions](DECISIONS.md), [Status](STATUS.md), [Workstreams](WORKSTREAMS.md), and [Agent handoff](AGENT_HANDOFF.md) before beginning a delegated task.
