# Security follow-up: RLS and sensitive access

**Audit date:** 2026-10-07

**Target:** integrated second-wave schema in local Supabase/PostgreSQL 17.11

**Scope:** practical role/action review of public-schema tables, RPC grants, API boundaries, tenant isolation, and service-role usage. Product code and migrations were read-only.

## Executive result

No confirmed cross-customer data leak or authorization bypass was reproduced in the tested PostgreSQL paths. The existing runtime gate, 60 pgTAP assertions, and the supplemental transaction-backed probes pass. The supplemental cases exercise organization quotes/quote lines, support internal messages, return requests/lines, and a real synthetic payment row.

Two follow-ups remain:

1. **P2, least-privilege decision:** `sales_manager` can read organizations, all organization memberships, quotes, and quote lines across tenants. This matches the current RLS policy and is not a bypass by a customer role, but it exposes tax IDs, billing emails, membership user IDs/roles, and commercial quote details globally to sales accounts. Decide whether global access is an approved business requirement.
2. **P3, policy clarity:** `payments_read_owner_or_staff` names `sales_manager`, but its `EXISTS` subquery reads `orders`, whose own RLS excludes sales. Runtime access to another customer's payment row is therefore denied today. The old gate queried an empty payment set, so it did not prove that boundary; the supplemental test now inserts a synthetic payment row and checks owner, other-customer, and sales outcomes.

No product or migration changes were made. No remote Supabase project, Auth-issued browser token, or production deployment was available for verification.

## Evidence and reproduction

First confirm that `pnpm dlx supabase@latest migration list --local` shows the same migration versions in the checkout and database. Run against an already-migrated local Supabase database only when those versions match; each SQL file uses synthetic fixtures and rolls back its writes:

```powershell
pnpm dlx supabase@latest test db --local tests/database
Get-Content tests/integration/postgres-rls.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests/integration/security/postgres-object-isolation.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
pnpm dlx supabase@latest db lint --local
```

For the final run, I copied this worktree's `supabase/` files and the relevant tests to a temporary project with a unique project ID and ports. Its migration list matched exactly the two migrations in this checkout. Observed results there: 60 pgTAP checks passed; the existing PostgreSQL checkout/RLS gate passed; the supplemental security probes passed; database lint reported no schema errors. The new probe file uses `SET ROLE anon/authenticated` plus local JWT claim settings so PostgreSQL evaluates the actual RLS policies. It is not a substitute for GoTrue-issued tokens and PostgREST HTTP tests.

The grants/policy inventory was also read from the isolated database catalogs using `has_table_privilege`, `has_function_privilege`, `pg_class.relrowsecurity`, and `pg_policy`: 28/28 public tables had RLS enabled; 61 policies were permissive and none restrictive. PostgreSQL combines permissive policies with OR, so each additional permissive policy can widen access. No unexpected leftover policy name was found in the current local schema.

## Role and action matrix

The cells summarize effective access for sensitive table groups. “Observed” means a fixture-backed query or mutation was executed under that role. “Catalog only” means grants and policy expressions were inspected, but every row/action was not exercised. This is intentionally explicit: the audit is broad, not exhaustive CRUD proof for every cell.

