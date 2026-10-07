# Revisión independiente de seguridad y RLS

> **Baseline superseded (2026-10-07):** auditoría estática anterior a la segunda ola. No refleja el segundo migration ni la prueba runtime local. Hallazgos BO-01 a BO-03 y el acceso demo BO-05 recibieron fixes; consultar `SECURITY.md`, `BACKOFFICE_REVIEW.md` y `AGENT_HANDOFF.md`. Los flujos conectados/endpoints y la matriz exhaustiva siguen abiertos.

**Fecha:** 2026-10-07
**Alcance:** migración, grants, RLS, funciones y RPC, acceso anónimo/autenticado, membresías B2B, roles de personal, `proxy.ts` y rutas de lectura/escritura existentes.
**Tipo:** auditoría estática de solo lectura; no se implementaron correcciones.

## Resumen

La migración aplica RLS a las 27 tablas de `public`, revoca primero el acceso de `anon` y `authenticated` y luego concede privilegios por tabla. El acceso anónimo queda limitado principalmente a leer catálogo publicado y enviar leads/solicitudes; la lectura de pedidos está condicionada al propietario o a roles internos. Las funciones `SECURITY DEFINER` revisadas usan `search_path = ''`; el checkout expuesto es un wrapper `SECURITY INVOKER` y su implementación privada comprueba `auth.uid()` y que el carrito activo pertenezca a ese usuario.

Hallazgos principales:

1. **P2 — el portal de operaciones no exige sesión y revela filas del checkout demo**, incluidos nombre y correo. El riesgo depende de que una instalación compartida tenga registros en `.data/orders.json`.
2. **P2 — grants y policies permiten escribir inventario y transacciones de pago directamente desde Data API** a determinados roles, aunque la migración declara esas escrituras server-side. Puede desincronizar stock/reservas o el estado de pago/pedido.
3. **P2 — las policies de devoluciones permiten reclamar repetidamente las mismas unidades** mediante solicitudes separadas.
4. **P2 — `sales_manager` puede añadir o quitar membresías en cualquier organización**, incluida la asignación de `owner`, sin una condición de organización o invitación en esa rama de policy.
5. **P3 — el endpoint anónimo de leads permite falsificar el origen y la fecha de creación** porque el grant permite insertar todas las columnas.

Las rutas de solicitudes B2B, soporte y checkout siguen usando persistencia local o responden `503` al configurarse Supabase; no se encontró en la aplicación una llamada a `place_order` ni escrituras Supabase para esos flujos. Por tanto, las policies SQL describen capacidades futuras que todavía no están ejercitadas desde la UI/API existente.

## Hallazgos

### F-01 · P2 — `/backoffice` sirve pedidos demo sin autorización

**Evidencia:** `app/backoffice/page.tsx:18-53` llama `getDemoOrderRecords()` sin validar usuario, sesión ni rol y entrega los registros a la vista. `lib/server/demo-orders.ts:14,23-55` guarda y lee `customer.name`, `email`, `phone`, dirección, código postal, ciudad y provincia desde `.data/orders.json`. El endpoint público `app/api/checkout/route.ts:42-106` acepta esos campos sin sesión cuando `NODE_ENV !== "production"` y persiste el pedido. La tabla del portal presenta nombre y correo del cliente (`components/backoffice/operations-center.tsx:336-341`). La etiqueta “ENTORNO DEMO” informa del carácter demo, pero no restringe el acceso.

**Impacto:** en una instalación de desarrollo/demo accesible a terceros, cualquiera puede consultar referencias, importes, estados, nombres y correos de todos los pedidos guardados. El almacenamiento local también admite teléfonos y direcciones, aunque esta vista no los muestra en la tabla. La ruta no tiene una guarda de producción; la posibilidad de que haya un archivo persistente en un despliegue depende del host y de su ciclo de vida de archivos.

