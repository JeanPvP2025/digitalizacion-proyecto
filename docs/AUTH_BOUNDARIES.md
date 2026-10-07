# Auth boundaries — GoTrue/PostgREST local

## Purpose and limits

`tests/integration/auth-boundaries/run-local.ps1` exercises the local Supabase Auth and Data API boundary with access JWTs actually issued by GoTrue. The runner signs in each fictional fixture through the password grant, then sends the resulting JWT to PostgREST. It complements the SQL role/RLS scripts; it does not replace them or claim exhaustive CRUD coverage.

The runner is Windows PowerShell 7 oriented because the configured local stack is named `nodria-commerce`. It requires Docker, `pnpm dlx supabase@latest`, and the project's local Supabase containers. It reads local API keys into process memory and never prints them. The service-role key is used only to provision/delete temporary Auth users, then all role and row probes use publishable-key + GoTrue access-token requests. It does not contact a remote project.

Install locked dependencies once, then run from the repository root:

```powershell
pnpm install --frozen-lockfile
pwsh -File tests/integration/auth-boundaries/run-local.ps1
```

Exit code is nonzero on any failed request boundary or cleanup. Each line reports the HTTP status and the boundary being asserted. Temporary users, role grants, and two organizations are removed in `finally`; organization rows are deleted before Auth users because their creator references are restrictive. Re-run after an interrupted process only after checking that no `auth-boundary-*` users or `auth-boundary-*` organizations remain in the local database.

## Coverage

The fixture matrix includes anonymous requests, customer A/B, business organization admin/buyer, `catalog_manager`, `support_agent`, `sales_manager`, `fulfillment_manager`, and `super_admin`. It verifies:

- GoTrue health, password-grant JWT issuance, token-to-user binding, and PostgREST health.
- Public catalog access vs private profile denial for anon.
- Customer self profile vs customer-to-customer profile IDOR; user-editable `user_metadata` with forged role labels does not produce a persisted staff grant.
- Business admin and buyer can read their own organization but not the other fixture tenant.
- Each staff role sees only its persisted role grant; customers cannot insert their own `super_admin` grant.
- Column-level identity boundary on profile email and the organization-member RPC's tenant scope, including one allowed same-tenant viewer invite.
- Authenticated JWTs for all fixture roles cannot execute payment outcome, fulfillment, delivery, or inventory service-only RPCs.
- Source/browser asset scan for publicly prefixed secret identifiers and the current local service-role key value in `app`, `components`, `public`, `.next/static`, and `.next/dev/static` when present. Server-only environment variable names can legitimately occur in server source maps; their values and publicly prefixed variants are what the scan rejects.

## Evidence — 2026-10-07

After the fifth-wave integration and local migration reset, the runner completed **78 probes with 0 failures**. HTTP evidence included:

- GoTrue and PostgREST health: `200`; nine Auth users received password-grant tokens, and `/auth/v1/user` returned the matching Auth user for each.
- Public catalog `200`; anonymous profile request `401`.
- Own profile/role and own-tenant lookups `200`; customer-to-customer and business cross-tenant IDOR lookups returned `200 []`.
- Forged user metadata did not create a staff grant; customer grant escalation and profile-email mutation returned `403`.
- Customer A and its assigned support agent read the same support ticket; customer B received `200 []` for that ticket ID.
- Customer A read its own temporary order; customer B received `200 []` for that order. A fulfillment-manager JWT read the same order through the operations queue.
- Cross-tenant organization-member RPC returned `403`; same-tenant admin invite of a limited `viewer` returned `200`.
- Fulfillment JWT read inventory and the operations order queue; customer, catalog, support, and sales JWTs saw no inventory rows. Sales JWTs saw no customer orders or payment rows.
- Payment outcome, fulfillment, delivery, and inventory RPC attempts returned `403` for customer, B2B admin/buyer, and every staff role including superadmin.
- `POST /api/quotes` with `DEMO_MODE=true` plus complete local Supabase credentials returned `201` with `persistence: "supabase"`; SQL confirmed exactly one PostgreSQL row. With an unreachable Supabase URL and `DEMO_MODE=true`, the same route returned `500`, no `local-demo` persistence marker, and no quote row.
- Source and generated Next browser assets contained no publicly prefixed secret identifiers and no local service-role key value.
- Cleanup check after the run: zero matching fixture Auth users, organizations, and orders.

Relevant regression results:

| Check | Result |
|---|---|
| `tests/unit/auth-mode.test.ts` | ✅ 6 passed |
| `tests/integration/auth-boundaries/postgres-role-escalation.sql` | ✅ passed |
| `tests/integration/rbac/postgres-role-action-matrix.sql` | ✅ passed |
| `tests/integration/postgres-rls.sql` | ✅ compares access to the seed baseline captured in the transaction |
| `tests/integration/security/postgres-object-isolation.sql` | ✅ compares queue access to baseline seed orders plus its two fixtures |

The earlier failures were stale fixture-count assumptions, not policy failures. Both SQL scripts now assert against transaction-local baselines; no policy or grant was broadened. The dynamic-count assertions and all other role/RLS scripts were rerun successfully.

During an earlier run another local `supabase db reset --local --yes` process was active; the database temporarily restarted and requests returned `503`. The runner was hardened to wait for the project schema and treats only `401/403` as a successful authorization denial, so infrastructure `5xx` cannot pass as a security boundary.

## Interpretation

HTTP 200 with an empty row array is an expected RLS denial for IDOR probes; SQL privilege denial may be an HTTP 4xx. Any 2xx result from a service-only RPC is a failure. If the runner cannot reach GoTrue/PostgREST, it exits nonzero with an explicit infrastructure error and should not be replaced by `SET ROLE` SQL as evidence of a signed-JWT HTTP boundary.

The client scan is a source/build artifact check. The separate connected checkout browser suite now exercises real GoTrue cookies, approved/declined outcomes, retry/refresh, idempotency, and two-session stock concurrency. Remote project credentials and deployment are still untested.
