# Registro de handoffs

## Ola 2 recibida e integrada — 2026-10-07

Las seis conversaciones indicadas por el usuario se consideran finalizadas. Se inspeccionaron sus worktrees bajo `C:\Users\lopez\.codex\worktrees\{17c4,bfa1,2696,0cc1,fcd7,a2ad}\digitalizacion-web`: todos estaban en `68bb12a`, sin commits adicionales; se conservaron sus cambios útiles y reportes. Los IDs `client-new-thread:*` no fueron resolubles con el endpoint de lectura como hilos ordinarios, por lo que los entregables se contrastaron directamente con Git/worktree y los informes presentes. No se esperaron respuestas.

| Conversación | Handoff / archivos | Commit en worker | Checks declarados/observados | Límites abiertos |
|---|---|---|---|---|
| Database / `52026060…` | `20261007085225_database_security_invariants.sql`, `tests/database/security_invariants.sql`, `docs/database.md` | Ninguno | Reset/seed, DB lint y 60 pgTAP confirmados por integración | `place_order` no valida fingerprint si una clave se reutiliza con otro payload; dirección solo valida objeto; UI no consume RPCs de outcomes/fulfillment |
| Auth / `ed61b81c…` | `lib/server/data-mode.ts`, `lib/supabase/policies.ts`, guards y callback/signout, `.env.example`, tests Auth | Ninguno | 16 Vitest + 18 Node en worktree; integración actual 42 Vitest + 18 Node, typecheck/build | Fallback fixture en algunas lecturas catálogo/búsqueda requiere revisión; operación conectada no usa service-role client ni las RPCs restringidas |
| QA / `680a5362…` | `tests/integration/**`, `tests/e2e/catalog.spec.ts`, test config | Ninguno | 7 E2E actuales; 42 Vitest + 18 Node; custom PostgreSQL gate | La matriz cubre roles/acciones sensibles seleccionadas, no CRUD exhaustivo en cada tabla |
| Accessibility / `4b07067f…` | CSS global, storefront header/interactions/collections, business quote form | Ninguno | Lint/build/E2E integrados | Revisión manual completa de dialogs, teclado y contraste aún pendiente |
| Storefront UX / `a974956c…` | home, configurador, PC builder, ProductCard, `docs/UX_REVIEW.md` | Ninguno | typecheck, lint focal, tests, build y revisión desktop/mobile declarados; E2E actual pasa | carrito y checkout siguen siendo demo local/fundamentalmente client-side; catálogo conectado continúa con límites documentados |
| Backoffice review / `db786e62…` | `docs/BACKOFFICE_REVIEW.md` | Ninguno | Static review; después se añadieron pruebas SQL runtime | Ventas no puede leer pedido/líneas/eventos/pagos; error de archivo demo corrupto queda como deuda P3; identidad de variantes ocultas para fulfillment puede verse como UUID |

## Resultado de integración y gates

