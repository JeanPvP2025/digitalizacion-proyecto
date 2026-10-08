# Testing y gates

## Gates de aplicación

```powershell
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
git diff --check
```

`pnpm test:e2e` ejecuta únicamente los flujos demo/UX y no necesita secretos Supabase. Para checkout conectado se usa el runner aislado:

```powershell
pwsh -File tests/e2e/checkout-connected/run.ps1
```

El runner obtiene claves solo en memoria desde el status de Supabase local, rechaza URLs no loopback, ejecuta Chromium con `DEMO_MODE=false` y limpia fixtures. Cubre aprobado, rechazado, misma clave/payload, clave/payload distinto, refresh/retry y dos sesiones concurrentes con una unidad. Nunca ejecutar simultáneamente con otros tests que muten el mismo proyecto local.

Integración de profundidad 2026-10-08: `pnpm test` 288 Vitest + 39 Node; `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` y `git diff --check` pasan. `pnpm test:e2e` 19/19, incluidas landings de marcas, categorías y selecciones; el barrido comprueba enlaces internos y overflow a 390/768 px. La suite Node incluye landings derivadas del dataset y una matriz PC Builder: 256 combinaciones CPU/placa/RAM/caja, GPU demasiado larga y aviso de margen PSU. `pnpm install --frozen-lockfile` ya había pasado antes de esta ronda; no se añadieron dependencias. Auth aislado 30/30 unit/integration y 6/6 browser; datos de catálogo 19/19 y `node scripts/catalog/generate.mjs --check`. Build incluye `/marcas`, `/marcas/[slug]`, `/categorias`, `/categorias/[slug]`, `/campanas` y `/campanas/[slug]`; sitemap dinámico. Supabase local: reset 19 migraciones+seed; pgTAP `tests/database` 183/183; db lint público/privado sin errores; 96 productos publicados, 27 categorías, 7 marcas y 96 variantes EUR activas. Playwright todavía reporta `caret-color: transparent` durante hidratación sin atribución al código y el entorno Windows avisa del conflicto `NO_COLOR`/`FORCE_COLOR`.

## Rendimiento y accesibilidad medidos

Lighthouse 13.5.0 se ejecutó contra el build de producción local. La portada móvil obtuvo rendimiento 92, accesibilidad 100, mejores prácticas 100, LCP simulado 3,2 s, CLS 0,003 y TBT 50 ms. La traza observada del navegador local registró LCP 557 ms; no se interpreta como dato de campo. El catálogo desktop obtuvo 100 en rendimiento, accesibilidad y mejores prácticas, con LCP 0,6 s, CLS 0,011 y TBT 0 ms. Lighthouse no publicó INP. `docs/PERFORMANCE_AUDIT.md` documenta el perfil de simulación y límites.

Las auditorías de contraste, nombre accesible, tamaño de objetivos táctiles y entrega de imágenes pasan en las dos páginas medidas. Estas dos muestras no certifican el backoffice ni todas las rutas. Lighthouse marca ambas como no indexables porque no se configuró un dominio público y la política local de `robots.txt` bloquea el rastreo deliberadamente.

El bootstrap `scripts/demo/assign-staff-roles.ps1` se ejecutó contra Supabase local con cinco cuentas Auth ficticias: creó exactamente un grant para `super_admin`, `catalog_manager`, `support_agent`, `sales_manager` y `fulfillment_manager`. Después se hizo `db reset --local`; las cuentas de test desaparecieron junto con sus grants.

## Supabase/PostgreSQL local

```powershell
pnpm dlx supabase@latest db reset --local --yes
pnpm dlx supabase@latest db lint --local --schema public,private --level error --fail-on error
pnpm dlx supabase@latest test db --local tests/database tests/integration/commerce/checkout-flow.sql tests/integration/reviews/product-reviews.sql
Get-Content tests\integration\postgres-rls.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\security\postgres-object-isolation.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\rbac\postgres-role-action-matrix.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\auth-boundaries\postgres-role-escalation.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\support-rma\postgres.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\support-flow\postgres.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\support-flow\return-inspection.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\inventory\inventory-movements.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\procurement\procurement.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Para boundary HTTP con tokens reales, después del reset:

```powershell
pwsh -File tests/integration/auth-boundaries/run-local.ps1
```

La integración pasó reset/seed (17 migraciones); **230** aserciones pgTAP; RLS/security/RBAC/auth-escalation/support/inventory/procurement/fulfillment runtime SQL y runtime SQL RMA; **78** probes HTTP GoTrue/PostgREST; y DB lint sin errores. En el cierre actual se repitieron pgTAP, todos los scripts runtime SQL enumerados y los 78 probes HTTP con cero fallos. Los scripts de conteo RLS toman baseline dentro de la transacción para no depender de un número fijo de filas en seed. Los scripts runtime reversibles revierten fixtures; la prueba concurrente RMA se limpia explícitamente al finalizar.

## Qué verifican

- Checkout SQL/E2E: precio/stock de servidor, snapshots, reserva única, estados approved/declined/processing/error, recuperación, payload distinto bajo clave existente, refresh y concurrencia de stock.
- Inventario SQL: autorización warehouse/sales, recepción/ajuste idempotente, conflicto de fingerprint, no consumo de reserva y fulfillment que consume la reserva una sola vez.
- Procurement SQL/rutas: solo fulfillment/superadmin ven proveedores y órdenes; las escrituras usan RPC. Prueba creación/edición/colocación/cancelación, recepción parcial/final vinculada a un movimiento, replay/conflicto por clave, sobre-recepción, archivo de proveedor y permisos de sales/buyer.
- RLS/Auth HTTP: anon, customer A/B, business admin/buyer, catalog, support, sales, fulfillment y superadmin; perfil/pedido/ticket/tenant aislados; escalation y RPCs privilegiadas denegadas; demo no hace fallback conectado.
- B2B formal: owner/admin emite desde cotización aceptada; snapshots, organización, idempotencia, pedido y reserva quedan enlazados. Anticipo demo aprobado deja estado pagado y audita pedido/CRM; rechazo cancela/libera reserva; buyer es denegado y retries no duplican.
- Reviews/RMA: elegibilidad por línea, moderación, intake atómico, límite de cantidades y transitions por RPC.
- Inspección RMA: solo almacén/superadmin, cantidad exacta aprobada, reposición incrementa stock y crea un único ledger, desecho no cambia stock, retry igual incluso después del cierre, payload distinto/segunda disposición denegados y timeline completo.

## Límites pendientes

- La matriz Auth/RLS no cubre CRUD de cada columna/tabla/endpoint para cada rol; `manager` y `marketing` no son roles persistidos y no deben recibir permisos implícitos. Ver `RBAC_MATRIX.md`.
- No se probó configuración Supabase remota, despliegue, secretos de producción o migración remota.
- La suite conectada cubre pedidos en cuenta, autorización B2B, reseña elegible, ticket/mensajes y analytics. El pedido B2B real se prueba en un proyecto Supabase aislado para no dejar fixtures persistentes en el stack compartido.
- Procurement, etapas de fulfillment, emisión B2B formal y anticipo demo, reembolso aprobado e inspección/disposición RMA están integrados. Quedan revisión manual de los roles demo, recorrido browser warehouse autenticado, evaluación visual/performance y pruebas remotas. Facturas/impuestos/pagos de proveedor e integraciones externas están fuera del alcance actual.
