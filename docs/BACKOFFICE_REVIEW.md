# Revisión independiente de CRM, inventario y operaciones

> **Actualización de integración (2026-10-07):** el informe siguiente es un snapshot estático del HEAD `68bb12a`. Ola 2 revocó las escrituras directas y protegió el backoffice demo; el gate PostgreSQL confirma el aislamiento de pedidos frente a `sales_manager`. El hallazgo BO-01 está corregido y cubierto. BO-02/03/05 también tienen correcciones de grants/data-mode. BO-04 (descriptores de variantes ocultos a fulfillment) y BO-06 (error al leer JSON demo dañado) continúan abiertos. La cobertura actual se detalla en `SECURITY.md`.

**Fecha:** 2026-10-07<br>
**Alcance:** sesión y roles; consultas CRM/inventario/operaciones; contratos de estado; grants y RLS; estados vacíos/errores; separación Supabase/demo.<br>
**Método:** revisión estática de código, migración, seed y tres informes existentes. No se modificaron código, SQL, tests ni documentos ajenos.<br>
**Git:** rama `master`, HEAD `68bb12a`; checkout ya tenía cambios y archivos no rastreados antes de esta revisión. No se creó commit.

## Dictamen

El CRM consulta datos de Supabase y revalida sesión/rol tanto al cargar como al cambiar etapas. Su estado `prospect_status` coincide con la migración y presenta errores y vacíos explícitos. La actividad visible es una derivación de leads/solicitudes recibidos; no es un historial de acciones.

Inventario comprueba sesión y `fulfillment_manager`/`super_admin`; la lectura de `inventory` y `warehouses` coincide con sus grants y RLS. Sin embargo, las mismas superficies autorizan DML directo a esos roles pese a que la UI se declara de solo lectura. Además, los datos descriptivos de variantes/productos pueden quedar ocultos por RLS.

El centro de operaciones está protegido actualmente por sesión y rol, pero sus pedidos y stock siguen siendo locales de demo. La ruta no carga operaciones desde PostgreSQL. **No marcar CRM, inventario ni operaciones como `Done`**: RLS de pedidos, mutación directa de inventario, aislamiento del modo local y runtime PostgreSQL siguen abiertos.

## Hallazgos priorizados

### BO-01 · P1 — `sales_manager` puede leer pedidos, líneas y eventos por Data API

**Evidencia:** la aplicación sí separa la ruta: [app/backoffice/layout.tsx](../app/backoffice/layout.tsx:7) admite `sales_manager` para que pueda entrar al CRM, mientras [app/backoffice/page.tsx](../app/backoffice/page.tsx:24) devuelve acceso restringido salvo `fulfillment_manager` o `super_admin`. Pero `orders_read_owner_or_staff` permite `sales_manager` en la policy de `orders` (`supabase/migrations/20261007073027_nodria_commerce_foundation.sql:1069-1075`); las policies equivalentes de `order_events` y `order_items` también lo incluyen (`1077-1087`). Los grants conceden `SELECT` a `authenticated` sobre pedidos y líneas (`1247-1248`).

**Impacto:** el control de la página no impide que un usuario con JWT `sales_manager` consulte directamente `/rest/v1/orders`, `/rest/v1/order_items` y `/rest/v1/order_events`. La política expone pedidos ajenos y sus datos operativos aunque el centro de operaciones de Next.js rechace ese rol. Esto contradice el contrato explícito de acceso de la ruta.

**Reproducción estática:** con una sesión de prueba que tenga solo `sales_manager`, hacer `GET /rest/v1/orders?select=id,order_number,customer_id,status`; repetir con líneas y eventos. La política resulta verdadera por rol. No se ejecutó la reproducción contra PostgreSQL porque no hay Supabase CLI, servicio local ni credenciales en este checkout.

**Recomendación:** retirar `sales_manager` de las policies de lectura de pedidos, líneas y eventos; mantener únicamente los roles que el contrato de operaciones/soporte necesite. Añadir pruebas RLS que verifiquen lectura denegada para `sales_manager` y permitida para los roles autorizados.

**Owner propuesto:** Database Agent para SQL; QA Agent para tests de separación; Tech Lead para confirmar el contrato de roles.

### BO-02 · P2 — Inventario permite escrituras directas pese a ser una vista de solo lectura

