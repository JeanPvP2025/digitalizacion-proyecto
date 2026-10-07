# Seguridad y RLS

Estado del 2026-10-07. Revisado contra la base Supabase local reiniciada desde las migraciones del checkout. No se probaron credenciales remotas ni JWT emitidos por un proyecto de producción.

## Controles integrados

- RLS/grants por propósito; escritura directa de pedido, pago, reserva y stock se mantiene cerrada y los cambios de estado usan RPCs.
- El modo de datos se decide en servidor. Fixtures `.data/` requieren modo demo explícito de desarrollo; los fallos conectados de catálogo no se esconden con fixtures.
- Checkout valida identidad, reconstruye carrito desde IDs/variantes, vuelve a leer precio y stock, y persiste el pedido/reservas en RPC. El resultado demo se procesa en RPC privilegiada mediante `lib/commerce/payment-admin.ts`, que solo lee `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` en servidor. Ninguna variable `NEXT_PUBLIC_*` contiene clave privilegiada.
- Pago simulado no solicita tarjeta real. La transición pedido/pago/timeline/reserva es atómica e idempotente por event ID; el navegador no puede escoger resultado invocando el RPC.
- RMA impide devolver más unidades de las compradas y exige pedido entregado dentro de la ventana; ticket y primer mensaje se crean juntos.
- CRM protege organizaciones/membresías por tenant. La cola de propuestas B2B no asignadas es global para que ventas pueda reclamarlas; las actividades internas se filtran y las notas `organization` no son visibles a ventas hasta que la propuesta sea reclamada. Esta excepción es explícita y probada.
- Sales no accede a pedidos, pagos, almacén ni tickets; payment SELECT se limita a cliente, fulfillment y superadmin.

## Hallazgos de la revisión independiente

Ver `SECURITY_FOLLOWUP.md` para evidencia. No se confirmó bypass Critical/High en la segunda revisión. La prueba detectó que ventas podía ver notas `organization` de propuestas sin asignar; `20261007114945_limit_sales_queue_activity_visibility.sql` limita la cola a actividades `internal`. La misma migración elimina `sales_manager` de la policy de pagos. Los hallazgos previos sobre organizaciones/membresías globales se corrigieron en el workflow CRM.

## Evidencia local

- `tests/integration/postgres-rls.sql`
- `tests/integration/security/postgres-object-isolation.sql`
- `tests/integration/support-rma/postgres.sql`
- `tests/database/*.sql` y `tests/integration/commerce/checkout-flow.sql`
- `pnpm dlx supabase@latest db lint --local --fail-on error`

Los escenarios ejecutan `SET ROLE` más claims JWT locales y revisan grants/RLS reales de PostgreSQL. No equivalen a una prueba HTTP con Auth/GoTrue/PostgREST. No hay CRUD exhaustivo para todas las operaciones/roles; `RBAC_MATRIX.md` identifica explícitamente esas brechas.

## No habilitar datos reales todavía

Faltan prueba de checkout conectado con Auth local desde aplicación, matriz CRUD/API exhaustiva, flujos completos de Operations/fulfillment y revisión de seguridad sobre el despliegue. Separar secretos por entorno; nunca exponer service-role en cliente ni variables `NEXT_PUBLIC_*`.
