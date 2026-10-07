# Seguridad y RLS

Estado del **2026-10-07** tras la sexta ola. Migraciones, código y pruebas locales fueron revisados. No se probaron credenciales remotas ni JWT de un proyecto de producción.

## Controles integrados

- RLS/grants protegen tablas; escrituras críticas de pedido, pago, reserva, soporte y stock pasan por RPCs limitadas. Las acciones de inventario exigen `fulfillment_manager` o `super_admin` tanto en Route Handler como en PostgreSQL.
- El modo de datos se decide en servidor. Supabase configurado prevalece sobre `DEMO_MODE`; una caída conectada devuelve error y no recurre a `.data/`.
- Checkout reconstruye variantes vendibles, precio y stock; `find_checkout_order` compara el fingerprint bajo identidad autenticada antes de reusar pedido y resolver pago. La clave service-role queda en servidor y solo resuelve el resultado de pago demo.
- Checkout e inventario rechazan una clave idempotente reutilizada con payload diferente. Los reintentos de checkout no crean carritos adicionales; las recepciones/ajustes registran un movimiento y preservan reservas activas.
- RMA limita suma devuelta por línea y requiere pedido entregado/ventana aplicable. Ticket+primer mensaje y transiciones de agente usan RPCs transaccionales.
- CRM limita organizaciones/membresías por tenant. Ventas puede reclamar propuestas B2B sin asignar; la cola expone actividad `internal`, no notas privadas de organización. Ventas no accede a pedidos ni pagos.
- Reseñas requieren una línea de pedido entregada del mismo usuario/producto; comienzan en moderación y solo las publicadas se exponen públicamente.
- Emisión de pedido formal B2B exige owner/admin de la organización, cotización aceptada y stock validado; la función crea un pedido idempotente pendiente de anticipo y no confía en importes/direcciones como autorización.
- Procurement y fulfillment usan RPCs con autorización en PostgreSQL; receipts enlazan movimientos del ledger, y expedición consume la reserva una sola vez.
- Aprobación RMA solo genera el reembolso simulado permitido y deja cantidad pendiente de inspección. No se cambia inventario hasta una futura disposición autorizada.
- No hay campos de pago real ni se procesan cargos. El navegador no puede llamar a RPCs privilegiadas de pago, fulfillment, entrega ni inventario.

## Evidencia local

- `pwsh -File tests/integration/auth-boundaries/run-local.ps1`: **78 probes HTTP, 0 fallos**, con JWT emitidos por GoTrue y consultas PostgREST. Incluye anon, customer A/B, B2B admin/buyer, catalog, support, sales, fulfillment, superadmin, aislamiento de objetos, roles, RPCs, modo demo y scan de secreto cliente.
- `tests/integration/postgres-rls.sql`, `tests/integration/security/postgres-object-isolation.sql`, role-action matrix, auth escalation, Support/RMA y movimientos de inventario: pasan con fixtures en transacciones revertidas.
- pgTAP database/checkout/reviews/fulfillment: 265 aserciones; `supabase db lint --local --fail-on error`: sin errores.
- `tests/e2e/checkout-connected/run.ps1`: 4/4 con sesión browser GoTrue/PostgREST; aprueba, rechaza, reintenta tras refresh, rechaza payload con clave repetida y evita doble reserva bajo concurrencia.
- La verificación de cleanup del runner Auth encontró cero usuarios/orgs/pedidos fixture. El scan no encontró identificadores `NEXT_PUBLIC_*` privilegiados ni el valor local de service-role en fuentes/assets cliente.

## Límites

La matriz no prueba CRUD de cada columna/tabla/endpoint contra todos los roles; `RBAC_MATRIX.md` conserva esa brecha. Los roles `manager` y `marketing` no existen como grants y no deben inventarse sin una decisión de producto. Demo Mode aún necesita recorrido completo por roles y reset reproducible; no hay secret management/deployment remoto probado. El anticipo B2B no equivale a un pago real. No habilitar datos reales ni afirmar certificación de producción.