**Evidencia:** [lib/inventory/index.ts](../lib/inventory/index.ts:62) autentica al usuario, lee sus grants y exige `fulfillment_manager` o `super_admin` antes de consultar `inventory` (`68-90`). En SQL, `inventory_staff_only` y `warehouses_staff_only` son `FOR ALL` para esos mismos roles (`1025-1032`), y los grants conceden `SELECT, INSERT, UPDATE, DELETE` sobre ambas tablas a todo `authenticated` (`1244`). La página muestra “SOLO LECTURA” y declara que no modifica stock ([app/backoffice/inventory/page.tsx](../app/backoffice/inventory/page.tsx:45-80)).

**Impacto:** RLS y grants autorizan a un `fulfillment_manager` a modificar `on_hand` o `reserved` por PostgREST sin pasar por la UI. Puede romper la correspondencia entre `inventory.reserved` y `inventory_reservations`; no existe una constraint que concilie ambos registros. El comentario “writes … server-side” de la migración (`1226`) contradice los privilegios efectivos que esta misma migración concede.

**Reproducción estática:** con usuario de prueba `fulfillment_manager`, intentar `PATCH /rest/v1/inventory` cambiando `reserved` sin alterar la reserva del pedido; comparar ambas cantidades. No se hizo llamada a una base real.

**Recomendación:** revocar DML de `authenticated` en `inventory` y revisar también `warehouses`; conservar las lecturas para fulfillment. Añadir escrituras solo mediante RPC/casos server-side acotados y transaccionales cuando exista el contrato de movimientos. La migración debe validar que la suma de reservas activas concuerde con `reserved`.

**Owner propuesto:** Database Agent; QA Agent para pruebas RLS/invariantes. El workstream de recepción/movimientos depende de este contrato.

### BO-03 · P2 — El rol comercial conserva privilegios globales de membresía y edición de pagos

**Evidencia:** `organization_memberships_insert_owner_or_admin` y `organization_memberships_delete_self_or_admin` tienen ramas globales para `sales_manager`, sin acotar organización, rol asignable o actor (`supabase/migrations/20261007073027_nodria_commerce_foundation.sql:956-969`); los grants incluyen `INSERT` y `DELETE` (`1241`). Además, `payments_staff_only` permite `FOR ALL` a `sales_manager` (`1093-1096`) y hay DML concedido en `payment_transactions` (`1249`).

**Impacto:** una cuenta comercial puede asignar a un usuario como `owner` de cualquier organización y borrar membresías ajenas. También puede escribir estados e importes de pagos por Data API. La primera capacidad amplía acceso B2B; la segunda puede dejar pagos y pedidos inconsistentes. El código de CRM no necesita ninguna de esas escrituras para leer oportunidades y actualizar etapas.

**Reproducción estática:** con usuario de prueba `sales_manager`, insertar una membresía `owner` en una organización ajena con `added_by` arbitrario, intentar borrar una membresía existente y hacer `PATCH` de estado/importe de un pago. La policy y grants actuales admiten esos roles; falta confirmación runtime.

**Recomendación:** eliminar `sales_manager` de las ramas globales de membership y pagos salvo que exista una decisión aprobada que defina el alcance. Si ventas debe invitar, exponer una operación acotada por organización, actor y roles permitidos. Restringir pagos a una transición de servidor/RPC aprobada.

**Owner propuesto:** Database Agent; Tech Lead para el límite de administración comercial.

### BO-04 · P2 — El lector de inventario puede perder la identidad de variantes no publicadas

**Evidencia:** tras leer las filas de inventario, [lib/inventory/index.ts](../lib/inventory/index.ts:101) busca `product_variants` y `products` para obtener SKU, título y marca (`101-129`). Pero `variants_read_published` solo deja ver variantes activas de productos publicados y `variants_read_staff` autoriza `catalog_manager`/`super_admin` (`1003-1012`); `products_read_staff` usa el mismo conjunto de roles (`981-989`). Un usuario que tenga solo `fulfillment_manager` puede leer la existencia y almacén, pero no siempre sus datos descriptivos.

**Impacto:** la tabla puede mostrar filas identificadas solo por UUID y no por SKU/producto. La UI lo reconoce mediante `variantDetailsLimited` y un aviso explícito ([app/backoffice/inventory/page.tsx](../app/backoffice/inventory/page.tsx:203-205)); es una limitación visible, no un error silencioso. Aun así, puede dificultar localizar stock de artículos retirados o no publicados.

**Reproducción estática:** mantener una fila de inventario para una variante inactiva o de producto no publicado y consultar con un usuario que tenga solo `fulfillment_manager`; la lectura base sigue disponible, mientras la consulta de catálogo queda filtrada por RLS.