**Reproducción recomendada:** en un entorno aislado, enviar un `POST /api/checkout` anónimo con datos ficticios; después solicitar `GET /backoffice` sin cookies y comprobar que la fila del cliente aparece. Repetir con una sesión de cliente no privilegiada si se añade Auth.

**Remediación:** requerir una sesión autenticada y un rol de personal autorizado antes de leer registros; comprobarlo en servidor para cada petición. En demos públicas, usar exclusivamente fixtures no sensibles y datos sintéticos, o aislar el portal tras una protección de demo. No persistir datos de contacto arbitrarios en una demo compartida.

### F-02 · P2 — escritura directa de inventario puede romper el libro de reservas

**Evidencia:** el comentario de grants en `supabase/migrations/20261007073027_nodria_commerce_foundation.sql:1225` declara que las escrituras de stock son server-side. Sin embargo, `inventory_staff_only` permite `FOR ALL` a `fulfillment_manager` y `super_admin` (líneas 1029-1031), y el grant concede `SELECT, INSERT, UPDATE, DELETE` sobre `warehouses` e `inventory` a `authenticated` (línea 1243). La tabla `inventory_reservations` guarda el detalle por pedido; `private.place_order` actualiza `inventory.reserved` y añade filas de reserva en una transacción (líneas 650-832). No hay una constraint/trigger que haga coincidir el total de reservas activas con `inventory.reserved`.

**Impacto:** un usuario autenticado con `fulfillment_manager` puede modificar `reserved` o `on_hand` directamente por Data API sin crear, liberar o conciliar `inventory_reservations`. La constraint local `reserved <= on_hand` evita algunos estados inválidos, pero no mantiene ese libro de reservas sincronizado ni obliga a usar una transición de inventario.

**Reproducción recomendada:** crear una sesión de prueba con `fulfillment_manager`; actualizar una fila de `inventory` mediante REST alterando `reserved` sin insertar/eliminar la reserva correspondiente; comparar `inventory.reserved` con las sumas de `inventory_reservations`.

**Remediación:** revocar DML directo de los roles autenticados sobre `inventory` (y revisar si también corresponde sobre `warehouses`); exponer operaciones server-side acotadas para recepción, ajuste, reserva y liberación. Cada operación debe registrar actor/motivo y actualizar cantidades y ledger en una única transacción.

### F-03 · P2 — Data API permite editar estados e importes de pagos

**Evidencia:** el comentario de grants declara escrituras de pagos server-side (migración línea 1225), pero `payments_staff_only` permite `FOR ALL` a `fulfillment_manager`, `sales_manager` y `super_admin` (líneas 1093-1095), y la línea 1248 concede `SELECT, INSERT, UPDATE, DELETE` en `payment_transactions` a `authenticated`. La tabla contiene estado, importe, moneda y proveedor (líneas 251-264); el trigger de auditoría registra columnas cambiadas, pero no impide ni valida el cambio (líneas 886-897 y función `private.audit_row_change`). No se encontró una ruta de webhook o conciliación conectada en la aplicación.

**Impacto:** esos roles pueden insertar, cambiar o borrar directamente filas de pago, incluidos estado e importe, sin una verificación de proveedor ni una transición correspondiente de `orders`. Puede dejar el pedido y el intento de pago en estados inconsistentes o presentar como pagado un intento que no se verificó. Es estado de demostración hoy; no hay proveedor de pago real configurado.

**Reproducción recomendada:** con un usuario de prueba de cada rol listado, intentar insertar/actualizar/eliminar una transacción por REST; confirmar que una actualización de `status`/`amount` no requiere una transición de pedido ni una señal externa.

**Remediación:** dejar lectura según rol y revocar DML directo. Canalizar conciliación/cambio de estado por un handler server-side o RPC estrecho que valide el evento, aplique idempotencia, cambie el pedido y el pago atómicamente y deje auditoría suficiente. Mantener una separación clara entre pagos ficticios y eventos verificados.

### F-04 · P2 — una misma línea de pedido puede reclamarse en varias devoluciones

