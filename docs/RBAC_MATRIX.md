# Matriz de roles y permisos

Estado al 2026-10-07 tras la quinta ola. La autorización efectiva combina sesión Auth, `user_role_grants`, `organization_memberships`, grants SQL, RLS y validaciones de RPC. Ocultar una acción en UI no concede ni deniega acceso.

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
| Pedidos y líneas | — | R propio | R propio | R de pedidos de su org cuando está asociado | R mínimo necesario por política/soporte | — | R operativa | — | R |
| Pagos | — | R de pago propio | R propio | R de pedidos de su org | R mínimo de contexto permitido | — | R operativo | — | R |
| Crear pedido / checkout | — | C por RPC autenticada; precios y stock servidor | Igual, vinculado a org miembro | Igual | — | — | — | — | Solo por flujo/autorización explícita |
| Stock/reservas/fulfillment | — | — | — | — | — | — | R; recepción/ajuste por RPC idempotente; fulfillment consume reserva por RPC | R de catálogo, sin mutación de stock | R y RPC según acción |
| Procurement | — | — | — | — | — | — | R de proveedores/PO/recepciones; CRUD de proveedor, borrador/estado de PO y recepción por RPC | — | R y RPCs de procurement según acción |
| Tickets y mensajes | — | C por RPC; R/mensaje propio permitido | Propio/org | Propio/org | R/U y respuesta por RPC; DML directo revocado | — | — | — | R/U por RPC según acción |
| Devoluciones/RMA | — | C por RPC; R propia | Propia/org | Propia/org | R/U operativa de soporte | — | R/U por RPC operativa | — | R/U según acción |
| Auditoría/timeline | — | R de timeline propio permitido | Propio/org | Propio/org | R de caso autorizado | Actividad interna comercial autorizada | Eventos de pedidos operativos | — | R |

Las celdas “—” significan sin permiso por el contrato actual. Para movimientos manuales, `receive_inventory` y `adjust_inventory` permiten solo `fulfillment_manager`/`super_admin`; Postgres valida rol, fingerprint y saldo reservado aun cuando se invoque la RPC fuera de la UI. Estas acciones actualizan `on_hand`, no `reserved`. Esta matriz es conservadora: antes de ampliar un permiso se debe documentar campo/acción y añadir una prueba runtime.

## Evidencia y cobertura

- Ejecutados en PostgreSQL local: `tests/integration/postgres-rls.sql`, `security/postgres-object-isolation.sql`, `rbac/postgres-role-action-matrix.sql`, `auth-boundaries/postgres-role-escalation.sql`, `support-rma/postgres.sql`, `support-flow/postgres.sql`, `inventory/inventory-movements.sql`, `reviews/product-reviews.sql`, `tests/database/*.sql` y `commerce/checkout-flow.sql`.
- La prueba `tests/integration/procurement/procurement.sql` verifica RPCs y RLS: fulfillment opera, sales y buyer no leen las tablas procurement, no hay DML directo de navegador, y los movimientos recibidos quedan enlazados a la orden.
- Además, `pwsh -File tests/integration/auth-boundaries/run-local.ps1` ejercita 78 requests con access JWT de GoTrue en PostgREST; 0 fallos. Cubre `anon`, customer A/B, business admin/buyer, `catalog_manager`, `support_agent`, `sales_manager`, `fulfillment_manager` y `super_admin` para salud, filas propias/tenant, roles persistidos, escalation y RPCs restringidas.
- La matriz SQL y HTTP prueba aislamiento cliente/organización, grants, acciones de catálogo, soporte, CRM/pagos, inventario, devoluciones, checkout y escalada.
- La matriz inicial se corrigió al detectar que el RPC, no el DML directo, es el contrato para transición de ticket. No se añadió permiso directo.
- No existen roles persistidos `marketing` ni `manager` genérico; sus pruebas son por ausencia de enum/grant, no por usuario con un rol inventado.
- No se ha ejecutado CRUD exhaustivo en cada columna/tabla, ni pruebas HTTP de cada Server Action. Roles `marketing` y `manager` genérico no existen como grants persistidos y aún no tienen usuarios/probes dedicados. El gate cubre escenarios seleccionados y no constituye certificación de producción.