**Recomendación:** acordar con el owner de catálogo qué campos de identidad puede leer fulfillment para todo artículo inventariado y aplicar una policy/grant de lectura mínima. No abrir los campos comerciales completos sin necesidad.

**Owner propuesto:** Database Agent para policy/grant; asignar owner de inventario cuando se retome ese workstream.

### BO-05 · P2 — La ruta de operaciones puede leer `.data` en modo Supabase

**Evidencia:** el aviso del layout distingue la sesión Supabase de los pedidos y catálogo demo (`app/backoffice/layout.tsx:31`). Aun así, [app/backoffice/page.tsx](../app/backoffice/page.tsx:29) llama a `getDemoOrderRecords()` sin una condición de entorno y entrega `demoProducts` a la vista (`62-68`). `lib/server/demo-orders.ts` lee `.data/orders.json` (`24-35`, `59-60`) y no comprueba `NODE_ENV`. Las etiquetas “ENTORNO DE DEMO”, “REGISTRO LOCAL” y “DEMO · PERSISTENCIA LOCAL” en la UI son claras; el límite local sigue dependiendo de la presencia del archivo, no de un guard del lector.

**Impacto:** una instalación con Auth Supabase y un archivo local persistente/copiado seguiría mostrando esas filas a personal autorizado en un entorno que no sea desarrollo. No hay `.data/orders.json` en este checkout, así que no se observó exposición de datos. El resumen no representa pedidos conectados: usa estados locales `confirmed`, `pending`, `payment_processing` y pagos `approved`/`declined` (`lib/server/demo-orders.ts:11-12`), distintos de `order_status` (`pending_payment`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`) y `payment_status` de PostgreSQL (migración `23-30`). No existe adaptador de estados ni consulta DB para operaciones.

**Reproducción estática:** configurar Auth, dar a un usuario `fulfillment_manager` y colocar un registro ficticio en `.data/orders.json`; `/backoffice` lo leerá mediante la ruta actual aunque Supabase sea la fuente activa de otros módulos.

**Recomendación:** hacer que el origen sea una decisión server-side única (`demo-local` o `supabase`) y negar lectores `.data` fuera del modo local de demo. Antes de conectar operaciones, mapear explícitamente estados/pagos de DB a la UI y sustituir KPIs locales por consultas sobre los contratos aprobados.

**Owner propuesto:** Auth Agent para el límite de modo y lectores locales; Tech Lead para contrato de datos/estado; QA Agent para ambos modos.

### BO-06 · P3 — El portal no convierte fallos del archivo demo en un estado de error propio

**Evidencia:** `readRecords()` devuelve una lista vacía solo si falta el archivo; errores de lectura y JSON corrupto se vuelven a lanzar (`lib/server/demo-orders.ts:28-36`). La página espera `getDemoOrderRecords()` en su `Promise.all` sin capturar esos errores (`app/backoffice/page.tsx:29`). El componente sí dispone de estado vacío para cero pedidos (`components/backoffice/operations-center.tsx:351-360`), pero no muestra un estado de error controlado para fallo/corrupción del almacenamiento.

**Impacto y reproducción:** un JSON inválido en `.data/orders.json` provoca un error de servidor y no el mensaje operativo localizado; se puede verificar con un archivo ficticio malformado en entorno aislado. El archivo no existe en este worktree.

**Recomendación:** capturar el fallo de lectura y mostrar error/reintento sin traducirlo a lista vacía. Mantener registro técnico del fallo sin incluir datos de clientes.

**Owner propuesto:** Auth Agent (`lib/server/**` según WORKSTREAMS); QA Agent para el caso de error.

## Contratos y estados comprobados

| Superficie | Sesión/rol | Datos/estado | Vacíos y errores |
|---|---|---|---|
| CRM | `getCrmAccess()` llama `auth.getUser()` y lee grants persistidos; requiere `sales_manager` o `super_admin` (`lib/crm/auth.ts:5-24`). La página y la Server Action usan esa comprobación. | Lee `quote_inquiries`, `crm_leads` y `organizations`; no lee pedidos. `ProspectStatus` y el enum SQL coinciden: `new`, `qualified`, `contacted`, `converted`, `closed` (`lib/crm/data.ts:5`, migración `335-350`). | Distingue no configurado, no autenticado, prohibido y error; ofrece vacíos para solicitudes/contactos/organizaciones/actividad (`app/backoffice/crm/page.tsx:60-112`, `206-229`). La actividad es recepción derivada y no hay historial persistido, declarado en `228-229`. |
| Inventario | `getInventorySnapshot()` revalida sesión y rol permitido antes de consultar, no depende solo del layout (`lib/inventory/index.ts:63-90`). | Lee `inventory` con `warehouse:warehouses!inner`; calcula disponible como `on_hand - reserved` (`134-154`), conforme a contrato D-007. El acceso a fila/almacén concuerda con `SELECT` grant y RLS para fulfillment/super_admin; **DML no concuerda con el modo de solo lectura** (BO-02). | Estados explícitos de no configurado, no autenticado, prohibido, error, sin existencias y sin coincidencias; también avisa del límite de 500 filas y de detalles de catálogo filtrados (`inventory/page.tsx:85-103`, `203-230`). |
| Operaciones | El layout bloquea demo sin proyecto, redirige sesión ausente y comprueba roles; la página vuelve a exigir `fulfillment_manager`/`super_admin` (`layout.tsx:13-29`, `page.tsx:19-27`). | Solo lee archivo y fixtures locales. Estados locales de pedido/pago no son los enums de DB; la etiqueta demo hace visible ese alcance. No hay workflow ni consulta conectada de pedidos. | Tiene estado vacío y de filtros sin resultados (`operations-center.tsx:351-360`); el error de lectura de archivo no se captura (BO-06). |

## Contraste con los informes existentes

- **`SECURITY_REVIEW.md`:** F-02 (DML directo de inventario), F-03 (DML de pagos) y F-05 (membresías globales de ventas) siguen presentes en la migración actual. F-01 describía `/backoffice` sin sesión/rol; ese punto está **corregido en el código actual** por el guard del layout y la comprobación duplicada de la página. El riesgo actual restante no es acceso anónimo a la ruta, sino BO-01 (RLS más amplia que la ruta) y BO-05 (origen `.data` sin guard de entorno). La afirmación del resumen de SECURITY de que las órdenes se leen por “roles internos” requiere precisión: `sales_manager` es uno de esos roles en las policies actuales.
- **`DATA_INTEGRITY_REVIEW.md`:** su hallazgo sobre membresías de ventas y falta de conciliación de reservas sigue consistente con el SQL. Los estados del dashboard son del checkout local; no acreditan el lifecycle `order_status` ni la transición de reservas conectadas.
- **`ARCHITECTURE_REVIEW.md`:** su riesgo de mezclar modo demo/Supabase y la recomendación de cerrar lectores `.data` siguen aplicando parcialmente. La autorización de la página `/backoffice`, que el plan propone cerrar, ya existe en el snapshot. Su verificación PostgreSQL/RLS sigue pendiente.

## Checks, límites y handoff

- `pnpm install --frozen-lockfile` — pasó; lockfile sin cambios.
- `pnpm test` — pasó: 10 pruebas Vitest y 19 pruebas Node. No cubren CRM/backoffice ni políticas RLS.
- `pnpm exec tsc --noEmit` — pasó tras generar los tipos con build. La primera ejecución concurrente con build falló al no existir aún `PageProps` generado; repetida después del build pasó sin errores.
- `pnpm lint` — pasó sin errores, con 4 avisos existentes de `<img>`/`eslint-disable` en storefront.
- `pnpm build` — pasó; `/backoffice/crm` e `/backoffice/inventory` aparecen como rutas dinámicas. El build no prueba acceso por rol ni policies.
- `supabase status` — no ejecutable: el CLI no está instalado. No se ejecutaron `supabase db reset`, `supabase db lint` ni tests PostgreSQL. No hay `.env`, `.env.local` ni `.data/orders.json`; no se comprobó una base desplegada.
- `pnpm test:e2e` — no ejecutado: la suite presente solo tiene `tests/e2e/catalog.spec.ts`; no contiene recorridos de backoffice.

**Archivos modificados por esta revisión:** únicamente `docs/BACKOFFICE_REVIEW.md`.

**Commit/PR:** ninguno; no se tocaron los cambios preexistentes.

**Decisiones/contratos:** no se cambió ninguno; BO-01 requiere cerrar el contrato de roles con Database Agent y Tech Lead antes de integrar.

**Dependencias desbloqueadas:** ninguna implementación queda desbloqueada hasta resolver BO-01/BO-02 y validar SQL/RLS en PostgreSQL. Al cerrar esas políticas, QA puede añadir pruebas de lectura denegada/concedida e invariantes.

**Siguiente owner:** Database Agent (migración y contratos de permisos/inventario); Auth Agent (modo único y acceso `.data`); QA Agent (pruebas); Tech Lead debe conciliar el hallazgo F-01 obsoleto en informes/estado cuando integre esta revisión.
