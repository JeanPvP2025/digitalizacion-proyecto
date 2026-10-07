# Ampliación de pruebas RBAC — 2026-10-07

## Objetivo y alcance

Se añadieron probes runtime para cubrir huecos señalados por `RBAC_MATRIX.md`: `catalog_manager`, ACL de tablas/columnas, grants de RPC sensibles, suplantación de roles mediante claims y la ausencia de `marketing`/`manager`. Se usaron los roles SQL de PostgREST (`anon`, `authenticated`, `service_role`) y los grants persistidos reales de `public.app_role`; no se creó ningún rol ficticio ni se cambiaron migraciones/policies.

Los tests se ejecutan directamente contra PostgreSQL local con `SET LOCAL ROLE` y claims `request.jwt.claim.sub` / `request.jwt.claims`, que es el contexto que PostgREST instala desde el JWT. No son peticiones HTTP a GoTrue/PostgREST con tokens firmados.

## Archivos añadidos

- `tests/integration/rbac/postgres-role-action-matrix.sql`: fixtures para customer A/B, buyer/admin B2B, catalog, support, sales, fulfillment y super_admin; permisos globales de tabla/columna y función; visibilidad RLS; acción de catálogo, update de ticket, claim de quote, gestión de membresía, IDOR y separación tenant.
- `tests/integration/auth-boundaries/postgres-role-escalation.sql`: rechazo de autoasignación directa, claims falsificados, roles `marketing`/`manager` que no existen en el enum y ausencia de RPC pública de asignación de roles.

Ambos archivos envuelven usuarios, grants, organizaciones, tickets, productos, presupuestos y mutaciones en una transacción y verifican que las fixtures no permanezcan después de `ROLLBACK`.

## Hallazgos concretos

1. **Cobertura previa incompleta de `catalog_manager` — cerrada parcialmente.** La matriz ya decía que solo había inspección de policies. Ahora se prueba runtime con un producto no publicado: catalog puede leerlo y publicarlo; customer, anon y los roles no catalog no obtienen esa fila; catalog no obtiene inventario ni CRM. Queda pendiente cubrir CRUD de todas las tablas de catálogo (`categories`, variantes, especificaciones y relaciones) y restricciones por columna.
2. **ACL efectiva de organización.** `organizations_update_admin` tiene una policy RLS, pero el rol SQL `authenticated` no recibe `UPDATE` efectivo en esa tabla. El test registra la denegación directa y mantiene la administración de miembros por RPC. Esto coincide con la matriz actual, que solo promete a admin/owner gestionar miembros mediante RPC; la policy de update parece no ser alcanzable mientras ese grant siga revocado. Tech Lead debe decidir si eliminar la policy sin uso o definir un contrato de edición de organización antes de conceder UPDATE.
3. **`marketing` y `manager` no son roles persistibles.** El enum contiene exactamente `catalog_manager`, `fulfillment_manager`, `support_agent`, `sales_manager` y `super_admin`. Los aliases desconocidos fallan al convertirse a `app_role`; claims JWT con esos labels o `super_admin` no alteran `private.has_any_staff_role`; el usuario autenticado tampoco puede insertar un grant válido.
4. **Acciones privilegiadas separadas por ACL.** `resolve_demo_payment`, `fulfill_order`, `mark_order_delivered` y `adjust_inventory` no son ejecutables por `anon`/`authenticated` y sí por `service_role`. Las RPC de checkout, soporte, RMA, membership y quotes tienen grants autenticados; se prueban además decisiones de autorización en las RPC de membresía y claim, pero no toda la lógica de cada RPC para cada rol.

## Cobertura

| Área | Estado | Evidencia y límite |
|---|---|---|
| Customer A/B, B2B buyer/admin y segregación de staff | **Completa para los escenarios añadidos** | Lecturas propias/tenant, IDOR de perfil, carrito, tickets y quotes; controles por dominio para support, sales, fulfillment, catalog y super_admin. No equivale a CRUD exhaustivo del esquema. |
| `catalog_manager` | **Parcial** | Lectura/actualización de producto no publicado y denegación de inventario/CRM probadas; faltan las otras tablas y acciones de catálogo. |
| Grants directos de tabla/columna y ACL de RPC sensibles | **Parcial** | ACLs protegidas y cuatro RPC server-only probadas; no se enumeró cada columna/función pública ni cada rol de aplicación contra cada RPC. |
| Claims falsificados, autoescalada y nombres inexistentes | **Completa para este límite** | Claims no conceden autoridad; self-grant rechazado; enum cerrado y RPC de grant ausente. |
| Fixtures aisladas | **Completa** | Los dos scripts hacen rollback y comprueban ausencia de filas de prueba. |
| HTTP GoTrue → JWT firmado → PostgREST | **Bloqueada para este gate** | No se ejercitó la capa HTTP ni emisión/verificación de tokens; los SQL gates simulan los claims y roles que PostgREST entrega a PostgreSQL. Requiere un harness Auth/PostgREST dedicado antes de declarar la frontera HTTP completa. |

## Comandos y resultados

Ejecutados contra el contenedor local `supabase_db_nodria-commerce`, sin resetear ni modificar datos persistentes:

```powershell
Get-Content tests/integration/rbac/postgres-role-action-matrix.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests/integration/auth-boundaries/postgres-role-escalation.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests/integration/postgres-rls.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests/integration/security/postgres-object-isolation.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content tests/integration/support-rma/postgres.sql -Raw | docker exec -i supabase_db_nodria-commerce psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Los cinco comandos terminaron con código 0; los dos tests nuevos imprimieron `role/action RBAC matrix passed` y `auth role-escalation boundary passed`. Los tres gates previos (`postgres-rls`, `postgres-object-isolation`, `support-rma`) también pasaron sin cambios en sus archivos. Typecheck, lint y Vitest no se ejecutaron porque el cambio solo añade SQL runtime y documentación.

## Decisiones, riesgos y siguientes pasos

- Sin cambios de contrato de base de datos ni migraciones; las pruebas documentan el comportamiento efectivo actual.
- Mantener el deny de edición directa de organizaciones hasta que Tech Lead aclare la policy inalcanzable; no otorgar UPDATE por inferencia.
- Ampliar CRUD de catálogo y pruebas de permisos por columna/RPC en una iteración posterior.
- Añadir test HTTP contra PostgREST con usuarios emitidos por GoTrue, especialmente para verificar que las claims firmadas y el rol SQL se enlazan como en producción.
- Commit: pendiente de integración por Tech Lead.
