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
| `client-new-thread:4fe81487-2ea9-442d-b6e0-3634eee95c8c` — Checkout conectado E2E | QA/Commerce Agent | Browser/Auth end-to-end checkout, approved/declined, retry, concurrency | `tests/e2e/checkout-connected/**` | Supabase local/Auth, current checkout RPC | ✅ Resuelto en ola 5; runner aislado 4/4 tras validar checkout, retry y concurrencia |
| `client-new-thread:5f74c955-61f6-49d7-a802-e07bf96279b2` — Checkout acepta variante seleccionada | Commerce Contract Agent | Accept and validate explicit variantId in connected checkout | `app/api/checkout/route.ts`, commerce contracts/cart/tests | Existing checkout RPC; PC Builder variant contract | ✅ Integrated `c03e63b`; route/contract tests pass; server keeps price/stock authority |
| `client-new-thread:ffc77f43-5f78-43fe-bb2e-43026833e6b8` — Matriz Auth/RLS runtime | Security/QA Agent | Expand real role/action/RPC coverage and Auth boundary | RBAC/auth-boundary SQL + report | Current policies and local Supabase | ✅ Integrated `f5a1b9d`; runtime matrix and escalation probes pass after RPC-contract correction |
| `client-new-thread:c202586e-bbf1-4458-9651-d9bd2b94153f` — PC Builder vertical slice | Product Domain Agent | Compatibility, saved builds, published variants/cart | Configurator/PC Builder UI, `lib/pc-builder/**`, own tests | Catalog PC variants/structured attributes + checkout `variantId` handoff | ✅ Slice de compra completado en ola 5 (`e49cdb5`); compatibilidad presentada como orientativa y ampliación de cobertura queda en calidad |
| `client-new-thread:e5961205-6651-41a7-99fd-917d5b0dda32` — Operations Center conectado | Operations Agent | Real order/event queue and protected fulfillment actions | Operations dashboard/components, `lib/operations/**`, tests | Checkout/order/event contracts | ✅ Queue/action slice `1307d17`; picking/packing/dispatch cerrado después en ola 6 (`8946f7e`) |
| `client-new-thread:951a64c9-ac93-4719-9dc2-130680f6ebcd` — Inventario y procurement | Inventory Agent | Receive/adjust/ledger and reserved/on-hand reconciliation | Inventory surface, `lib/inventory/**`, migration/tests | Existing inventory RPCs/reservations | ✅ Resuelto en ola 5 (`81c7be7`) y extendido con proveedores/PO en ola 6; suites de inventario/procurement pasan |
| `client-new-thread:9f4a375d-4b1a-4562-9dd4-12959c6bc09a` — Support y RMA workflow | Support Agent | Agent messages/resolution and reviewed return decision | support UI/API/domain, migration/tests | Atomic intake and return request | ✅ Slice `b79cc99`, reembolso/inspección ola 6 y disposición/warehouse autenticado ola 7 verificados |
| `client-new-thread:7dadc2de-e249-4342-8a61-271571907134` — Analytics con datos operativos | Analytics Agent | Replace demo KPIs with defined operational queries | analytics route/module and tests | CRM/order/inventory contracts | ✅ Integrated `ac6714b`; operational metrics are connected; scope remains partial |
| `client-new-thread:01debabe-0686-458b-9f9e-9375ddabe4cf` — Auditoría accesibilidad y responsive | QA/Accessibility Agent | Browser audit of keyboard, responsive, controls and states | UX report + E2E | Integrated storefront/backoffice | ✅ `3a95052`; integration found and fixed CSS Modules, empty checkout and keyboard action regressions |
| `client-new-thread:1ca9a917-ce10-4b14-b838-d4095a18ae93` — Reseñas y moderación | Reviews Agent | Purchase-eligible review, persistence, moderation and RLS | review routes/components, `lib/reviews/**`, migration/tests | Customer/order/product contract | ✅ Integrado y enlazado desde PDP en ola 5 (`04dff19`); moderación y RLS pasan |
| `client-new-thread:94b87bfe-6237-4d90-a00a-4a6ad3dd52d6` — Documentación y guion de demo | Documentation Agent | Setup and honest 10–15 minute fictional-data demo | `docs/DEMO_SCRIPT.md`, `docs/SETUP.md`, README | Current contracts/status | ✅ Integrated `38312b6` |

