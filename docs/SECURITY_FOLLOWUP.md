# Security follow-up — tercera ola

**Revisión:** 2026-10-07. Workstream independiente `client-new-thread:a855f9c6-4ee8-41af-aa81-2cbd00b75974` y revalidación de integración sobre PostgreSQL local. Los hilos `client-new-thread` no se pudieron leer por ID con la herramienta de conversaciones; el worktree y su commit fueron inspeccionados directamente.

## Resultado

No se confirmó un bypass de autenticación Critical/High. Sí se corrigieron límites de menor severidad antes de cerrar la integración:

| Hallazgo | Severidad inicial | Verificación / corrección | Estado |
|---|---|---|---|
| SEC-01: acceso de sales_manager a organizaciones/membresías globales | P2 | `20261007094816_crm_b2b_quote_workflow.sql` elimina la lectura global de organizaciones y membresías. La prueba runtime confirma que sales recibe cero filas ahí. | ✅ Cerrado |
| SEC-01 residual: cola formal B2B sin asignar | P2 (decisión de alcance) | El flujo CRM exige que ventas lea y reclame presupuestos solicitados sin dueño. Ese acceso a quote/line está permitido por diseño; no habilita directorio de organizaciones, membresías, pedidos ni pagos. La prueba cubre esa excepción. | ✅ Aceptado/documentado; controlar campos del contrato |
| SEC-03: nota `organization` visible a sales antes del claim | P2 | Reproducido al probar actividades de presupuestos no asignados. `20261007114945_limit_sales_queue_activity_visibility.sql` restringe la cola a `visibility='internal'`; después del claim ventas puede trabajar el presupuesto según su rol. | ✅ Corregido y probado |
| SEC-02: policy de pagos incluía sales pero nested order RLS lo bloqueaba | P3 | Policy simplificada en `20261007114945_limit_sales_queue_activity_visibility.sql`: solo cliente dueño, fulfillment y superadmin. Se prueba con una fila de pago real sintética. | ✅ Corregido y probado |

## Reproducción local

```powershell
pnpm dlx supabase@latest db reset --local --yes
pnpm dlx supabase@latest test db --local tests/database tests/integration/commerce/checkout-flow.sql
Get-Content tests\integration\postgres-rls.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\security\postgres-object-isolation.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests\integration\support-rma\postgres.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
pnpm dlx supabase@latest db lint --local --fail-on error
```

Resultado: 156 pgTAP aserciones; RLS, aislamiento, pago, membership-RPC, CRM activity y RMA SQL pasan; fixtures revertidas; DB lint limpio.

## Límite de alcance de ventas

Los roles `sales_manager` pueden reclamar presupuestos B2B formales `requested` sin `sales_owner_id`. Esto incluye datos necesarios de organización/solicitante/productos para preparar la oferta. No se concede una lectura global de organizaciones o roster de miembros. La actividad `organization` de esos presupuestos no se incluye hasta que la relación sea de trabajo asignada; solo `internal` aparece en la cola. El equipo de ventas no puede leer pedidos ni transacciones de pago.

Los roles internos existentes son `catalog_manager`, `fulfillment_manager`, `support_agent`, `sales_manager` y `super_admin`; `marketing` y `manager` genérico no son roles del enum y no deben concederse mediante claims improvisados. Ver `RBAC_MATRIX.md`.

## Riesgos y limitaciones restantes

- La matriz PostgreSQL simula `SET ROLE` y claims JWT locales; no se probó un recorrido HTTP con JWT emitidos por GoTrue/PostgREST.
- Route tests/Server Actions usan mocks; no hay E2E conectado del checkout con Auth real.
- No se demostró concurrencia con dos sesiones independientes ni CRUD exhaustive por tabla, columna, rol y endpoint.
- La URL y secret/service-role se usan solo del lado del servidor para el RPC de pago simulado; no se encontraron secretos en `NEXT_PUBLIC_*`. No hay entorno remoto.
- Los tests de navegador usan explícitamente el modo demo.
