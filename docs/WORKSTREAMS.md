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
| Tech Lead (current) | Integration Lead | Cross-wave integration, fixes, docs, gates | Shared contracts, docs, integration | Completed ola 4 | ✅ Gates passed; ola 4 commits include `c03e63b`, `f5a1b9d`, `b79cc99`, `53309bf`, `1307d17`, `ac6714b`, `3a95052`, `38312b6`, `eea8856`, `fa8777d`, `96194c7` |
| Tech Lead (current) | Security/RLS | Fix private activity and payment role scope | New migration + RLS regression fixtures | Audit finding SEC-03/SEC-02 | ✅ Added `20261007114945_limit_sales_queue_activity_visibility.sql`; local reset/tests pass |

## Ola 4 — finalizada; integración coordinadora

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| `client-new-thread:4fe81487-2ea9-442d-b6e0-3634eee95c8c` — Checkout conectado E2E | QA/Commerce Agent | Browser/Auth end-to-end checkout, approved/declined, retry, concurrency | `tests/e2e/checkout-connected/**` | Supabase local/Auth, current checkout RPC | ⚠️ No matching E2E diff or commit found in the finished worktrees; P0 requeued |
| `client-new-thread:5f74c955-61f6-49d7-a802-e07bf96279b2` — Checkout acepta variante seleccionada | Commerce Contract Agent | Accept and validate explicit variantId in connected checkout | `app/api/checkout/route.ts`, commerce contracts/cart/tests | Existing checkout RPC; PC Builder variant contract | ✅ Integrated `c03e63b`; route/contract tests pass; server keeps price/stock authority |
| `client-new-thread:ffc77f43-5f78-43fe-bb2e-43026833e6b8` — Matriz Auth/RLS runtime | Security/QA Agent | Expand real role/action/RPC coverage and Auth boundary | RBAC/auth-boundary SQL + report | Current policies and local Supabase | ✅ Integrated `f5a1b9d`; runtime matrix and escalation probes pass after RPC-contract correction |
| `client-new-thread:c202586e-bbf1-4458-9651-d9bd2b94153f` — PC Builder vertical slice | Product Domain Agent | Compatibility, saved builds, published variants/cart | Configurator/PC Builder UI, `lib/pc-builder/**`, own tests | Catalog PC variants/structured attributes + checkout `variantId` handoff | ✅ Partial slice integrated as `f2f806f`; overall feature 🚧 until data/contract exists |
| `client-new-thread:e5961205-6651-41a7-99fd-917d5b0dda32` — Operations Center conectado | Operations Agent | Real order/event queue and protected fulfillment actions | Operations dashboard/components, `lib/operations/**`, tests | Checkout/order/event contracts | ✅ Slice integrated `1307d17`; queue/actions connected; picking/dispatch remains P1 |
| `client-new-thread:951a64c9-ac93-4719-9dc2-130680f6ebcd` — Inventario y procurement | Inventory Agent | Receive/adjust/ledger and reserved/on-hand reconciliation | Inventory surface, `lib/inventory/**`, migration/tests | Existing inventory RPCs/reservations | ⚠️ No matching new worktree diff/commit found; current inventory remains read-only; requeued |
| `client-new-thread:9f4a375d-4b1a-4562-9dd4-12959c6bc09a` — Support y RMA workflow | Support Agent | Agent messages/resolution and reviewed return decision | support UI/API/domain, migration/tests | Atomic intake and return request | ✅ Slice integrated `b79cc99`; RMA effects beyond review remain out of scope |
| `client-new-thread:7dadc2de-e249-4342-8a61-271571907134` — Analytics con datos operativos | Analytics Agent | Replace demo KPIs with defined operational queries | analytics route/module and tests | CRM/order/inventory contracts | ✅ Integrated `ac6714b`; operational metrics are connected; scope remains partial |
| `client-new-thread:01debabe-0686-458b-9f9e-9375ddabe4cf` — Auditoría accesibilidad y responsive | QA/Accessibility Agent | Browser audit of keyboard, responsive, controls and states | UX report + E2E | Integrated storefront/backoffice | ✅ `3a95052`; integration found and fixed CSS Modules, empty checkout and keyboard action regressions |
| `client-new-thread:1ca9a917-ce10-4b14-b838-d4095a18ae93` — Reseñas y moderación | Reviews Agent | Purchase-eligible review, persistence, moderation and RLS | review routes/components, `lib/reviews/**`, migration/tests | Customer/order/product contract | ✅ Integrated `53309bf`; PDP link/integration still open |
| `client-new-thread:94b87bfe-6237-4d90-a00a-4a6ad3dd52d6` — Documentación y guion de demo | Documentation Agent | Setup and honest 10–15 minute fictional-data demo | `docs/DEMO_SCRIPT.md`, `docs/SETUP.md`, README | Current contracts/status | ✅ Integrated `38312b6` |