### Integración de la cuarta ola

Los worktrees limpios produjeron commits para checkout variante, RBAC/Auth boundary, soporte/RMA, reseñas, Operations Center, analytics, UX E2E y documentación. En esa integración no se encontró diff de checkout browser/Auth ni inventario; ambos gaps se resolvieron en la ola 5 (`3e19ed8` y `81c7be7`). El worktree de PC Builder se integró previamente en `f2f806f`, y la compra mediante variantes y seed vendible llegó en ola 5 (`e49cdb5`). La integración añadió además `postcss.config.mjs` y corrigió la regla CSS global que anulaba los CSS Modules; pruebas E2E cubren las regresiones halladas.

## Ola 5 — finalizada e integrada (2026-10-07)

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| `client-new-thread:6d108c32-268b-4335-b373-3d7b7ae77f33` — Checkout conectado E2E | QA/Commerce Agent | GoTrue checkout aprobado/rechazado, retry/refresh/concurrencia | `tests/e2e/checkout-connected/**` | RPC checkout/payment, Supabase local | ✅ Commit worker `2f8d264` → integración `3e19ed8`; suite 4/4; fix del retry `a3904c9`; se corrigió el test discovery del gate demo |
| `client-new-thread:6e8348a3-3ecb-45f0-9c45-f7480cabf131` — Inventory/procurement | Inventory Agent | Recepciones/ajustes, ledger idempotente y conciliación de reservas | inventory UI/API/migration/tests | Order/reservation contracts, RLS roles | ✅ Cambios sin commit rescatados desde `c27b`; integración `81c7be7`; proveedores/PO siguen abiertos |
| `client-new-thread:b2c76fe0-03f7-47fd-915c-5f35089f189e` — PC Builder comprable por variantes | Catalog/PC Agent | Seed vendible, compatibilidad y carrito vía `variantId` | `supabase/seed.sql`, configurador/carrito/tests | Contrato checkout `variantId` | ✅ Commit worker `6011f77` → integración `e49cdb5`; falta ampliar matrices de compatibilidad |
| `client-new-thread:aaaf527a-401d-41ab-b56b-57e1496b87b1` — Conversión de presupuesto B2B | CRM/Commerce Agent | Oferta aceptada → conversión auditable e idempotente | CRM portal/action, migration, tests | organization/quote/order contracts | ✅ Conversión auditada `1d7e375`; pedido formal enlazado se integró en ola 6 (`68c6dfa`) |
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
| `01a116da-b0ae-7a82-bb34-9fe260cd1eff` — Connected QA and analytics integrity | QA/Analytics Agent | E2E de cuenta, B2B, reviews, soporte y métricas operativas | `tests/e2e/connected-domains/**`, fixtures, `docs/ANALYTICS.md` | Contratos de los dominios integrados | ✅ Diff sin commit rescatado; `2f17bd2`; suite original 5/5, extendida a 6/6 en ola 7 |

### Verificación de integración de la sexta ola

Se inspeccionaron los cinco worktrees, su estado Git, commits y cambios. Procurement, B2B, fulfillment y RMA tenían commits; el QA E2E y ajustes de fixtures no estaban completamente comprometidos en su worktree y se revisaron/rescataron. Se actualizó el fixture de aislamiento de pedidos/grants para tomar baseline de seed. En el E2E cruzado B2B se valida visibilidad/autorización sin crear un pedido persistente; el recorrido de emisión real está en el runner B2B aislado. `tests/e2e/connected-domains/run.ps1` terminó 5/5 en la integración original; tras la inspección autenticada de ola 7 queda 6/6 con cleanup correcto.