| Role | SELECT | INSERT | UPDATE | DELETE | RPC invocation |
|---|---|---|---|---|---|
| `anon` | Published/active catalog rows by policy; no private business-table grants. Catalog row filtering is policy-inspected; private grants checked at runtime. | Bounded `crm_leads` and `quote_inquiries` submission with consent and column restrictions. Runtime positive/negative cases in the existing gates. | No table DML grant observed; grant inventory only. | No table DML grant observed; grant inventory only. | No public business RPC execution grant; checked in supplemental SQL. Private schema is not in the exposed PostgREST schemas. |
| Customer | Own-row policies cover profile, cart, orders, payments, quotes, tickets/messages, and returns; published catalog. Tested negative reads include other-customer order/payment/ticket/message/return rows. Positive own order/cart/profile/individual quote reads are not exhaustive. | Own cart/cart items, quote request/items, support ticket/messages, and public intake paths are policy-limited. Cross-customer support owner was rejected by the existing gate; quote insertion cases otherwise catalog-only. | Profile columns and own active cart items are grant/policy-limited; not every column/transition was executed. Protected order, stock, payment, and return transitions have no direct DML grant. | Own cart/cart items; buyer/viewer may remove their own organization membership. Other combinations catalog-only. | `create_organization`, `place_order`, `request_return` available to authenticated callers; ownership and relevant checkout/return bounds tested in pgTAP and the runtime gate. |
| B2B buyer (`organization_role=buyer`) | Own organization's organization row, own membership, shared organization quotes and quote lines; other-organization rows hidden. Tested with fixtures. | Same customer-owned writes; cannot add organization members. Membership denial tested in the existing runtime gate. | No membership UPDATE grant. Other own-row mutations as customer; not exhaustive. | May leave own buyer/viewer membership; owner/admin restrictions were inspected, not all delete cases executed. | Same authenticated RPCs, still scoped to the caller's own cart/order/organization. Cross-tenant order/return cases tested; organization RPC creates a caller-owned organization. |
| B2B admin (`organization_role=admin`) | Own organization's row, full same-organization roster, and its quotes/lines; cross-organization reads hidden. Tested. | May add buyer/viewer membership in its organization. Cross-tenant add and `owner` assignment rejected; tested. | Organization-row edits are policy-limited; membership UPDATE is revoked. Org field-by-field tests remain open. | May remove non-owner memberships within its organization; not exercised for every role/target. | Same authenticated RPCs; no staff/service-role authority is implied by organization admin. |
| `sales_manager` | All organizations and memberships plus both fixture quotes/quote lines were observed cross-tenant. `quote_inquiries` read is covered by the existing runtime gate. `crm_leads` global scope is policy-inspected only. Customer orders, payment rows, returns, support tickets, and inventory were not visible in tested fixture cases. | Can submit allowed lead/quote/inquiry data; role-specific insert matrix is catalog-inspected, not exhaustive. | CRM stages and quote operations are role-policy-limited; action test uses a Supabase double, not live SQL. | Quote-item deletion is allowed by its RLS policy; other deletes are denied or not tested. | Authenticated customer RPCs remain caller-scoped. Service-only payment/fulfillment/inventory RPCs are denied to `authenticated`, including sales; grant checks and pgTAP cover this. |
| `fulfillment_manager` | Orders, order items/events, stock, reservation/movement ledgers, and returns for operations. Inventory and orders were fixture-tested; ledger and return row coverage remains partial. No CRM or support queue rows observed. | No direct writes to warehouse/stock/order/payment/reservation/movement tables. Grants checked; RPC-only mutations require `service_role`. | Direct protected operational DML is revoked; tested by effective-grant checks. | Same: direct protected DML is revoked; catalog-level checks. | Can invoke the three caller-scoped authenticated RPCs as a user; cannot invoke payment outcome, fulfillment, delivery, or inventory-adjustment RPCs with its user JWT. |
| `support_agent` | Support queue and internal messages, plus operational orders and return data by policy. Ticket/message/order visibility tested; order-item/event and return-row outcomes are policy-inspected, not fully probed. Inventory and payment access were tested as absent; CRM access is policy-inspected. | Can add staff messages to an existing ticket (including internal); the policy was inspected but that exact write was not separately exercised. Customer-ticket creation remains self-owned. | May update support tickets; not every field transition tested. Return update is not granted to support. | No direct support-message delete grant; remaining delete combinations catalog-only. | Caller-scoped authenticated RPCs only; privileged service-role RPCs denied. |
| `super_admin` | Organizations, memberships, role grants, audit events, and orders across users; selected rows tested. Profiles remain self-only. Other table groups are policy/catalog-inspected rather than exhaustively queried. | Can add buyer/viewer memberships under current policy; role escalation to owner is not allowed through direct membership DML. Catalog CRUD is allowed by policy/grant. Full table matrix not executed. | Catalog, organizations, CRM, support and quote updates are policy/grant-scoped; no direct order/payment/stock transition grant. Full column/action matrix not executed. | Catalog and quote-item deletion are policy/grant-scoped; owner membership and protected operational deletes remain restricted. Full matrix not executed. | Same authenticated customer RPCs. Super-admin is not `service_role`; privileged outcome/fulfillment/stock RPCs remain unavailable to its user JWT. |

### Table groups included in the inventory

- Identity and organizations: `profiles`, `user_role_grants`, `organizations`, `organization_memberships`.
- Catalog: `categories`, `products`, `product_categories`, `product_variants`, `product_specifications`.
- Stock and fulfillment: `warehouses`, `inventory`, `inventory_movements`, `inventory_reservations`.
- Commerce: `carts`, `cart_items`, `orders`, `order_items`, `order_events`, `payment_transactions`.
- CRM/B2B: `quotes`, `quote_items`, `crm_leads`, `quote_inquiries`.
- Support and audit: `support_tickets`, `support_messages`, `return_requests`, `return_items`, `audit_events`.

### RPC matrix

| RPC | `anon` | Authenticated customer/business/staff/super-admin | `service_role` | Evidence / boundary |
|---|---|---|---|---|
| `create_organization` | Denied | Allowed; function binds creator and first owner to `auth.uid()` | Execute grant present, but the user-scoped function still requires `auth.uid()` | pgTAP positive case; function grant inventory |
| `place_order` | Denied | Allowed; private definer validates the authenticated cart owner and reserves stock transactionally | Execute grant present | Checkout runtime gate: owner, cross-customer cart, stock and idempotent retry |
| `request_return` | Denied | Allowed; only caller's delivered order, 30-day window, purchased line IDs/quantities | Execute grant present, but function requires `auth.uid()` | pgTAP: valid return, overclaim and cross-customer denial |
| `resolve_demo_payment`, `fulfill_order`, `mark_order_delivered`, `adjust_inventory` | Denied | Denied for every authenticated app role, including super-admin | Allowed | pgTAP exercises successful service-role transitions; supplemental grant probe checks denial |
| `private.*` helpers | Not exposed through configured PostgREST schemas | Some execute grants support RLS expressions; direct DB role grants were inventoried | Internal or privileged as declared | `private` is absent from `supabase/config.toml` API schemas; no direct HTTP invocation was tested |

