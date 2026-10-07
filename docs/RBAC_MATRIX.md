# Matriz de roles y permisos

Estado al 2026-10-07 tras la sexta ola y los cierres integrados de RMA y B2B. La autorización efectiva combina sesión Auth, `user_role_grants`, `organization_memberships`, grants SQL, RLS y validaciones de RPC. Ocultar una acción en UI no concede ni deniega acceso.

## Nombres de rol

| Nombre solicitado o de interfaz | Representación persistida | Alcance |
|---|---|---|
| `customer` | usuario autenticado sin grant de personal | Sus propios datos y catálogo publicado |
| `business_user` | `organization_memberships.role = buyer` o `viewer` | Organización a la que pertenece; `viewer` no administra ni compra |
| `business_manager` | `organization_memberships.role = admin` o `owner` | Solo su organización; el owner conserva administración superior |
| `support` | `app_role = support_agent` | Tickets, mensajes públicos permitidos y devoluciones; sin inventario/CRM |
| `sales` | `app_role = sales_manager` | CRM comercial y cola de presupuestos sin asignar; sin pedidos/pagos/almacén |
| `warehouse` | `app_role = fulfillment_manager` | Pedidos operativos, inventario y fulfillment |
| `admin` / `superadmin` | `app_role = super_admin` | Operación interna transversal según cada RPC; no salta las validaciones de función |
| `catalog_manager` | `app_role = catalog_manager` | Gestión de catálogo y variantes |
| `marketing`, `manager` genérico | No existen en `app_role` | No reciben permisos por el nombre de UI; requieren definición y grant explícito |
| `anonymous` | rol SQL `anon` sin identidad Auth | Catálogo público y formularios de intake limitados; nada privado |

`app_role` solo contiene `catalog_manager`, `fulfillment_manager`, `support_agent`, `sales_manager` y `super_admin`. Los nombres de interfaz `business_user`/`business_manager` no son claims de autorización.

## Matriz efectiva por dominio

`R` lectura, `C` creación, `U` actualización y `D` eliminación. Una RPC indicada es el único camino permitido para esa transición; las escrituras directas permanecen revocadas. `Propio/org` significa filtrado por usuario o membresía RLS.

| Dominio | anon | customer | buyer/viewer | org admin/owner | support_agent | sales_manager | fulfillment_manager | catalog_manager | super_admin |
|---|---|---|---|---|---|---|---|---|---|
| Catálogo publicado | R | R | R | R | R | R | R | R/C/U/D | R/C/U/D |
| Perfil y grants | — | R/U propio limitado | R propio | R propio | R propio | R propio | R propio | R propio | R + administración interna autorizada |
| Organizaciones/membresías | — | R de su org | R de su org/miembros | R de su org; C/U/D de miembros por RPC con límites de rol | — | R de solicitud comercial necesaria; no lista organizaciones ni membresías | — | — | R; administración protegida |
| Carrito | — | R/C/U/D propio | R/C/U/D propio | R/C/U/D propio | — | — | — | — | R interno |
| Presupuestos B2B | — | C por RPC/intake público acotado | R/C de su org | R/C y respuesta en su org | — | R de cola solicitada sin asignar y presupuestos propios; reclamar/enviar por RPC; sin D | — | — | R y transiciones permitidas por RPC |
| CRM leads/inquiries | C acotada con consentimiento | — | — | — | — | R/U vía server action/RPC | — | — | R/U vía rutas autorizadas |
| Pedidos y líneas | — | R propio | R de pedidos de su organización; sin mutación | R de la organización; owner/admin emite desde quote aceptado por RPC | R mínimo necesario por política/soporte | — | R operativa | — | R |
| Pagos | — | R de pago propio | R de pago propio/org, sin transición | R de pago de su organización; owner/admin resuelve anticipo demo por RPC | R mínimo de contexto permitido | — | R operativo | — | R |
| Crear pedido / checkout | — | C por RPC autenticada; precios y stock servidor | Igual, vinculado a org miembro | Igual; owner/admin emite pedido B2B y resuelve anticipo demo idempotente por RPC | — | — | — | — | Solo por flujo/autorización explícita |
| Stock/reservas/fulfillment | — | — | — | — | — | — | R; recepción/ajuste por RPC idempotente; fulfillment consume reserva por RPC | R de catálogo, sin mutación de stock | R y RPC según acción |
| Procurement | — | — | — | — | — | — | R de proveedores/PO/recepciones; CRUD de proveedor, borrador/estado de PO y recepción por RPC | — | R y RPCs de procurement según acción |
| Tickets y mensajes | — | C por RPC; R/mensaje propio permitido | Propio/org | Propio/org | R/U y respuesta por RPC; DML directo revocado | — | — | — | R/U por RPC según acción |
| Devoluciones/RMA y reembolsos | — | C por RPC; R propias y reembolso propio | C por RPC si es titular; R propia | C por RPC si es titular; R propia | R/U de revisión por RPC; R de reembolso autorizado | — | R operativa, R de reembolso, inspección/restock/desecho por RPC; cierre tras todas las líneas | — | R/U según acción por RPC |
| Auditoría/timeline | — | R de timeline propio permitido | Propio/org | Propio/org | R de caso autorizado | Actividad interna comercial autorizada | Eventos de pedidos operativos | — | R |