**Evidencia:** `return_requests` no tiene unicidad por pedido ni una condición que excluya solicitudes activas anteriores (`supabase/migrations/20261007073027_nodria_commerce_foundation.sql:383-395`). La policy `return_requests_insert_owner` (1193-1198) permite a un propietario crear otra solicitud para un pedido entregado dentro de la ventana comprobada. `return_items` solo impone unicidad dentro de cada solicitud (`unique (return_request_id, order_item_id)`, línea 404); su policy comprueba `quantity <= oi.quantity` para esa solicitud (1209-1215), pero no suma cantidades de otras solicitudes. Los grants permiten `INSERT` a `authenticated` en ambas tablas (1257-1258).

**Impacto:** el propietario puede crear dos solicitudes para el mismo pedido y reclamar en cada una hasta la cantidad total comprada de una línea. Si el personal procesa ambas, el total de unidades aprobadas puede exceder lo comprado.

**Reproducción recomendada:** con un pedido de prueba entregado, crear dos `return_requests` válidas para el mismo pedido y añadir en ambas el mismo `order_item_id` con `quantity` igual a la cantidad comprada. Comprobar si las dos inserciones pasan y si el flujo de aprobación detecta el exceso acumulado.

**Remediación:** centralizar el alta en una transacción que bloquee la línea/pedido y reste lo ya solicitado/aprobado de la cantidad elegible; impedir más de una solicitud activa por pedido si ese es el contrato. Definir si la ventana se mide desde `placed_at` o desde la entrega y persistir/verificar la fecha de entrega.

### F-05 · P2 — `sales_manager` puede asignar membresías en cualquier organización

**Evidencia:** `organization_memberships_insert_owner_or_admin` permite la creación por administrador de organización, pero contiene una rama independiente `private.has_any_staff_role(['super_admin', 'sales_manager'])` sin vincular el `organization_id`, `user_id`, `role` ni `added_by` a la organización o al actor (líneas 956-961). La policy de borrado contiene otra rama para `super_admin` y `sales_manager` sin condición de organización ni de `role` (líneas 963-969). `authenticated` tiene `INSERT` y `DELETE` sobre la tabla (línea 1240). Las policies de organización y presupuestos conceden acceso por membresía (940-952, 1102-1122).

**Impacto:** cualquier cuenta con rol `sales_manager` puede insertar un usuario como `owner`, `admin`, `buyer` o `viewer` en cualquier organización, incluso con `added_by` distinto del actor; también puede borrar cualquier membresía, incluida la de `owner`. El usuario añadido adquiere el acceso B2B que esas policies asocian a la organización. Puede ser una capacidad administrativa deliberada, pero no está delimitada en el contrato revisado y excede el flujo de alta por `owner/admin` descrito por la policy.

**Reproducción recomendada:** probar con un `sales_manager` sobre una organización ajena: insertar membresía de otro usuario como `owner` con `added_by` arbitrario; comprobar el acceso resultante a organización/presupuestos. Probar también el borrado de una membresía `owner`.

**Remediación:** si ventas no debe administrar membresías globales, quitar `sales_manager` de esas ramas y conservar `super_admin`; si necesita invitar usuarios, usar una operación específica que acote organización, rol asignable, identidad del actor y estado de invitación/aceptación.

### F-06 · P3 — inserción pública de `crm_leads` permite falsificar `source` y `created_at`

**Evidencia:** `crm_leads` define `source` con default `website` y `created_at` con default `now()` (líneas 319-329), pero el grant permite `INSERT` sobre toda la tabla a `anon` y `authenticated` (línea 1251). La policy pública solo exige `submitted_by IS NULL` y `consent_to_contact = true` (1136-1137); no limita `source` ni `created_at`. A diferencia de esto, `quote_inquiries` usa un grant de inserción por columnas (línea 1253).

**Impacto:** una llamada REST anónima puede atribuir un lead a una fuente inventada o fijar una fecha arbitraria, contaminando la atribución y las consultas cronológicas del CRM. La policy tampoco puede probar que el consentimiento booleano corresponda al consentimiento realmente mostrado; esto requiere trazabilidad de captura fuera de RLS.