### Integración de la cuarta ola

Los worktrees limpios produjeron commits para checkout variante, RBAC/Auth boundary, soporte/RMA, reseñas, Operations Center, analytics, UX E2E y documentación. No se encontró diff integrable de checkout browser/Auth ni de inventario/procurement. El worktree de PC Builder se integró previamente en `f2f806f`. La integración añadió además `postcss.config.mjs` y corrigió la regla CSS global que anulaba los CSS Modules; pruebas E2E cubren las regresiones halladas. Gates registrados en `STATUS.md` y handoff en `AGENT_HANDOFF.md`.

## Ola 5 — finalizada e integrada (2026-10-07)

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| `client-new-thread:6d108c32-268b-4335-b373-3d7b7ae77f33` — Checkout conectado E2E | QA/Commerce Agent | GoTrue checkout aprobado/rechazado, retry/refresh/concurrencia | `tests/e2e/checkout-connected/**` | RPC checkout/payment, Supabase local | ✅ Commit worker `2f8d264` → integración `3e19ed8`; suite 4/4; fix del retry `a3904c9`; se corrigió el test discovery del gate demo |
| `client-new-thread:6e8348a3-3ecb-45f0-9c45-f7480cabf131` — Inventory/procurement | Inventory Agent | Recepciones/ajustes, ledger idempotente y conciliación de reservas | inventory UI/API/migration/tests | Order/reservation contracts, RLS roles | ✅ Cambios sin commit rescatados desde `c27b`; integración `81c7be7`; proveedores/PO siguen abiertos |
| `client-new-thread:b2c76fe0-03f7-47fd-915c-5f35089f189e` — PC Builder comprable por variantes | Catalog/PC Agent | Seed vendible, compatibilidad y carrito vía `variantId` | `supabase/seed.sql`, configurador/carrito/tests | Contrato checkout `variantId` | ✅ Commit worker `6011f77` → integración `e49cdb5`; falta ampliar matrices de compatibilidad |
| `client-new-thread:aaaf527a-401d-41ab-b56b-57e1496b87b1` — Conversión de presupuesto B2B | CRM/Commerce Agent | Oferta aceptada → conversión auditable e idempotente | CRM portal/action, migration, tests | organization/quote/order contracts | ✅ Commit worker `473bff1` → integración `1d7e375`; explícitamente no crea pedido formal |
| `client-new-thread:3d06f4bc-5697-45b4-9bfd-1cb1a674b096` — Reviews PDP | Storefront Reviews Agent | Link opiniones y estado conectado desde PDP | PDP/opiniones tests | Reviews API/migration | ✅ Commit worker `bb20ce8` → integración `04dff19`; unit/E2E incluidos en gates |
| `client-new-thread:03e546f1-aeb2-4364-9d87-6a383cc4281c` — Auth/PostgREST boundary | Auth/RLS QA Agent | Tokens GoTrue, isolation/role grants, demo/data boundary | `tests/integration/auth-boundaries/**`, `docs/AUTH_BOUNDARIES.md` | Local Supabase/role matrix | ✅ Runner/docs sin commit rescatados desde `29a6`; integración `26ee62b`; 78 probes HTTP, 0 fallos |

### Integración de la quinta ola

Se incorporaron los commits worker `473bff1`, `6011f77`, `bb20ce8` y `2f8d264`, además de cambios sin commit de los worktrees `c27b` (inventario) y `29a6` (Auth/PostgREST). Commits del Tech Lead: `a3904c9` (checkout retry), `81c7be7` (movimientos de inventario) y `26ee62b` (fixtures RLS/Auth). La integración añadió `find_checkout_order` para validar fingerprint antes de mutar o crear otro carrito en un retry. Los gates e incidencias reproducibles figuran en `docs/STATUS.md` y `docs/AGENT_HANDOFF.md`.

