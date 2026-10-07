# Workstreams

Tablero de conversaciones. El repositorio y las migraciones son fuente de verdad; un estado `Done` de agente no sustituye integración/gates del tech lead.

## Ola 3 — completada e integrada

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| `client-new-thread:937a74f0-776b-4bdf-8eb2-ff9fc9a2b490` | Checkout Agent | Pago demo conectado, idempotencia y order/inventory integrity | API/UI checkout, commerce contracts, migration y SQL/route tests | Existing order/payment RPC | ✅ Integrado; commit coordinador `01f2b1f`; SQL checkout pgTAP + route unit |
| `client-new-thread:ce1c38a8-f6a8-46b9-9c44-5752d35ec180` | Storefront Agent | Separar fixtures de catálogo/búsqueda conectados | storefront catalog/search routes/pages/components/tests | Data mode | ✅ Integrado; commit `b4fd7cf`; Vitest/E2E catalog |
| `client-new-thread:988de7b3-8ba9-4123-aa7b-447d514c45da` | CRM/B2B Agent | Portal, membership RPC, quote lifecycle y activity | CRM/B2B UI/domain/migration/tests | Existing tenant schema | ✅ Integrado; commit `57aea0e`; CRM pgTAP + action tests |
| `client-new-thread:09d903b8-13f2-4bd6-b01e-90d39e807d26` | Support/RMA Agent | Atomic ticket intake and return request | support UI/API/domain/migration/tests | Existing orders/support schema | ✅ Integrado; commit `e0e992a`; Support SQL + route tests |
| `client-new-thread:a855f9c6-4ee8-41af-aa81-2cbd00b75974` | Security Agent | Independent RLS/object isolation audit | security report and SQL tests | Local Supabase | ✅ Integrado; commit `37a5df7`; probes rerun; findings reconciled |

### Integration follow-up

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| Tech Lead (current) | Integration Lead | Cross-wave integration, fixes, docs, gates | Shared contracts, docs, integration | Completed ola 3 | ✅ Gate passed locally; commit pending at dispatch |
| Tech Lead (current) | Security/RLS | Fix private activity and payment role scope | New migration + RLS regression fixtures | Audit finding SEC-03/SEC-02 | ✅ Added `20261007114945_limit_sales_queue_activity_visibility.sql`; local reset/tests pass |

## Ola 4 — ready for dispatch

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| Checkout connected E2E | QA/Commerce Agent | Browser/Auth end-to-end checkout, approved/declined, retry, concurrency | New `tests/e2e/checkout-connected/**`; test-only fixtures/config; no route redesign without handoff | Supabase local/Auth, current checkout RPC | ⏳ Ready |
| PC Builder | Product Domain Agent | Compatibility rules, saved builds, purchasable variant/cart bridge | Configurator/PC builder UI and `lib/pc-builder/**` plus own tests | Current product variants and cart contract | ⏳ Ready |
| Operations Center | Operations Agent | Replace demo KPIs/order queue with connected order/event data and safe actions | Operations dashboard route/components and `lib/operations/**` | Checkout/order/event contracts | ⏳ Ready |
| Inventory / procurement | Inventory Agent | Complete receive/adjust/ledger workflows and reconcile reserved/on-hand | Inventory surface and `lib/inventory/**`; new migration only if needed | Existing inventory RPCs and reservations | ⏳ Ready |
| Analytics integrity | Analytics Agent | Replace hardcoded KPIs with documented operational queries and tests | Analytics dashboard/module only | CRM/orders/inventory events | ⏳ Ready |
| Functional/accessibility audit | QA/Accessibility Agent | Review live routes for dead controls, responsive, keyboard/focus and report/fix tests | Own audit report and isolated audit tests; no cross-domain styling without issue handoff | Current integrated app | ⏳ Ready |
| Demo/documentation | Documentation Agent | Demo script, architecture/data diagrams, setup and known limits | `docs/DEMO_SCRIPT.md`, targeted docs only | Current contracts and state | ⏳ Ready |

## Definition of Done por conversación

Read `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `STATUS.md`, this board, `AGENT_HANDOFF.md`, `DATA_MODEL.md` and `RBAC_MATRIX.md`; inspect `git status`, commits, relevant code/contracts; keep ownership boundaries; test the slice; update relevant docs; deliver files, commit, tests/results, decisions, bugs/risks, contracts and next steps. Integration lead reconciles changes before a slice is called complete.