**Reproducción recomendada:** enviar un `POST /rest/v1/crm_leads` con consentimiento verdadero, `source` elegido por el cliente y `created_at` pasado/futuro; comprobar si se guarda con esos valores.

**Remediación:** conceder inserción solo sobre campos de contacto y mensaje; dejar `source` y marcas temporales al servidor/trigger. Si se conserva más de una fuente pública, definir una lista permitida y asignarla desde una ruta confiable.

## Persistencia, autorización de rutas y UX

- `proxy.ts:4-22` refresca/lee claims mediante `getClaims()`, pero no autoriza rutas. Esto es válido como proxy de sesión, pero no protege por sí solo `/backoffice`; esa comprobación debe estar en la página/caso de uso server-side.
- `/mi-cuenta` llama `auth.getUser()` y redirige cuando el cliente Supabase está configurado (`app/(store)/mi-cuenta/page.tsx:18-30`). La lectura de `orders` debe continuar dependiendo de la policy por `customer_id`; el código consulta solo las columnas necesarias. El nombre tomado de `user_metadata` se usa para presentación, no para permisos.
- `/api/checkout` es solo demo local y no ejecuta `public.place_order` (`app/api/checkout/route.ts:31-43,85-106`). Lee precio/stock de fixtures y guarda archivo local; con Supabase configurado, el flujo normal devuelve `503` salvo modo demo no productivo explícito.
- `/api/quotes` y `/api/support` aceptan únicamente modo demo sin credenciales y escriben a `.data/`; si hay credenciales Supabase devuelven `503` (`app/api/quotes/route.ts:20-25`, `app/api/support/route.ts:17-22`). No llaman a `quote_inquiries`, `support_tickets` ni a un caso de uso conectado. La UI presenta formularios de solicitud/soporte, así que la persistencia efectiva es demo local o error visible, no Supabase.
- El límite de intentos de esas rutas es un `Map` en memoria de proceso (`lib/server/rate-limit.ts`). Las claves se derivan de `x-forwarded-for` (`app/api/quotes/route.ts:24`, `app/api/support/route.ts:21`, `app/api/checkout/route.ts:26-27`). Esto solo sirve como freno local: reinicios/instancias distintas no comparten estado y no se debe tratar como defensa de abuso en un despliegue multi-instancia. La confianza en esa cabecera depende de que el proxy de despliegue elimine/reconstruya valores enviados por el cliente.

## Cobertura de base de datos observada en archivos

- **Tablas/RLS:** se habilita RLS para todas las 27 tablas de `public` creadas por esta migración (`supabase/migrations/20261007073027_nodria_commerce_foundation.sql:900-927`). La migración hace `REVOKE ALL` de `anon` y `authenticated` antes de los grants explícitos (1225-1239). No se encontraron vistas SQL ni buckets/policies de Storage en la migración revisada.
- **Anónimo:** tiene lectura de catálogo; inserción en `crm_leads`; inserción de columnas limitadas en `quote_inquiries`. La llamada anónima a `public.place_order` se revoca; su `EXECUTE` se concede solo a `authenticated` (850-851). No se encontraron grants anónimos sobre pedidos, perfiles, carrito, inventario, pagos o tickets.
- **Autenticado/cliente B2B:** carrito y sus líneas se restringen al dueño; pedidos/eventos/líneas se leen por propietario o roles internos; presupuestos se limitan a solicitante/miembros de organización/ventas; los tickets requieren que `customer_id = auth.uid()` y un pedido opcional propio. La amplitud específica de membresías, pagos, inventario y devoluciones se detalla en F-02 a F-05.
- **Roles de personal:** `private.has_any_staff_role()` consulta `user_role_grants` usando `auth.uid()`; no hay grants de escritura para que el cliente se asigne roles. Catálogo, logística, soporte, ventas y `super_admin` se diferencian en sus policies.
- **RPC y funciones:** `public.place_order` es la única función de aplicación expuesta que se encontró en la migración; es `SECURITY INVOKER`. Su ayudante `private.place_order` es `SECURITY DEFINER`, revoca `PUBLIC`, concede ejecución a `authenticated`, valida identidad/carrito y efectúa reserva y snapshots en una transacción. Las funciones definer revisadas de roles/organizaciones, creación de perfil y auditoría usan `search_path = ''` y están en `private`; `supabase/config.toml` expone `public` y `graphql_public`, no `private`. No se encontró uso de service-role key ni RPC Supabase en el código de la app.
- **Auth y claves:** los clientes browser/server y `proxy.ts` usan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; no se encontró una service-role key en las rutas revisadas. El `signup` permite `full_name` editable en `user_metadata`, pero esa metadata solo alimenta el nombre visible de la cuenta.

