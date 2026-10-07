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