Las celdas “—” significan sin permiso por el contrato actual. Para movimientos manuales, `receive_inventory` y `adjust_inventory` permiten solo `fulfillment_manager`/`super_admin`; Postgres valida rol, fingerprint y saldo reservado aun cuando se invoque la RPC fuera de la UI. Procurement sigue el mismo límite interno. Fulfillment requiere el rol de almacén/superadmin y consume una reserva solo al expedir. Owner/admin B2B puede emitir un pedido aceptado y resolver su anticipo demo por RPC tenant-scoped; buyer/viewer no. La matriz CRUD sigue siendo conservadora y debe ampliarse con pruebas por endpoint antes de conceder permisos.

La tabla `return_refunds` solo concede lectura RLS al propietario de la devolución y a `support_agent`, `fulfillment_manager` y `super_admin`; `authenticated` no recibe escritura directa. La revisión solo acepta `support_agent`/`super_admin` vía RPC. Aprobar requiere pago demo confirmado y pone unidades en inspección pendiente, pero no da permiso para mutar stock. `inspect_return_item` solo acepta `fulfillment_manager`/`super_admin`; exige la cantidad aprobada completa y almacén activo, actualiza stock únicamente en reposición, registra desecho sin aumentar stock, y cierra el RMA tras disponer todas las líneas. DML directo a `return_items` continúa revocado. Para B2B, la transición de pago la ofrece `resolve_business_order_demo_payment` solo a owner/admin del tenant; buyers/viewers no pueden resolverla y el rechazo libera la reserva.

## Evidencia y cobertura

- Ejecutados en PostgreSQL local: `tests/integration/postgres-rls.sql`, `security/postgres-object-isolation.sql`, `rbac/postgres-role-action-matrix.sql`, `auth-boundaries/postgres-role-escalation.sql`, `support-rma/postgres.sql`, `support-flow/postgres.sql`, `inventory/inventory-movements.sql`, `reviews/product-reviews.sql`, `tests/database/*.sql` y `commerce/checkout-flow.sql`.
- La prueba `tests/integration/procurement/procurement.sql` verifica RPCs y RLS: fulfillment opera, sales y buyer no leen las tablas procurement, no hay DML directo de navegador, y los movimientos recibidos quedan enlazados a la orden.
- Además, `pwsh -File tests/integration/auth-boundaries/run-local.ps1` ejercita 78 requests con access JWT de GoTrue en PostgREST; 0 fallos. Cubre `anon`, customer A/B, business admin/buyer, `catalog_manager`, `support_agent`, `sales_manager`, `fulfillment_manager` y `super_admin` para salud, filas propias/tenant, roles persistidos, escalation y RPCs restringidas.
- La matriz SQL y HTTP prueba aislamiento cliente/organización, grants, acciones de catálogo, soporte, CRM/pagos, inventario, procurement, devolución, checkout, pedido B2B y escalada.
- `tests/integration/support-flow/return-inspection.sql` prueba que support/cliente no inspeccionan, warehouse no puede alterar cantidades, repetición idéntica se reproduce, payload diferente y segunda disposición se rechazan, y stock/timeline/cierre se mantienen coherentes.
- `create_business_order_from_accepted_quote` solo admite owner/admin; `orders`, `order_items`, `order_events`, pagos y `business_quote_orders` se leen por membresía de organización o por los roles internos ya permitidos. `tests/database/crm_b2b.sql` verifica buyer/viewer lectura, bloqueo de emisión para esos roles y aislamiento tenant B.
- `resolve_business_order_demo_payment` exige owner/admin de la misma organización. El runner B2B aislado valida que buyer no puede liquidar, aprobado/rechazado quedan en el tenant y el retry/payload distinto no duplica el pago o la actividad.
- La matriz inicial se corrigió al detectar que el RPC, no el DML directo, es el contrato para transición de ticket. No se añadió permiso directo.
- No existen roles persistidos `marketing` ni `manager` genérico; sus pruebas son por ausencia de enum/grant, no por usuario con un rol inventado.
- No se ha ejecutado CRUD exhaustivo en cada columna/tabla, ni pruebas HTTP de cada Server Action. Roles `marketing` y `manager` genérico no existen como grants persistidos y no deben recibir acceso implícito. El gate cubre escenarios seleccionados y no constituye certificación de producción.