## QA final y backlog local

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| Tech Lead | Performance/accessibility closeout | Lighthouse local en portada móvil y catálogo desktop; corregir contraste, labels, targets, carga LCP e imágenes responsive | `app/globals.css`, storefront media, `tests/e2e/ux-audit/**`, `docs/PERFORMANCE_AUDIT.md` | Build production local | ✅ 92/100 móvil, 100/100 desktop; accesibilidad 100/100 en ambos; medición de laboratorio y sin CrUX |
| UX final audit (finished) | QA/Accessibility Agent | Barrido anónimo de 27 rutas y walkthrough responsive de roles internos; quedan cliente/B2B Auth, UI de catálogo y shell de soporte | `tests/e2e/ux-audit/**`, `docs/UX_FINAL_AUDIT.md`, navegación de moderación | Supabase local efímero; contratos de roles actuales | ✅ Integrado; E2E 17/17, roles 1/1, typecheck/lint pasan; límites restantes registrados en `STATUS.md` |
| Pendiente | Public SEO/CWV validation | Confirmar indexación, CWV de campo, schema y sitemap tras configurar el dominio público real | `robots.ts`, metadata, sitemap | URL/despliegue remoto y Search Console/CrUX | Bloqueado por entorno |

## Ola 8 — finalizada e integrada 2026-10-08

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| `client-new-thread:53b855ee-f47b-4eb5-9726-b93abd5fe11e` | Support UX Agent | Navegación de staff y accesibilidad de `/soporte/agente` | `app/(store)/soporte/agente/**`, componentes/estilos propios, tests, `docs/UX_STAFF_SHELL.md` | Auth/RBAC existentes | ✅ Integrado desde diff real; E2E roles 1/1, viewports 390/768/1280 |
| `01a11866-ba5c-7c20-8fc3-45ad8493612c` | Catalog Manager Agent | Auditoría de contrato y UI operativa si existe una escritura segura por campo | `docs/CATALOG_MANAGER.md`, estado/decisión/handoff de catálogo | Grants y policies DB existentes | ✅ Auditoría integrada; detectó grants DML de tabla completa y propuso frontera segura. No presentó UI insegura |
| `client-new-thread:606c169a-b83f-401e-a620-05b2a2e71a9f` | Catalog DB Security Agent | Revocar DML amplio y añadir RPC editorial role-checked con pruebas runtime | `supabase/migrations/**`, `tests/integration/rbac/**`, `tests/database/**`, `docs/CATALOG_MANAGER_DB.md` | Auditoría y D-022; contratos de roles actuales | ✅ Integrado en `9b99201`; reset + pgTAP; D-022 implementada |
| `client-new-thread:d217fef5-c305-475d-bb3f-38710e4ba2f7` | Catalog UI Agent | Implementar `/backoffice/catalog` sobre RPC limitada y cliente de sesión | `app/backoffice/catalog/**`, API, `lib/catalog/admin/**`, tests propios, `docs/CATALOG_MANAGER_UI.md` | `public.update_catalog_product_editorial` | ✅ Diff rescatado; E2E edita/restaura producto seed y comprueba denegaciones |
| `client-new-thread:677c01bd-00ed-4f2a-a1e7-390fb544934c` | Customer/B2B UX QA Agent | Recorridos Auth de cliente y memberships buyer/viewer/owner/admin | `tests/e2e/ux-audit/customer-b2b.*`, runner aislado, `docs/UX_CUSTOMER_B2B_AUDIT.md` | Supabase local efímero con puertos/proyecto exclusivos | ✅ Suite dedicada 1/1, aislamiento tenant y tres viewports; sin CRUD |

La integración revisó diffs, migración, contratos y pruebas. `pnpm test:e2e` primero detectó que `customer-b2b.spec.ts` quedaba descubierto por la configuración demo y fallaba sin credenciales Supabase; se añadió a `testIgnore` de `playwright.config.ts`. El runner aislado customer/B2B y las otras suites conectadas se ejecutan de forma dedicada para evitar mezclar entornos y fixtures.