## Findings and recommendations

### SEC-01 — Global sales visibility across business tenants

- **Severity:** P2, pending confirmation of the intended business scope.
- **Reproduction:** run `tests/integration/security/postgres-object-isolation.sql`. As `sales_manager`, the fixture returns both organizations, all four fixture memberships, both organizations' quotes, and both quote lines.
- **Impact:** any account granted `sales_manager` can enumerate organization legal/display names, tax IDs and billing emails, member user IDs/roles, and commercial quote details across all tenants. This does not let a B2B buyer cross the tenant boundary and does not grant order, support, stock, or payment access.
- **Mitigation proposal:** decide explicitly whether sales is a global operator. If not, bind CRM access to assigned organizations/accounts; expose only required organization fields; avoid broad membership roster reads where a contact view is sufficient; add cross-tenant denial assertions after the contract is chosen.
- **Status:** observed current behavior; `docs/SECURITY.md` already identified this as an open review item. No migration change was made because access scope needs the Tech Lead's contract decision.

### SEC-02 — Payment policy names sales, but nested order RLS currently denies it

- **Severity:** P3, policy clarity / regression risk; no current unauthorized payment read reproduced.
- **Reproduction:** the supplemental SQL inserts a non-empty payment row. The owner sees it; a different customer and `sales_manager` do not. The effective denial for sales occurs because the policy's `EXISTS` reads `orders`, whose RLS excludes sales.
- **Impact:** the policy declaration is broader than the effective result and the earlier test queried an order with no payment transaction, so it did not establish the boundary. If `orders` access is later widened, sales could gain payment-provider references, status, amount, and currency without changing the payment policy.
- **Mitigation proposal:** if sales must remain denied, remove `sales_manager` from the payment policy predicate and retain the non-empty-row regression. If sales needs payment visibility, define the exact fields and test it directly rather than relying on nested-policy behavior.
- **Status:** current runtime is protected and tested; migration change belongs to the database owner/Tech Lead.

## API, UI, data mode, and secret review

- `POST /api/quotes` is deliberately public intake, rate-limited and schema/consent-validated. Its connected writer uses only the publishable key and limited anon insert columns; it does not select the created row.
- `POST /api/support` requires `auth.getUser()` in connected mode, validates an optional order against the authenticated customer, and writes through the cookie-scoped user client. The route tests cover unauthenticated requests and unowned order references. The local file mode is restricted to explicit local development.
- Connected `POST /api/checkout` requires a user session, writes the cart through that user-scoped client, and calls `place_order`. Orders and stock have no direct authenticated DML grants. The route does not call the service-role payment/fulfillment RPCs; connected orders remain pending payment as documented.
- CRM is a Next Server Action, not a REST mutation route. It checks the sales role server-side before updating; the database RLS remains the final record boundary. Existing action tests use query doubles, so local Auth-token action coverage remains open.
- `getServerDataMode` does not use local fixture/filesystem fallback when Supabase is configured; `.data` requires development plus explicit demo mode. Route tests exercise local-demo and unavailable cases. Production Supabase HTTP behavior was not tested.
- No service-role/secret key usage was found in `app/` or `lib/`; SSR and browser clients use the configured publishable key. The privileged RPCs are not called by an application endpoint today. The local CLI's ephemeral development credentials are not application secrets and are not part of the audit result.
- Auth-only UI is not treated as an authorization boundary: CRM's server action and DB policies check role/rows independently; checkout/support use server-resolved user identity; direct public Data API access remains governed by grants and RLS.

## Verification limits and handoff

- Tested against the local migrated database only; no remote project or production credentials were available.
- The pre-existing shared Docker project was ahead of this worktree: `supabase migration list --local` showed `20261007094816` applied in the database but absent from this checkout. It had a different `quote_items` shape and stricter membership grants. I did not reset or alter that shared database. Running its pgTAP suite exposed a stale expectation at test 18: the old test expects a `sales_manager` DELETE against an owner membership to reach RLS and return zero rows, while the ahead database revokes table DELETE and raises `42501` before RLS. Exact-checkout validation was therefore run in the isolated project above; Tech Lead should reconcile that shared database/worktree drift.
- PostgreSQL role and JWT-claim simulation is runtime RLS evidence, but no GoTrue-issued JWT/PostgREST HTTP matrix was run.
- CRUD coverage is not exhaustive for every role/table/column. Cells marked “catalog only” are not asserted as `Done`.
- Initial `pnpm exec tsc --noEmit` failed on generated global `PageProps` names in two product page modules because this fresh worktree had no `.next` type output. After the production build generated route types, typecheck passed. Those product files are outside ownership and were not changed. `pnpm lint`, `pnpm test` (42 Vitest + 18 Node), and `pnpm build` passed after installing the frozen lockfile. SQL gates and database lint passed.
- The security agent made no product or migration changes. Tech Lead action: decide SEC-01 scope; if SEC-02 policy is meant to deny sales, consider simplifying the migration policy while retaining the payment-row regression.
