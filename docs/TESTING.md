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

Resultado tras la quinta ola: 160 Vitest + 18 Node; 17/17 E2E demo/UX; 4/4 E2E checkout conectado; TypeScript, ESLint y build pasan. En E2E demo apareció un warning de hidratación por `caret-color: transparent` en inputs; no se atribuyó al árbol React y falta confirmarlo en navegador limpio. Windows también informa `NO_COLOR`/`FORCE_COLOR`.

## Supabase/PostgreSQL local

```powershell
pnpm dlx supabase@latest db reset --local --yes
pnpm dlx supabase@latest db lint --local --fail-on error
pnpm dlx supabase@latest test db --local tests/database tests/integration/commerce/checkout-flow.sql tests/integration/reviews/product-reviews.sql
Get-Content tests\integration\postgres-rls.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\security\postgres-object-isolation.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\rbac\postgres-role-action-matrix.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\auth-boundaries\postgres-role-escalation.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\support-rma\postgres.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\support-flow\postgres.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\inventory\inventory-movements.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Para boundary HTTP con tokens reales, después del reset:

```powershell
pwsh -File tests/integration/auth-boundaries/run-local.ps1
```

La quinta ola pasó reset/seed; **189** aserciones pgTAP; RLS/security/RBAC/auth-escalation/support/inventory runtime SQL; **78** probes HTTP GoTrue/PostgREST; y DB lint sin errores. Los scripts de conteo RLS toman baseline dentro de la transacción para no depender de un número fijo de filas en seed. Todos los scripts runtime revierten fixtures.

## Qué verifican

- Checkout SQL/E2E: precio/stock de servidor, snapshots, reserva única, estados approved/declined/processing/error, recuperación, payload distinto bajo clave existente, refresh y concurrencia de stock.
- Inventario SQL: autorización warehouse/sales, recepción/ajuste idempotente, conflicto de fingerprint, no consumo de reserva y fulfillment que consume la reserva una sola vez.
- RLS/Auth HTTP: anon, customer A/B, business admin/buyer, catalog, support, sales, fulfillment y superadmin; perfil/pedido/ticket/tenant aislados; escalation y RPCs privilegiadas denegadas; demo no hace fallback conectado.
- Conversión CRM/B2B: quote aceptado produce snapshots e historial una sola vez; el registro no se confunde con un pedido comercial.
- Reviews/RMA: elegibilidad por línea, moderación, intake atómico, límite de cantidades y transitions por RPC.

## Límites pendientes

- La matriz Auth/RLS no cubre CRUD de cada columna/tabla/endpoint para cada rol; roles `manager` y `marketing` requieren probes HTTP adicionales. Ver `RBAC_MATRIX.md`.
- No se probó configuración Supabase remota, despliegue, secretos de producción o migración remota.
- Falta E2E conectado para pedido en cuenta, portal B2B, reseña elegible, ticket/mensajes y roles de backoffice.
- Operations/picking, procurement completo, pedido formal B2B y efectos de RMA no están completos; gates de las capas existentes no prueban esos flujos.
