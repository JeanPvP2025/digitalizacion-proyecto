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

Resultado de la integración actual: 179 Vitest + 18 Node; 17/17 E2E demo/UX; 4/4 E2E checkout conectado; 5/5 dominios conectados con cleanup limpio; 1/1 B2B browser aislado con anticipo aprobado/rechazado, replay y permisos; TypeScript, ESLint y build pasan. La route suite RMA es 4/4. El E2E demo informa de un atributo `caret-color: transparent` inyectado en inputs, sin origen identificado en la aplicación; hay que confirmar en navegador limpio. Windows también informa `NO_COLOR`/`FORCE_COLOR`.

El bootstrap `scripts/demo/assign-staff-roles.ps1` se ejecutó contra Supabase local con cinco cuentas Auth ficticias: creó exactamente un grant para `super_admin`, `catalog_manager`, `support_agent`, `sales_manager` y `fulfillment_manager`. Después se hizo `db reset --local`; las cuentas de test desaparecieron junto con sus grants.

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