## Ola 7 — cierre RMA por Tech Lead

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| Tech Lead (current) | RMA Warehouse Agent | Inspección/disposición de cada línea con permiso de almacén, ledger, idempotencia, cierre/timeline | `app/backoffice/returns/**`, API, `lib/inventory/returns.ts`, nueva migración, tests | Aprobación RMA y `pending_inspection` | ✅ Implementado y verificado; SQL runtime + route 4/4 + E2E cliente/soporte/warehouse en la suite de dominios 6/6 |
| Tech Lead (current) | B2B Advance Payment | Anticipo demo aprobado/rechazado, aislamiento tenant, idempotencia, auditoría y reserva | Portal B2B, migration, isolated E2E/docs | Pedido B2B formal en `pending_payment` | ✅ Aprobado/rechazado cubiertos en runner aislado; se exige owner/admin, retry no duplica y rechazo libera stock |
| Tech Lead (current) | Demo role bootstrap | Reset local y grants de cuentas Auth ficticias para ensayar roles internos | `scripts/demo/assign-staff-roles.ps1`, `docs/SETUP.md`, `docs/DEMO_SCRIPT.md` | Supabase local, cuentas creadas desde `/acceso` | ✅ Script loopback ejecutado; cinco grants confirmados y eliminados con reset local |
| Tech Lead (current) | Project state reconciliation | Alinear estado global, backlog y handoffs con código y pruebas reales | `docs/STATUS.md`, `docs/WORKSTREAMS.md`, `docs/AGENT_HANDOFF.md`, `docs/RBAC_MATRIX.md` | Séptima ola integrada | ✅ Slices locales cerrados; quality gate final registrado en el estado |

## Definition of Done por conversación

