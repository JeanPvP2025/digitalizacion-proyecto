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

Integración cuarta ola (2026-10-07): 148 pruebas Vitest + 18 Node; 15 Playwright demo/UX; build Next.js; typecheck y ESLint pasan. Playwright ejecutó 3 checks dirigidos sobre CSS Modules, compra con carrito vacío y volver arriba. Un warning de hidratación mostró `caret-color: transparent` inyectado por el contexto del navegador en inputs, no una prop del árbol React; confirmar en navegador limpio si persiste. También aparece el aviso de Windows `NO_COLOR`/`FORCE_COLOR`.

## Supabase/PostgreSQL local

```powershell
pnpm dlx supabase@latest db reset --local --yes
pnpm dlx supabase@latest db lint --local --fail-on error
pnpm dlx supabase@latest test db --local tests/database tests/integration/commerce/checkout-flow.sql
pnpm dlx supabase@latest test db --local tests/integration/reviews/product-reviews.sql
Get-Content tests\integration\postgres-rls.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\security\postgres-object-isolation.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\rbac\postgres-role-action-matrix.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\auth-boundaries\postgres-role-escalation.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\support-rma\postgres.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\support-flow\postgres.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Resultado observado tras la cuarta ola: reset/seed OK; 179 pgTAP aserciones; RLS/role matrix/auth-boundary/support scripts pasan y revierten sus fixtures; DB lint sin errores de schema. La primera ejecución de role matrix reveló que su expectativa de DML directo a tickets contradecía el grant revocado; el test ahora llama `send_support_message`, y no se amplió el permiso.

## Cobertura que sí existe

- Checkout SQL: pago approved/declined/processing/temporary error; pedido/pago/reserva única; idempotencia de mismo payload; rechazo de cambio de dirección o cantidad; misma payment event key idempotente y rechazo de key con otro resultado; fallo parcial provoca rollback; reintento recupera; rechazo cancela y libera stock.
- RLS/seguridad SQL: anon, customer A/B, business buyer/admin, catalog manager, sales, fulfillment, support y superadmin; boundaries de organización, pagos, órdenes, tickets, mensajes, devoluciones, reviews, quotes/actividades CRM, RPC grants y escalada de rol.
- RMA SQL: intake ticket+mensaje, límite de compra/ventana, idempotencia y aislamiento.
- Aplicación: pruebas de Route Handler y Server Actions usan dobles/mocks; los E2E usan `DEMO_MODE=true` sin Auth/Supabase conectado.

## Límites pendientes

- No hay E2E conectado contra GoTrue/PostgREST; el navegador no ejecuta checkout con usuario autenticado real ni se probaron los resultados approved/declined en API real.
- No se probó doble POST concurrente, doble click contra ruta real, refresh conectado ni dos compras simultáneas con stock insuficiente.
- La matriz no cubre CRUD de cada tabla/columna/endpoint por cada rol; ver `RBAC_MATRIX.md`.
- No se probó configuración remota ni despliegue. Los gates locales no certifican producción.