## Límites y comprobaciones ejecutadas

El repositorio declara que no hay credenciales ni conexión Supabase confirmada (`docs/STATUS.md:10`). En este worktree tampoco existen `.env` ni `.env.local`; solo `.env.example`. No se pudo comprobar el estado desplegado de Data API, los grants efectivos de PostgreSQL, el esquema realmente aplicado, usuarios/roles de Auth, claims JWT, RLS bajo cada rol ni las reglas de Storage.

Comprobaciones realmente ejecutadas:

- Lectura de `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `STATUS.md`, `WORKSTREAMS.md`, `AGENT_HANDOFF.md`, `docs/database.md` y reglas locales.
- `git status --short --branch`: HEAD detached y worktree ya tenía numerosos cambios no confirmados antes de crear este informe; no se creó commit. La migración auditada aparece como archivo nuevo/no confirmado en el estado de Git.
- Búsquedas estáticas (`rg`) y lectura de migración, grants/policies, seed/config, clientes Supabase, proxy, rutas y pantallas referidas en el informe.
- `Get-Command supabase`: CLI no instalado. `docker info`: no pudo conectar con Docker Desktop; no se pudo arrancar/probar una instancia local.
- **No** se aplicó la migración, no se hicieron peticiones HTTP/REST a una aplicación/Supabase, no se probaron JWT/roles, y no se ejecutaron lint, typecheck ni tests. Lint/typecheck no aplican a esta revisión read-only; los checks de autorización requieren un proyecto local o remoto de prueba.

## Riesgos no verificados y próximos checks

1. Antes de integrar o desplegar, ejecutar `supabase db reset` en un entorno aislado y probar F-02 a F-06 con usuarios `anon`, cliente normal, `sales_manager`, `fulfillment_manager`, `support_agent` y `super_admin`; incluir dos usuarios y dos organizaciones para detectar BOLA/IDOR entre tenants.
2. Confirmar en el proyecto real los grants efectivos, políticas adicionales creadas desde Dashboard y esquemas habilitados en Data API. `supabase/config.toml` deja comentado `auto_expose_new_tables`; el propio comentario indica que proyectos nuevos pueden exponer tablas nuevas por defecto. Fijar una política explícita y verificar RLS/grants para cualquier tabla añadida después.
3. Revisar Auth de cada entorno por separado. El config local habilita signup, desactiva confirmación de email y permite contraseña mínima de seis caracteres (`supabase/config.toml:177-183,222-227`); no demuestra la configuración remota de producción. Alinearla con la política de cuenta del despliegue.
4. Completar pruebas de integración de checkout idempotente, reserva concurrente de stock, separación B2B, visibilidad de mensajes internos, solicitudes repetidas de devolución y autorización del backoffice. Confirmar que cada formulario cambia a persistencia Supabase antes de presentarlo como conectado.

**Artefactos/decisiones/contratos modificados:** solo se creó `docs/SECURITY_REVIEW.md`. Sin cambios a código, migraciones, tests, decisiones globales ni contratos SQL. Sin commit. La migración y contratos aún requieren revisión del owner de base de datos antes de considerarse aplicados o verificados.