Read `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `STATUS.md`, this board, `AGENT_HANDOFF.md`, `DATA_MODEL.md` and `RBAC_MATRIX.md`; inspect `git status`, commits, relevant code/contracts; keep ownership boundaries; test the slice; update relevant docs; deliver files, commit, tests/results, decisions, bugs/risks, contracts and next steps. Integration lead reconciles changes before a slice is called complete.

## Fase de profundidad — Ola A (finalizada e integrada el 2026-10-08)

La auditoría inicial encontró 12 productos, seis categorías y una marca. Se inspeccionaron los siete worktrees, sus diffs y tests: ninguno produjo commits ni handoff propio. El código útil se rescató y quedó integrado en seis commits coordinadores. `docs/AGENT_HANDOFF.md` registra lo que cada uno entregó, las correcciones de integración y los gates. El catálogo se probó en Supabase local; no se ejecutaron cambios contra Supabase remoto.

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| `client-new-thread:9bfd0d16-da22-41bf-91f5-9b43f5ab1f4d` | Auth Onboarding Agent | Errores de rate limit/credenciales, callback seguro y recuperación explícita | `components/storefront/auth-form.tsx`, `app/auth/callback/**`, tests | Configuración de Supabase URL/SMTP externo | ✅ `4e66d81`; 30 Vitest y 6 E2E browser pasan; el SMTP/allowlist remoto siguen pendientes |
| `client-new-thread:446b5d50-0840-4576-94bd-cb51f43aa051` | Catalog Data Agent | Dataset determinista, marcas/familias, categorías jerárquicas y validación | `supabase/migrations/**`, `scripts/catalog/**`, tests | Esquema actual y no sobrescribir datos | ✅ Integrado con descubrimiento en `c795b86`; 19 tests del dataset, generator check, reset local y 183 pgTAP pasan |
| `client-new-thread:68e68306-5b49-4eb9-9ffa-aafd957887d3` | Catalog Discovery Agent | Facetas y navegación del catálogo | `app/(store)/catalogo/**`, componentes y estilos | Contrato de categorías/productos | ✅ `c795b86`; el Tech Lead añadió el puente `parent_id`/`categoryIds` y 4 pruebas de integración |
| `client-new-thread:63ba1aa9-5f6b-487c-be2c-0a7e554e8ec3` | Product Detail Agent | PDP, galería, variantes, alternativas y enlaces editoriales | `app/(store)/producto/[slug]/**`, `lib/content/product-editorial.ts` | Checkout valida precio/stock | ✅ `b47c505`; typecheck/build y E2E PDP/guía pasan; falta verificar con migración desplegada |
| `client-new-thread:2c5b3543-8ed5-4c5d-a7db-e29c86525913` | Search & Discovery Agent | Ranking, SKU/atributos, sinónimos y recuperación | `lib/search/**`, API y SearchBox | Catálogo activo | ✅ `ddbe8a7`; 46 tests de búsqueda pasan |
| `client-new-thread:c9081771-c0e8-4652-a62a-dc433866b8e4` | Editorial Agent | Contenido y rutas de blog/guías conectadas al catálogo | `app/(store)/blog/**`, `app/(store)/guias/**`, `lib/content/editorial.ts` | Slugs publicados; sitemap de Tech Lead | ✅ Contenido del agente más rutas de integración en `c560dcf`; tres tests unitarios y 2 E2E nuevos pasan |
| `client-new-thread:fd8f245a-8039-4b96-b4bc-746943e80bf9` | Homepage Merchandising Agent | Portada basada en catálogo activo | `app/(store)/page.tsx`, `lib/content/merchandising.ts` | `getCatalogData()` | ✅ `eddd4a0`; 2 fallos iniciales de test corregidos; suite global pasa |

## Cierre de backlog local ejecutado por Tech Lead — 2026-10-08

No se abrieron conversaciones ni ramas: por instrucción del usuario, el Tech Lead ejecutó directamente el siguiente slice en `main`.

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| Tech Lead (main) | Catalog Discovery | Landings derivadas del catálogo para marcas, categorías y selecciones; enlaces y sitemap | `app/(store)/{marcas,categorias,campanas}/**`, `lib/catalog-landings.ts`, `app/sitemap.ts`, footer/portada | `getCatalogData()`, memberships `parentId/categoryIds` | ✅ Implementado en `c5e2025`; pruebas de datos y recorridos E2E locales |
| Tech Lead (main) | PC Builder Quality | Matriz de compatibilidad usando las 32 variantes ficticias del dataset actual | `tests/catalog-data/dataset.test.mjs`, contrato PC Builder | `attributes.pc_builder` | ✅ `c5e2025`; 256 combinaciones base + longitud GPU + margen PSU verificados; límites técnicos siguen documentados |
| Tech Lead (main) | PC Builder UX | Flujo guiado, selección por categoría, progreso esencial, comparación de variantes y resumen editable | `components/storefront/pc-builder.tsx`, `components/storefront/pc-builder.module.css`, estilos PC Builder en `app/globals.css` | Catálogo conectado con variantes publicadas; reglas actuales de compatibilidad | ✅ `e91a165` publicado; build, TypeScript, ESLint y diff-check pasan; `/configurador` responde HTTP 200. La demo local no contiene variantes vendibles para revisar tarjetas reales |

## Pendiente que requiere acceso al entorno

- ✅ Publicación a Vercel Production desde `main` (`4ed17f3`); smoke HTTP de rutas públicas aprobado. El proyecto conserva el nombre `nodria-staging`.
- ⏳ Comprobar con SQL si los 84 productos de `20261008135808_catalog_depth_dataset.sql` están en Supabase; aplicar la migración solo si faltan. Ver `docs/PRODUCTION_RUNBOOK.md`.
- ⏳ Probar Auth alojado después de fijar Site URL/redirect allowlist y SMTP propio, con una cuenta ficticia.
- ⏳ Recorrer las landings con dataset ampliado y medir SEO/CWV de campo cuando se defina un dominio público estable.
- ⏳ Auditoría dedicada de contraste/lector de pantalla del backoffice, separada del E2E de nombres, foco y overflow.
