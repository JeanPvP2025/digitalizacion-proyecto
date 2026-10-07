# Testing y gates

## Aplicación

```powershell
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
git diff --check
```

Último gate integrado (2026-10-07): frozen install, typecheck y lint limpios; `pnpm test`: 42 Vitest + 18 Node; `pnpm test:e2e`: 7 Playwright; build de producción pasa. Node imprime avisos de `MODULE_TYPELESS_PACKAGE_JSON` en dos tests `.mjs` que importan TS; un test negativo registra intencionalmente `NODRIA quote persistence failed Error`. Playwright/Next puede emitir aviso de color por entorno Windows, sin fallo.

## Supabase local

```powershell
pnpm dlx supabase@latest db reset
pnpm dlx supabase@latest db lint --local
pnpm dlx supabase@latest test db --local tests/database
Get-Content tests\integration\postgres-rls.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

El reset aplica migraciones y seed en Supabase local; el SQL de integración corre fixtures en transacción y hace rollback. Resultados actuales: reset/seed OK, DB lint sin errores, 60 pgTAP OK y gate PostgreSQL de RLS/checkout OK. Supabase usa puertos `56200–56209` por exclusiones de los puertos predeterminados en Windows.

## Qué prueba el gate PostgreSQL

- Permisos/grants y escenarios RLS seleccionados para anon, customer A/B, sales, fulfillment, support, business buyer/admin y superadmin.
- Privacidad de pedidos, líneas, eventos, pagos, tickets y membresías entre tenants.
- Carrito de otro usuario, sobreventa, retry de checkout, reserva única, pago aprobado/fallido, liberación de stock y reintento idempotente de evento.
- El gate es local y no reemplaza el recorrido conectado del navegador, las pruebas de concurrencia con dos sesiones, ni un CRUD matrix completo.

## Pendiente

- E2E conectado con Supabase Auth real: pago aprobado/rechazado, retries, orden/reservas y recuperación de fallo.
- Teclado y responsive manual para diálogos, navegación y backoffice.
- Matriz completa de permisos por tabla y operación, incluyendo todas las funciones expuestas.
- Tests de persistencia atómica para ticket/mensaje y lifecycle de RMA.
