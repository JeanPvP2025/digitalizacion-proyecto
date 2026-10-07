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

Integración tercera ola (2026-10-07): 71 pruebas Vitest + 18 Node; 8 Playwright demo; build Next.js; typecheck y ESLint pasan. Node imprime `MODULE_TYPELESS_PACKAGE_JSON` en pruebas `.mjs`; un test negativo de persistencia imprime un error intencional. Playwright en Windows avisa del conflicto `NO_COLOR`/`FORCE_COLOR`; no afecta el resultado.

## Supabase/PostgreSQL local

```powershell
pnpm dlx supabase@latest db reset --local --yes
pnpm dlx supabase@latest db lint --local --fail-on error
pnpm dlx supabase@latest test db --local tests/database tests/integration/commerce/checkout-flow.sql
Get-Content tests\integration\postgres-rls.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\security\postgres-object-isolation.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\support-rma\postgres.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Resultado observado: reset/seed OK; 156 pgTAP aserciones; tres scripts de PostgreSQL runtime pasan y revierten sus fixtures; DB lint no encuentra errores ni avisos.

## Cobertura que sí existe

- Checkout SQL: pago approved/declined/processing/temporary error; pedido/pago/reserva única; idempotencia de mismo payload; rechazo de cambio de dirección o cantidad; misma payment event key idempotente y rechazo de key con otro resultado; fallo parcial provoca rollback; reintento recupera; rechazo cancela y libera stock.
- RLS/seguridad SQL: anon, customer A/B, business buyer/admin, sales, fulfillment, support y superadmin; boundaries de organización, pagos, órdenes, tickets, mensajes, devoluciones, quotes/actividades CRM, RPC grants y escalada de rol.
- RMA SQL: intake ticket+mensaje, límite de compra/ventana, idempotencia y aislamiento.
- Aplicación: pruebas de Route Handler y Server Actions usan dobles/mocks; los E2E usan `DEMO_MODE=true` sin Auth/Supabase conectado.

## Límites pendientes

- No hay E2E conectado contra GoTrue/PostgREST; el navegador no ejecuta checkout con usuario autenticado real.
- No se probó doble POST concurrente, doble click contra ruta real, refresh conectado ni dos compras simultáneas con stock insuficiente.
- La matriz no cubre CRUD de cada tabla/columna/endpoint por cada rol; ver `RBAC_MATRIX.md`.
- No se probó configuración remota ni despliegue. Los gates locales no certifican producción.