## Ola 6 — finalizada e integrada (2026-10-07)

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| `01a116da-74e8-7d90-986e-56db80cdb512` — B2B formal order slice | B2B Commerce Agent | Emitir pedido formal desde presupuesto aceptado con snapshots y límites de tenant | Portal/contrato B2B, migración y pruebas | Conversión aceptada, reserva e inventario | ✅ Integrado; `68c6dfa`; runner aislado 1/1 |
| `01a116da-74e8-7d90-986e-56fc143a985f` — Procurement suppliers and purchase orders | Procurement Agent | Proveedores, órdenes de compra y recepción vinculada a PO | `lib/inventory/procurement/**`, migration y SQL/route tests | Ledger de inventario | ✅ Integrado; `4e7d1e6`; SQL de runtime pasa |
| `01a116da-93a2-7fe0-9cd5-e430efc6a1e8` — Order fulfillment workflow | Fulfillment Agent | Picking/packing/expedición, consumo de reserva y timeline | Operaciones, RPC, migration y pruebas | Pago aprobado y reserva | ✅ Diff sin commit rescatado; `8946f7e`; SQL de fulfillment pasa |
| `01a116da-74e8-7d90-986e-56e5365d584b` — RMA approval effects | Returns/RMA Agent | Reembolso demo idempotente y estado de inspección pendiente | Support/RMA RPC, migration, UI y SQL | Devolución revisada y pago aprobado | ✅ Integrado; `2f4599c`; inspección/disposición sigue abierta |
| `01a116da-b0ae-7a82-bb34-9fe260cd1eff` — Connected QA and analytics integrity | QA/Analytics Agent | E2E de cuenta, B2B, reviews, soporte y métricas operativas | `tests/e2e/connected-domains/**`, fixtures, `docs/ANALYTICS.md` | Contratos de los dominios integrados | ✅ Diff sin commit rescatado; `2f17bd2`; suite conectada 5/5 |

### Verificación de integración de la sexta ola

Se inspeccionaron los cinco worktrees, su estado Git, commits y cambios. Procurement, B2B, fulfillment y RMA tenían commits; el QA E2E y ajustes de fixtures no estaban completamente comprometidos en su worktree y se revisaron/rescataron. Se actualizó el fixture de aislamiento de pedidos/grants para tomar baseline de seed. En el E2E cruzado B2B se valida visibilidad/autorización sin crear un pedido persistente; el recorrido de emisión real está en el runner B2B aislado. `tests/e2e/connected-domains/run.ps1` termina 5/5 con cleanup correcto.

## Siguiente ronda — lista para despacho

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| Pendiente de crear | Demo Mode Agent | Demo repetible por rol con reset determinista y límites de autorización | Demo auth/fixtures/UI/docs/tests | Auth boundary y fixtures actuales | Ready |
| Pendiente de crear | Security Matrix Agent | Ampliar matriz route/RPC/tabla y revisar permiso de cada rol | `tests/integration/auth-boundaries/**`, `RBAC_MATRIX.md`, `SECURITY.md` | Roles actuales y contratos de endpoint | Ready |
| Pendiente de crear | Analytics Integrity Agent | Reconciliar KPIs, filtros y rangos con SQL de referencia | `lib/analytics/**`, `docs/ANALYTICS.md`, tests | Datos de pedidos, inventario, soporte/CRM | Ready |
| Pendiente de crear | UX/Performance Audit Agent | Auditoría responsive/accesible, Lighthouse y rutas con fake completeness | Reportes, E2E/a11y/perf sin cambios de dominio | Build integrado | Ready |

## Ola 7 — cierre RMA por Tech Lead

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| Tech Lead (current) | RMA Warehouse Agent | Inspección/disposición de cada línea con permiso de almacén, ledger, idempotencia, cierre/timeline | `app/backoffice/returns/**`, API, `lib/inventory/returns.ts`, nueva migración, tests | Aprobación RMA y `pending_inspection` | ✅ Implementado en worktree coordinador; reset local + SQL runtime + route 4/4; recorrido browser warehouse pendiente |
| Tech Lead (current) | B2B Advance Payment | Anticipo demo aprobado/rechazado, aislamiento tenant, idempotencia, auditoría y reserva | Portal B2B, migration, isolated E2E/docs | Pedido B2B formal en `pending_payment` | ✅ Aprobado/rechazado cubiertos en runner aislado; se exige owner/admin, retry no duplica y rechazo libera stock |

## Definition of Done por conversación

Read `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `STATUS.md`, this board, `AGENT_HANDOFF.md`, `DATA_MODEL.md` and `RBAC_MATRIX.md`; inspect `git status`, commits, relevant code/contracts; keep ownership boundaries; test the slice; update relevant docs; deliver files, commit, tests/results, decisions, bugs/risks, contracts and next steps. Integration lead reconciles changes before a slice is called complete.
