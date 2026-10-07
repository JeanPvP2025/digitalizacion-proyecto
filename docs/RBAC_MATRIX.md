# Matriz de roles y permisos

Estado al 2026-10-07. La autorización efectiva combina sesión Auth, `user_role_grants`, `organization_memberships`, grants SQL, RLS y validaciones de RPC. Ocultar una acción en UI no concede ni deniega acceso.

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
| Stock/reservas/fulfillment | — | — | — | — | — | — | R; cambios mediante RPC de fulfillment/service-role | R de catálogo, sin mutación de stock | R y RPC según acción |
| Tickets y mensajes | — | C por RPC; R/mensaje propio permitido | Propio/org | Propio/org | R/U y respuesta permitida; sin acceso indiscriminado | — | — | — | R/U según acción |
| Devoluciones/RMA | — | C por RPC; R propia | Propia/org | Propia/org | R/U operativa de soporte | — | R/U por RPC operativa | — | R/U según acción |
| Auditoría/timeline | — | R de timeline propio permitido | Propio/org | Propio/org | R de caso autorizado | Actividad interna comercial autorizada | Eventos de pedidos operativos | — | R |

Las celdas “—” significan sin permiso por el contrato actual. Esta matriz es conservadora: antes de ampliar un permiso se debe documentar campo/acción y añadir una prueba runtime.

## Evidencia y cobertura

- Ejecutados en PostgreSQL local: `tests/integration/postgres-rls.sql`, `tests/integration/security/postgres-object-isolation.sql`, `tests/integration/support-rma/postgres.sql`, `tests/database/*.sql` y `tests/integration/commerce/checkout-flow.sql`.
- Cubre `anon`, customer A/B, business buyer/admin, `support_agent`, `sales_manager`, `fulfillment_manager` y `super_admin`; prueba aislamiento por cliente/organización, membresías, presupuestos, notas CRM, pagos, soporte, devoluciones, pedido/stock e intentos de escalada.
- `catalog_manager` tiene policies de CRUD catalogadas, pero no un recorrido runtime completo. No existen roles `marketing` ni `manager` genérico; sus pruebas son por ausencia de enumeración/grant, no por usuario con un rol inventado.
- No se ha ejecutado CRUD exhaustivo en cada columna/tabla, una matriz con JWT emitidos por GoTrue/PostgREST, ni pruebas HTTP de cada Server Action. El gate es fuerte para escenarios seleccionados y no constituye certificación de producción.