- Se corrigió la política de lectura de `orders`, `order_items` y `order_events` para retirar `sales_manager`; prueba SQL verifica también `payment_transactions`.
- Se añadieron casos runtime de separación empresarial buyer/admin, creación acotada de miembros, rechazo de cross-tenant y de escalada a `owner`, y lectura de superadmin.
- `supabase db reset`, `db lint`, 60 pgTAP y `tests/integration/postgres-rls.sql` pasan en PostgreSQL local. El script revierte las fixtures al final.
- `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (42+18), `pnpm test:e2e` (7) y `pnpm build` pasan.
- Se cambió `<img>` a `next/image` en comparación/carrito y se quitaron disables no usados. `git diff --check` solo reporta avisos de conversión LF/CRLF de Windows.
- No hay credenciales remotas ni cambios sobre Supabase remoto. La búsqueda del repositorio no encontró claves/service-role o secretos `NEXT_PUBLIC`.

Commits de integración (en orden): `411a752` database/RLS; `9398f75` Auth/data-mode; `ead041c` quality tooling; `35783b1` storefront; `3d0ae4e` commerce/backoffice; `2e1d764` integration/E2E tests; `669d180` status/review docs; `c6cb1a9` dispatch de ola 3.

## Dependencias desbloqueadas

- DB define `resolve_demo_payment`, `fulfill_order`, `mark_order_delivered` y `adjust_inventory`; ahora puede implementarse su consumidor de servidor con ownership separado.
- El contrato de RLS/grants para datos operativos está probado localmente; continúan revisiones por endpoint y matriz completa.
- La ola 3 puede comenzar desde este estado para checkout, boundaries storefront, CRM/B2B, Support/RMA y auditoría de seguridad.

## Ola 3 despachada

Los siguientes cinco chats independientes se crearon sobre worktrees nuevos desde el estado integrado y committed. Se asignó ownership no solapado; las migraciones nuevas son específicas de dominio y no deben editar las existentes.

| Chat | ID de creación | Dominio / ownership | Dependencias / estado |
|---|---|---|---|
| NODRIA — Checkout conectado e integridad de pedidos | `client-new-thread:937a74f0-776b-4bdf-8eb2-ff9fc9a2b490` | Checkout, `lib/commerce/**`, API/UI y migración dedicada | RPC SQL existente; queued |
| NODRIA — Límites de datos del storefront | `client-new-thread:ce1c38a8-f6a8-46b9-9c44-5752d35ec180` | Catálogo/búsqueda, fixture boundaries y sus pruebas | Data-mode resuelto; queued |
| NODRIA — Completar CRM y B2B | `client-new-thread:988de7b3-8ba9-4123-aa7b-447d514c45da` | CRM/B2B, quote workflow y migraciones específicas | Schema/RLS actual; queued |
| NODRIA — Soporte y devoluciones RMA | `client-new-thread:09d903b8-13f2-4bd6-b01e-90d39e807d26` | Ticket/mensaje atómico, soporte/RMA y migración específica | Tablas/RPC existentes; queued |
| NODRIA — Auditoría independiente de seguridad | `client-new-thread:a855f9c6-4ee8-41af-aa81-2cbd00b75974` | Revisión independiente y tests propios; sin cambios de producto | DB local/migraciones; queued |

## Regla de entrega para la siguiente ola

Cada conversación debe reportar trabajo, archivos, commit/worktree, decisiones y contratos, comandos/resultados, bugs/riesgos, dependencias desbloqueadas y siguientes pasos. El tech lead valida cada cambio contra Git y ejecuta los gates relevantes antes de actualizar este documento y el tablero.

## Ola 3 recibida, contrastada e integrada — 2026-10-07

Los cinco worktrees estaban limpios y cada uno tenía un commit sobre el padre `00fb56e`. Los IDs `client-new-thread` no pudieron abrirse por la herramienta de lectura como thread IDs ordinarios, por lo que el handoff se contrastó con los commits/diffs/worktrees reales. Las notas `docs/WORKSTREAMS.md` duplicadas por los workers se reconciliaron en el documento del coordinador.

| Conversación / dominio | Commit del worker → commit integrado | Trabajo verificado y archivos principales | Tests/gates relevantes observados en integración | Deuda o riesgo restante |
|---|---|---|---|---|
| Checkout `937a74f0…` | `d3ce6e0` → `01f2b1f` | `app/api/checkout/route.ts`, `components/storefront/checkout-form.tsx`, `lib/commerce/payment-admin.ts`, contracts, migration `20261007095121_checkout_order_payment_integrity.sql`, checkout pgTAP y Route Handler tests. Auth de servidor, pedido fingerprint, retry, service-only payment outcome, reserva/liberación. | 156 pgTAP incluyen 40 checkout assertions; route/admin unit tests; RLS SQL; build/typecheck. | No E2E browser con Auth/PostgREST; concurrency real con dos sesiones no probada.
| Storefront `ce1c38a8…` | `dedb2f6` → `b4fd7cf` | Boundary entre fixtures y datos conectados para catálogo, PDP, search, compare/favorites; `connected-product-card.tsx`, repository/mapping y `catalog-search-boundaries.test.ts`. | 71 Vitest y 8 E2E demo pasan; rutas conectadas consultan Supabase/fallan cerradas sin fixture fallback según route tests. | Playwright no prueba Supabase conectado ni modo producción remoto.
| CRM/B2B `988de7b3…` | `439414a` → `57aea0e` | Portal empresa, miembros mediante RPC, quote request con snapshots, CRM queue/claim/send/respond, actividades; migration `20261007094816_crm_b2b_quote_workflow.sql`, CRM pgTAP/action tests. | CRM pgTAP dentro de 156 assertions; route/action tests y runtime RLS/security probes. | Aceptada la cola de presupuestos `requested` global a sales para claim; no convierte oferta aceptada automáticamente en pedido B2B.
| Support/RMA `09d903b8…` | `f6510d4` → `e0e992a` | Ticket+primer mensaje atómicos, formulario/API de devolución y regla acumulada de unidades; migration `20261007094750_support_returns_atomic_intake.sql`, SQL runtime y route tests. | Support/RMA PostgreSQL transaction gate y route tests pasan. | Bandeja/diálogo agente, conversación y resolución final siguen parciales.
| Security `a855f9c6…` | `b2101c8` → `37a5df7` | `docs/SECURITY_FOLLOWUP.md`, `tests/integration/security/postgres-object-isolation.sql`; audita roles, pagos, quotes, orgs, support y RMA. | Probe security runtime se reejecutó tras actualizar fixtures; encuentra/satisface boundaries actuales. | Sin proyecto remoto/GoTrue JWT; matriz CRUD por tabla/columna no exhaustiva.

### Cambios de integración adicionales

- Se actualizaron fixtures de `tests/integration/postgres-rls.sql`, `tests/integration/security/postgres-object-isolation.sql` y `tests/integration/support-rma/postgres.sql` a las restricciones vigentes: checkout address completo, fingerprint requerido, quote item snapshots y membership RPC en vez de DML directo.
- La revalidación reprodujo acceso a notas `organization` de quote no asignado en la cola de ventas. La migración `20261007114945_limit_sales_queue_activity_visibility.sql` mantiene el acceso de ventas a la cola formal necesaria, pero solo a actividades `internal` antes del claim. La misma migración saca `sales_manager` del SELECT de pago.
- No se integró la restricción tentativa a quote por `organization_id is null`: CRM pgTAP demostró que rompería el flujo de claim de presupuestos B2B de organizaciones. La excepción está documentada en `DECISIONS.md`, `RBAC_MATRIX.md` y `SECURITY_FOLLOWUP.md`.

### Gates finales observados

- `pnpm install --frozen-lockfile`: pass.
- `pnpm exec tsc --noEmit`: pass tras build.
- `pnpm lint`: pass, sin diagnósticos.
- `pnpm test`: 71 Vitest + 18 Node, pass.
- `pnpm test:e2e`: 8 Playwright de demo, pass.
- `pnpm build`: pass.
- `supabase db reset --local --yes`: pass, migrations/seed de seis versiones.
- `supabase test db --local tests/database tests/integration/commerce/checkout-flow.sql`: 156 pgTAP, pass.
- `tests/integration/postgres-rls.sql`, `tests/integration/security/postgres-object-isolation.sql`, `tests/integration/support-rma/postgres.sql`: pass, fixtures revertidas.
- `supabase db lint --local --fail-on error`: pass; sin warnings.
- `git diff --check`: exit 0; Git muestra avisos habituales de LF→CRLF en SQL bajo Windows.

La siguiente ronda no debe empezar auditoría final definitiva. Prioriza los slices P0/P1 reflejados en `STATUS.md`; la cuarta ola está preparada en `WORKSTREAMS.md`.

## Integración Reviews PDP — 2026-10-07

- Partida de `master` en `96194c7`, worktree limpio y sin cambios previos.
- La PDP enlaza `/producto/[slug]/opiniones`; solo consulta el total exacto de reseñas publicadas en Supabase y ya no muestra ratings del catálogo conectado como reseñas verificadas. El testimonio y contador ficticios de demo se retiraron.
- La ruta de opiniones tiene estado de carga (`loading.tsx`), conserva estados de lista publicada/vacía/error y mantiene acceso al formulario sujeto a sesión y línea entregada. La API/RLS y moderación previa no cambiaron; modo demo comunica que no persiste.
- Archivos: `app/(store)/producto/[slug]/page.tsx`, `app/(store)/producto/[slug]/opiniones/loading.tsx`, estilos de opiniones, `components/storefront/product-card.tsx` (prop opcional para omitir rating solo en relacionados de PDP), pruebas `tests/integration/reviews/ui.test.ts` y recorrido `tests/e2e/catalog.spec.ts`; estado reconciliado en `STATUS.md` y `WORKSTREAMS.md`.
- Verificaciones: `pnpm test` (155 Vitest + 18 Node), `pnpm exec vitest run tests/integration/reviews` (23/23), `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` y los dos E2E del recorrido (PDP→opiniones por click y opiniones móvil/teclado) pasan. Playwright espera `networkidle` antes del click para dar tiempo a la hidratación del App Router.
- Contratos/decisiones: sin cambio de API, schema, RLS ni elegibilidad; agregado solo usa `product_reviews.status = published` a través del repositorio existente. No se calcula promedio en PDP porque la consulta está limitada a 50 reseñas.
- Riesgo/dependencia: el recorrido con usuario Auth real en navegador y Supabase conectado sigue sin verificación; la demo es explícitamente de solo lectura. No hay bug de migración/API demostrado.

## Ola 4 despachada — 2026-10-07

Se crearon conversaciones independientes sobre worktrees desde el snapshot integrado y committed. Cada prompt incluye bootstrap obligatorio de `/docs/PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `STATUS.md`, `WORKSTREAMS.md`, `AGENT_HANDOFF.md`, `DATA_MODEL.md` y `RBAC_MATRIX.md`, además de inspección de Git/dominio/contratos.

| Conversación | ID | Ownership primario | Estado al despacho |
|---|---|---|---|
| NODRIA — Checkout conectado E2E | `client-new-thread:4fe81487-2ea9-442d-b6e0-3634eee95c8c` | `tests/e2e/checkout-connected/**`, fixtures/config aislados | Creada; worktree setup pendiente |
| NODRIA — Checkout acepta variante seleccionada | `client-new-thread:5f74c955-61f6-49d7-a802-e07bf96279b2` | `app/api/checkout/route.ts`, commerce contracts/cart y route/domain tests | Creada; worktree setup pendiente |
| NODRIA — Matriz Auth/RLS runtime | `client-new-thread:ffc77f43-5f78-43fe-bb2e-43026833e6b8` | `tests/integration/rbac/**`, auth-boundaries y audit report | Creada; worktree setup pendiente |
| NODRIA — PC Builder vertical slice | `client-new-thread:c202586e-bbf1-4458-9651-d9bd2b94153f` | Configurador, `lib/pc-builder/**`, tests | Creada; worktree setup pendiente |
| NODRIA — Operations Center conectado | `client-new-thread:e5961205-6651-41a7-99fd-917d5b0dda32` | Operations dashboard y `lib/operations/**` | Creada; worktree setup pendiente |
| NODRIA — Inventario y procurement | `client-new-thread:951a64c9-ac93-4719-9dc2-130680f6ebcd` | Inventory UI, `lib/inventory/**`, migración/tests si se necesitan | Creada; worktree setup pendiente |
| NODRIA — Support y RMA workflow | `client-new-thread:9f4a375d-4b1a-4562-9dd4-12959c6bc09a` | Support UI/API/domain y migración/tests dedicados | Creada; worktree setup pendiente |
| NODRIA — Analytics con datos operativos | `client-new-thread:7dadc2de-e249-4342-8a61-271571907134` | Analytics route/module/queries/tests | Creada; worktree setup pendiente |
| NODRIA — Auditoría accesibilidad y responsive | `client-new-thread:01debabe-0686-458b-9f9e-9375ddabe4cf` | `docs/UX_A11Y_AUDIT.md`, tests audit aislados | Creada; worktree setup pendiente |
| NODRIA — Reseñas y moderación | `client-new-thread:1ca9a917-ce10-4b14-b838-d4095a18ae93` | Reviews route/domain/migration/tests | Creada; worktree setup pendiente |
| NODRIA — Documentación y guion de demo | `client-new-thread:94b87bfe-6237-4d90-a00a-4a6ad3dd52d6` | `docs/DEMO_SCRIPT.md`, `docs/SETUP.md`, README | Creada; worktree setup pendiente |

Los IDs `client-new-thread` identifican el despacho asíncrono. La conversación coordinadora no atribuirá archivos/commits antes de confirmar setup y luego recogerá estado/worktrees al cerrar esta ola.

### Contrato cruzado PC Builder → checkout

La inspección del agente PC Builder confirmó que el seed actual no tiene categorías PC con piezas/variantes vendibles y atributos estructurados. El producto conectado no debe aceptar una compra sustituyendo `builder:*` por un `productId` genérico. Se decidió que la unidad de compra será `variantId`; una conversación separada valida/acepta ese ID en checkout, y el RPC server/database seguirá mandando sobre precio/stock. El agente PC Builder continúa compatibilidad/guardados, mantiene el botón de compra bloqueado y reporta atributos mínimos requeridos. No se declara conectado el bridge hasta integrar ambos lados y tener catálogo vendible.

### Handoff PC Builder recibido e integrado — 2026-10-07

- Conversación activa observada por `read_thread`: `01a1163b-c932-7541-8979-3ac75ff244fd`, worktree `C:\Users\lopez\.codex\worktrees\740c\digitalizacion-web`, commit worker `d557d12 feat(pc-builder): load sellable variants and persist builds`, worktree limpio.
- Commit integrado en master: `f2f806f feat(pc-builder): use sellable catalog variants and saved builds`; no se copiaron cambios compartidos de `AGENT_HANDOFF.md`/`WORKSTREAMS.md` desde el worktree.
- El servidor lee únicamente productos publicados, categorías activas Componentes/Almacenamiento y variantes EUR activas con `attributes.pc_builder` tipado/completo. Error Supabase produce estado de error, no fixtures. Compatibilidad consume el catálogo explícito y valida las reglas cubiertas (socket, generación/capacidad RAM, form factor, espacio GPU, socket cooler y estimación/margen PSU).
- Configuraciones guardadas (hasta 10) persisten en localStorage v2 usando variant IDs exactos; las selecciones fuera del catálogo al restaurar no se remapean. UI informa omisiones/errores/vacío y bloquea compra.
- El seed no contiene componentes PC con `attributes.pc_builder`; el slice es honesto pero no seleccionable en local demo ni comprable hasta tener datos. Checkout sigue separado y tiene una conversación dedicada para el input `variantId`; el cliente no envía precios.
- Verificación repetida en el checkout coordinador: `pnpm test` 86 Vitest + 18 Node, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` y `pnpm test:e2e` 8/8 pasan. La feature se mantiene 🚧 hasta catálogo de componentes y handoff del checkout.

## Integración ola 4 — 2026-10-07

### Inspección y commits rescatados

Los worktrees limpios con commits verificables se revisaron contra el HEAD y diffs. Se integraron estos cambios:

- `c03e63b feat(checkout): accept explicit sellable variant IDs` (worker `087353b`): route/cart/contracts y pruebas de variante. Contrato integrado en `D-012`.
- `f5a1b9d test(security): expand RBAC role action coverage` (worker `9b80b8b`): matriz role/action y claim escalation.
- `b79cc99 feat(support): complete ticket and RMA workflows` (worker `fdf5908`): bandeja de agente, mensajes, timeline y decisión de devolución.
- `53309bf feat(reviews): add verified product review workflow` (worker `55586ed`): reseña elegible por pedido/línea, moderación, API/UI y RLS.
- `1307d17 feat(operations): connect fulfillment center to order data` (worker `66e86fc`): queue de pedidos y acciones operativas protegidas.
- `ac6714b feat(analytics): add connected operational metrics` (worker `2d01e2a`): métricas operativas y tests.
- `3a95052 test(ux): audit accessibility and primary flows` (worker `23edb99`): reporte y E2E para rutas, teclado, responsive y regressions.
- `38312b6 docs: add demo script and setup guide` (worker `5349ede`): setup y guion de demo ficticia.
- `1a433b7 docs(project): record PC Builder partial integration` se mantiene como handoff anterior de PC Builder.

La conversación de checkout conectado E2E y la de inventario/procurement no dejaron un commit ni diff atribuible/verificable en los worktrees inspeccionables. No se copiaron worktrees antiguos con HEAD previo a la tercera ola ni snapshots masivos no relacionados; checkout Auth E2E y procurement siguen abiertos. Las ramas/trabajos sin evidencia se registran en `WORKSTREAMS.md` como backlog, no como completados.

### Integración y defectos encontrados

- La matriz RBAC falló al intentar `UPDATE support_tickets` como `authenticated`. Esto era una expectativa de test incorrecta: el modelo revoca DML de navegador y exige `send_support_message`; el test se corrigió para invocar el RPC y verificar el estado resultante. No se añadió grant directo.
- E2E marcó como `test.fail` tres problemas reales: CSS Modules vacíos, acción de checkout habilitada con carrito sin productos y footer “Volver arriba” no interactivo. Se quitaron los expected-failure y se corrigió todo.
- La causa raíz CSS era el loader Turbopack `*.css`, que transformaba también `.module.css` como CSS global. Se migró a `@tailwindcss/postcss` + `postcss.config.mjs`, eliminando `@tailwindcss/turbopack` del pipeline y restaurando exports/hashing de módulos.
- Checkout deshabilita submit si no hay líneas o el subtotal no es positivo; el footer usa enlace a `#page-top` y el header publica el destino.
- El smoke E2E registró un warning de hidratación por estilos `caret-color: transparent` que aparecen inyectados sobre inputs en el navegador Playwright. No se encontró una prop de aplicación que los establezca; revisar en navegador limpio si persiste.

### Gates de integración

- `pnpm install --frozen-lockfile`: pasó después de sincronizar `@tailwindcss/postcss` en lockfile.
- `pnpm test`: 148 Vitest + 18 Node, pasó.
- `pnpm exec tsc --noEmit`: pasó.
- `pnpm lint`: pasó.
- `pnpm build`: pasó después del fix CSS (32 rutas estáticas/dinámicas enumeradas por Next).
- `pnpm test:e2e`: 15/15 pasan después de CSS Modules, checkout vacío y footer; 8 catálogo/demo + 7 UX.
- `pnpm dlx supabase@latest db reset --local --yes`: migraciones/seed pasaron, incluidas product reviews y soporte/RMA agent workflow.
- pgTAP `tests/database`, checkout y reviews: 179 aserciones pasan.
- PostgreSQL runtime `postgres-rls.sql`, `postgres-object-isolation.sql`, RBAC role/action, Auth claim escalation, support-rma y support-flow: pasan con rollback.
- `supabase db lint --local --fail-on error`: sin errores de esquema.

### Backlog abierto / dependencias desbloqueadas

- Checkout por `variantId` desbloquea el lado de compra PC Builder, pero seed no contiene CPU/placa/RAM/caja/fuente con `attributes.pc_builder`; no activar botón hasta integrar esos datos y verificar stock/precio.
- Operaciones/analytics ya consumen datos operativos en slices; recepción/procurement, picking/dispatch completo y conversión oferta B2B → pedido siguen parciales.
- Reviews tiene API/RLS/página/moderación, pero la PDP no enlaza aún el recorrido de opiniones.
- Falta E2E conectado GoTrue/PostgREST de checkout (approved/declined/retry/concurrency) y matriz API Auth con tokens reales.
- Workstreams y próximos owners están en `docs/WORKSTREAMS.md`; alcance y gates se reflejan en `STATUS.md`, `SECURITY.md`, `RBAC_MATRIX.md` y `TESTING.md`.

## Ola 5 despachada — 2026-10-07

Se crearon en paralelo seis conversaciones independientes con worktrees desde `master` (`96194c7`), cada una con bootstrap de seis documentos, dominio/ownership y DoD:

- `client-new-thread:6d108c32-268b-4335-b373-3d7b7ae77f33` — checkout conectado E2E (tests browser/Auth).
- `client-new-thread:6e8348a3-3ecb-45f0-9c45-f7480cabf131` — inventario/procurement (ledger, recepciones; excluye seed para evitar conflicto).
- `client-new-thread:b2c76fe0-03f7-47fd-915c-5f35089f189e` — catálogo PC Builder (solo `supabase/seed.sql` y configurador; checkout `variantId`).
- `client-new-thread:aaaf527a-401d-41ab-b56b-57e1496b87b1` — conversión de presupuesto B2B a pedido.
- `client-new-thread:3d06f4bc-5697-45b4-9bfd-1cb1a674b096` — integración de reviews en PDP.
- `client-new-thread:03e546f1-aeb2-4364-9d87-6a383cc4281c` — Auth/PostgREST role boundary.

Los seis despachos retornaron `clientThreadId` con host local; la creación/setup de worktrees fue asíncrona. La integración de la quinta ola ya inspeccionó los seis worktrees y no depende de que vuelvan a contestar.

## Ola 5 recibida, contrastada e integrada — 2026-10-07

### Workstreams y evidencia real

| Conversación | Trabajo real | Evidencia y estado |
|---|---|---|
| Checkout conectado E2E `6d108c32…` | Cuatro pruebas Playwright con Auth real, PostgREST, approved/declined, refresh/retry, payload idempotente distinto y concurrencia de stock; helpers crean/limpian fixtures solo localmente. | Worker commit `2f8d264`, integrado `3e19ed8`; suite conectada 4/4. El gate demo general se separó de esta suite. |
| Inventario/procurement `6e8348a3…` | Route Handler, UI de recepciones/ajustes, migration idempotente y prueba SQL de ledger/reservas. | Sin commit en el worktree `c27b`; cambios se rescataron. El slice integrado cubre movimientos, no proveedor maestro ni PO. |
| PC Builder `b2c76fe0…` | Seed de seis componentes vendibles, atributos estructurados, carrito conserva `variantId` y checkout conectado. | Worker commit `6011f77`, integrado `e49cdb5`; unit/build gates pasan. |
| CRM/B2B `aaaf527a…` | Conversión explícita de quote aceptado, snapshots organización/propuesta/líneas, actividad tenant e idempotencia. | Worker commit `473bff1`, integrado `1d7e375`; pgTAP/action tests pasan. No es un pedido formal. |
| Reviews PDP `3d06f4bc…` | Opiniones enlazadas desde PDP, estados/cuenta de reviews conectadas y pruebas UI/E2E. | Worker commit `bb20ce8`, integrado `04dff19`; gates pasan. |
| Auth/PostgREST `03e546f1…` | Runner PowerShell para tokens GoTrue/PostgREST, organization/customer isolation, grants/RPC boundary y separación Supabase/Demo Mode. | Sin commit en el worktree `29a6`; script y `docs/AUTH_BOUNDARIES.md` rescatados. 78 probes, 0 fallos; cleanup `0:0:0`. |

### Cambios de integración del Tech Lead

- Se añadió `20261007140000_checkout_retry_lookup.sql` con `find_checkout_order`: el actor autenticado compara clave/fingerprint antes de crear/mutar otro carrito; misma clave + payload diferente devuelve conflicto. Route Handler resuelve resultado de pago para el pedido existente sin duplicar carrito.
- El E2E conectado ahora afirma que hay una única cesta/línea tras retry y comprueba approved/declined, evento/pago/reserva, refresh, reintento y una sola compra concurrente con stock unitario.
- `playwright.config.ts` excluye `checkout-connected/**` del gate demo y deja su runner separado con su configuración/credenciales local-only.
- Se corrigió límite SQL de cantidad de recepción a 1–100000 y se verificó el límite de reserva desde runtime SQL.
- Se hicieron dinámicos los conteos en `postgres-rls.sql` y `security/postgres-object-isolation.sql`: baseline stock/órdenes se captura en la transacción, sin cambiar policies.
- Auth runner crea una orden temporal para demostrar lectura propia/fulfillment y denegación IDOR de cliente B; la limpia en transacción. El scan solo rechaza nombres públicamente prefijados y valor real de la clave, no nombres de variables server-only en source maps.

### Gates ejecutados

- `pnpm install --frozen-lockfile`: pasó.
- `pnpm test`: 160 Vitest + 18 Node, pasó.
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`: pasaron; build enumera 33 rutas.
- `pnpm test:e2e`: 17/17 demo/UX. La nueva suite conectada se ejecuta aparte y pasó 4/4.
- Segundo `pnpm dlx supabase@latest db reset --local --yes`: pasó con las once migraciones y seed. El primer intento dejó stack Docker reiniciándose y falló antes de preparar schema; se verificó que el DB estaba vacío y se repitió tras estabilizarlo.
- pgTAP database/checkout/reviews: 189 aserciones, pasó. RLS, seguridad, role matrix, role escalation, support-rma, support-flow e inventory SQL runtime pasaron secuencialmente con rollback.
- `pwsh -File tests/integration/auth-boundaries/run-local.ps1`: 78 probes HTTP, 0 fallos; cuentas/orgs/pedido de fixture eliminados.
- `supabase db lint --local --fail-on error` y `git diff --check`: pasan.

### Pendientes desbloqueados y riesgos

- Checkout conectado ya está probado localmente; el ledger de inventario permite recepciones/ajustes básicos. Procurement con proveedores/PO, picking/packing/dispatch y efectos de RMA permanecen como slices separados.
- La conversión de quote se registra como snapshot auditable, no como `orders`; falta acordar emisión de pedido B2B, sus direcciones/pago y reserva/precio negociado.
- Matriz HTTP no es CRUD exhaustivo: los roles `marketing` y `manager` no existen como grants y faltan operaciones por columna/endpoint.
- No hay Supabase remoto ni deployment/redirects de producción probados. No afirmar certificación de producción.

Commits de integración de la quinta ola: `1d7e375`, `e49cdb5`, `04dff19`, `3e19ed8`, `a3904c9`, `81c7be7` y `26ee62b`. Documentación consolidada en `STATUS.md`, `WORKSTREAMS.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `SECURITY.md`, `TESTING.md`, `DATA_MODEL.md`, `RBAC_MATRIX.md` y `AUTH_BOUNDARIES.md`.

El siguiente backlog funcional priorizado queda organizado para la sexta ola en `WORKSTREAMS.md`: pedido B2B formal, procurement con proveedores/PO, fulfillment hasta despacho, efectos de RMA aprobada y QA conectado de analytics/dominios. Son slices independientes con ownership separado; comparten contratos ya integrados y no deben afirmar cierre antes de validar persistencia, permisos y pruebas de extremo a extremo.

## Ola 6 despachada — 2026-10-07

Se crearon cinco conversaciones independientes, cada una en worktree, con bootstrap documental, ownership y Definition of Done:

- B2B formal order: `client-new-thread:611d2ca5-4f48-4394-a4f9-98abe74e4c0a`.
- Procurement suppliers/PO: `client-new-thread:7bc64795-e018-48fe-8cbd-d128ab9380e3`.
- Fulfillment workflow: `client-new-thread:f4d5abf7-4185-4a8c-a0a5-1afc4bb22d84`.
- RMA approval effects: `client-new-thread:4b252a38-3247-4979-8abd-53d9641cac7b`.
- Connected QA/analytics integrity: `client-new-thread:16fba6ee-c539-429e-84d8-cd25d31a2165`.

El estado y ownership están en `WORKSTREAMS.md`. Setup de worktrees/conversaciones es asíncrono; las conversaciones tienen instrucciones para inspeccionar su checkout antes de cambiar código.

## Sexta ola integrada por Tech Lead — 2026-10-07

### Trabajo recogido y evidencia

| Conversación | Implementación verificada | Integración | Resultado/limitación |
|---|---|---|---|
| B2B formal order slice (`01a116da-74e8-7d90-986e-56db80cdb512`) | Cotización aceptada → pedido formal tenant-scoped, snapshots, stock/reserva e idempotencia; runner de navegador aislado | `68c6dfa`, `25c074d` | Browser aislado 1/1; pedido queda pendiente de anticipo, sin liquidación implementada |
| Procurement suppliers and purchase orders (`01a116da-74e8-7d90-986e-56fc143a985f`) | Proveedores, purchase orders, recepciones parciales/finales enlazadas al ledger | `4e7d1e6` | SQL runtime valida permisos, replay, sobre-recepción y vínculo de ledger; facturas/pagos a proveedor fuera del alcance |
| Order fulfillment workflow (`01a116da-93a2-7fe0-9cd5-e430efc6a1e8`) | Picking/packing/expedición, timeline y consumo de reserva | Cambios de worktree rescatados en `4d862be`, integrados `8946f7e` | SQL runtime pasa; la expedición consume la reserva una vez |
| RMA approval effects (`01a116da-74e8-7d90-986e-56e5365d584b`) | Reembolso demo calculado/idempotente y unidades `pending_inspection` | `2f4599c` | pruebas de soporte/RMA/concurrencia pasan; inspección física/disposición de stock queda pendiente |
| Connected QA and analytics integrity (`01a116da-b0ae-7a82-bb34-9fe260cd1eff`) | E2E conectado de portal B2B, pedidos de cuenta, reviews, soporte y analytics; definición de métricas | Cambios de QA rescatados y commit coordinador `2f17bd2` | Suite conectada 5/5 + cleanup; B2B de este suite verifica autorización sin escribir pedido; emisión real cubierta en runner aislado |

### Defectos de integración corregidos

- El test de aislamiento de Postgres asumía recuentos estáticos de pedidos y grants que dejaron de ser ciertos al cambiar el seed. Ahora compara con un baseline tomado dentro de su transacción, sin relajar RLS.
- El E2E transversal B2B esperaba la antigua conversión auditada; se actualizó al contrato de pedido formal y se limitó a visibilidad/autorización para mantener fixtures reintentables. El runner aislado verifica la mutación real.
- La primera ejecución produjo un pedido fixture cuyo cleanup chocó con el ledger append-only de reservas. Se reinició la base local, se eliminó esa mutación del E2E común y se repitió la suite: 5/5 con teardown limpio.

### Gate coordinador

`pnpm install --frozen-lockfile` pasó; `tsc --noEmit`, `lint`, `pnpm test` (175 Vitest + 18 Node), `pnpm test:e2e` (17/17), `pnpm build` (36 rutas), reset local (15 migraciones + seed), pgTAP (265 aserciones), SQL runtime RLS/RBAC/Auth/support/inventory/procurement/fulfillment y DB lint pasaron. La suite `connected-domains` terminó 5/5 con cleanup. Checkout conectado 4/4, B2B aislado 1/1 y 78 probes HTTP Auth ya estaban verificados en esta cadena de integración.

### Estado global tras la sexta ola

No queda P0 local reproducible. Quedan como P1: inspección/disposición RMA, anticipo B2B, Demo Mode por rol/reset, cobertura exhaustiva de permisos y reconciliación de KPIs. P2: auditoría visual/accesible completa, medición CWV/bundle e inspección de navegación/contenido. No se configuró/probó Supabase remoto ni producción. El siguiente backlog y ownership candidato están en `WORKSTREAMS.md`.

## Ola 7 — RMA warehouse inspection y disposición

### Trabajo realizado

- Se añadió una cola SSR de devoluciones aprobadas en `/backoffice/returns`, limitada a `fulfillment_manager`/`super_admin`, con almacenes activos y cantidad aprobada por línea.
- La RPC `inspect_return_item` exige cantidad completa, motivo e idempotency key. `restocked` actualiza inventario y crea movimiento `return_restock` en la misma transacción; `disposed` deja stock sin cambio.
- El fingerprint impide reusar una clave con payload distinto. Reintentar la misma operación devuelve replay incluso después de que el RMA se cierre. Una segunda disposición de la línea se rechaza.
- Al disponer todas las líneas, el RMA pasa a `closed`, se registra el cambio en timeline y un trigger prohíbe cerrar por otro camino.
- La vista de historial del cliente muestra timeline y disposición por producto.

### Archivos y contratos

- `supabase/migrations/20261007200000_return_inspection_disposition.sql`
- `lib/inventory/returns.ts`, `app/api/backoffice/returns/inspection/route.ts`, `app/backoffice/returns/**`
- `app/(store)/soporte/return-history.tsx`, navegación de inventario backoffice
- `tests/integration/support-flow/return-inspection.sql`, `inspection-route.test.ts`
- Contratos nuevos: movement type `return_restock`; `inventory_movements.return_request_id/return_item_id`; tabla privada `return_inspection_attempts`; RPC pública `inspect_return_item`. No hay DML de navegador.

### Verificación ejecutada

- Supabase local reset: 16 migraciones y seed aplicados.
- PostgreSQL runtime RMA: pasó con autorización por rol, cantidad, restock, desecho, replay antes/después de cierre, conflicto de fingerprint, segunda disposición, stock y timeline.
- Route tests: 4/4.

### Bugs, límites y siguientes pasos

- El flujo aún no tiene browser E2E con sesión warehouse; el producto cuenta con prueba de route y PostgreSQL.
- Pendientes del proyecto: anticipo B2B, recorrido/reset Demo Mode por rol, matriz de permisos más exhaustiva, reconciliación de analytics, auditoría responsive/performance/fake completeness y pruebas de despliegue remoto.
- No hay commit coordinador para esta séptima ola todavía; debe ejecutarse el gate completo, revisar diff y crear commits lógicos.
