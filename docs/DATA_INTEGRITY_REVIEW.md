# Revisión independiente de integridad de datos

> **Baseline superseded (2026-10-07):** este informe estático precede a la migración `20261007085225_database_security_invariants.sql`. Las pruebas actuales cubren payment approve/fail, reserva/liberación, fulfillment y retry de eventos mediante 60 casos pgTAP. Sigue pendiente conectar esos RPC a la API/UI; idempotency payload fingerprint y validación de dirección siguen abiertos. Ver `SECURITY.md`, `TESTING.md` y `STATUS.md` para evidencia y límites vigentes.

**Fecha:** 2026-10-07
**Alcance:** migración y seed iniciales, contratos de catálogo, dinero/IVA, carrito/pedido, stock reservado, idempotencia, B2B/CRM, soporte, roles y auditoría.
**Método:** revisión estática del SQL y de sus consumidores UI/API; no se modificó SQL ni código.

En las referencias siguientes, **M** es `supabase/migrations/20261007073027_nodria_commerce_foundation.sql`.

## Resumen ejecutivo

La migración define 27 tablas y habilita RLS en las 27. Los importes usan `NUMERIC`, y `public.place_order` recalcula precios y reserva stock dentro de una transacción con bloqueo e idempotencia por cliente/clave. Estas son buenas bases estáticas; no prueban el comportamiento real de PostgreSQL.

Hallazgos que bloquean una integración fiable:

1. El formulario B2B actual no puede superar la validación de su endpoint: todos los valores de volumen enviados por la UI difieren del enum de Zod.
2. Las reservas creadas por checkout no tienen una transición de pago/cancelación que las consuma o libere.
3. La política de membresías permite a ventas asignar `owner` y atribuir la inserción a otro usuario; la creación de empresa y primer propietario tampoco es atómica.
4. Varias devoluciones pueden reclamar, en conjunto, más unidades que las compradas; el plazo se calcula desde la compra, no desde la entrega.
5. Los flujos locales de pedido y soporte/B2B tienen contratos distintos del esquema, por lo que no pueden conectarse mediante una simple sustitución de persistencia.

El seed revisado contiene las seis variantes y referencias actuales esperadas; no encontré una FK rota en sus valores estáticos. Aun así, varios `INSERT … SELECT` del seed omiten filas silenciosamente cuando un `slug`, SKU o almacén no coincide.

## Hallazgos

### DI-01 — La solicitud B2B rechaza todos los volúmenes de la UI — **Alta, defecto actual**

**Evidencia:** `components/business/business-quote-form.tsx:149-157` declara opciones como `1–5 equipos`, `6–25 equipos` y `Proyecto de infraestructura`, sin `value` explícito. El navegador envía ese texto. `app/api/quotes/route.ts:14` solo acepta `1-10`, `11-50`, `51-200` o `200+`; la validación estricta devuelve 400 antes de guardar el registro. Además, `quote_inquiries` no tiene columna de volumen (`supabase/migrations/20261007073027_nodria_commerce_foundation.sql:338-351`), así que ese dato desaparecería al conectar el endpoint a PostgreSQL.

**Escenario y consecuencia:** se completa el formulario visible y se elige cualquiera de sus opciones; la llamada a `/api/quotes` no alcanza `saveDemoQuoteInquiry`. El volumen tampoco tiene destino persistente en el esquema.

**Remediación:** definir un único catálogo de valores, usar esos valores como `option.value` y validarlos en servidor; acordar los intervalos reales con producto. Añadir `requested_volume` con `CHECK` al contrato de `quote_inquiries` y conceder solo esa columna en el grant de inserción público. Alinear también límites: contacto 120 en UI frente a 100 en API, email 254 frente a 200.

### DI-02 — La membresía inicial de empresa no es atómica y la política permite atribución falsa — **Alta**

**Evidencia:** `organizations` y `organization_memberships` son inserciones separadas (`M:66-86`). La política `organizations_insert_self` comprueba solo `created_by = auth.uid()` (`M:942-944`). `organization_memberships_insert_owner_or_admin` permite al creador añadirse como propietario (`M:958`), pero no hay trigger/RPC que asegure que esa membresía se cree con la empresa. La rama de personal (`M:960`) no liga `added_by` al actor ni restringe `role`.

**Escenario y consecuencia:** una empresa puede persistir sin miembro propietario si falla el segundo INSERT. Un usuario con `sales_manager` o `super_admin` puede insertar una membresía con `role = 'owner'` y cualquier `added_by` existente, porque la tercera rama basta para pasar `WITH CHECK`. Esto deja membresías sin atribución fiable y una empresa puede tener propietarios asignados por esa ruta.

**Remediación:** crear una operación transaccional para empresa + primer propietario (RPC o caso de uso con transacción que no exponga escrituras separadas). En la política administrativa, exigir `added_by = auth.uid()` y definir expresamente quién puede asignar `owner`; conservar una ruta separada para bootstrap de personal si se necesita. Si el contrato requiere exactamente un propietario activo, hacerlo cumplir en la misma operación con una restricción/serialización apropiada. La PK actual solo garantiza una fila por pareja empresa/usuario.

### DI-03 — El checkout reserva stock pero no existe transición que cierre la reserva — **Alta**

**Evidencia:** `private.place_order` crea pedido `pending_payment`, incrementa `inventory.reserved`, inserta `inventory_reservations` y convierte el carrito (`M:772-826`). `inventory` solo garantiza `0 <= reserved <= on_hand` (`M:172-179`). `inventory_reservations` registra `released_at`/`fulfilled_at`, pero no sincroniza esos campos con el contador y su `CHECK` solo impide que ambos timestamps sean no nulos (`M:266-276`). No hay RPC de resultado de pago, cancelación, consumo ni liberación en esta migración; el propio handoff lo reconoce.

**Escenario y consecuencia:** un pago rechazado/abandonado mantiene el contador reservado. Una liberación manual puede marcar el timestamp sin decrementar `inventory.reserved`, o viceversa. La suma de reservas activas puede divergir del contador agregado y reducir stock vendible indefinidamente.

**Remediación:** definir RPCs transaccionales para aprobar/fallar/cancelar y cumplir el pedido. Deben bloquear pedido, reservas e inventario en orden estable, cambiar estado de pago/pedido, decrementar o consumir cantidades, escribir evento y actualizar `released_at`/`fulfilled_at` en la misma transacción. Añadir una FK compuesta o validación equivalente que relacione la variante del `order_item` con la fila `inventory` `(warehouse_id, variant_id)`, y una consulta de reconciliación para comprobar `inventory.reserved = SUM(reservas activas)`.

### DI-04 — Las devoluciones pueden superar las unidades compradas y usan una fecha de corte incorrecta — **Alta**

**Evidencia:** `return_items` limita `quantity > 0` y evita duplicar el mismo artículo dentro de una solicitud (`M:397-405`). La policy de inserción comprueba `quantity <= oi.quantity` para la fila individual (`M:1208-1215`), pero no suma solicitudes anteriores del mismo `order_item_id`. La policy de `return_requests` compara `placed_at` con 30 días (`M:1192-1198`); no existe `delivered_at` en `orders`.

**Escenario y consecuencia:** un cliente crea varias solicitudes y reclama en cada una hasta el total comprado; la suma puede exceder la cantidad original. Una compra entregada tarde puede quedar inelegible antes de 30 días desde la entrega, o seguir elegible según una fecha que no representa recepción.

**Remediación:** serializar la solicitud por pedido/línea y validar en una transacción que la suma de devoluciones solicitadas/aprobadas/recibidas no exceda la cantidad comprada, excluyendo estados terminales rechazados según una regla explícita. Añadir fecha de entrega y calcular elegibilidad desde ella. Mantener la restricción actual para duplicados dentro de una misma solicitud.

### DI-05 — Los estados y totales del checkout local no son intercambiables con el contrato SQL — **Alta, bloqueo de integración**

**Evidencia:** la UI envía solo líneas, dirección y método demo (`components/storefront/checkout-form.tsx:38-53`); no envía `p_cart_id` ni clave idempotente. La ruta escribe en `.data/` y asigna estados `confirmed`, `payment_processing`, `pending` y resultados `approved`, `declined`, `insufficient_funds`, etc. (`app/api/checkout/route.ts:82-107`). La migración usa otros enums: pedido `pending_payment/paid/processing/...` y pago `pending/authorized/paid/failed/...` (`M:18-34`). El contrato SQL expuesto requiere carrito UUID y clave (`M:836-851`). Además, la ruta local llama `subtotal` al total bruto con IVA incluido y calcula `tax` desde total más envío (`app/api/checkout/route.ts:78-80`); en SQL `orders.subtotal` es neto y `tax_total` se separa (`M:211-221`), con snapshots de línea netos/brutos (`M:242-245`). La RPC toma el primer pedido que coincide con usuario/clave y lo devuelve sin comparar carrito ni direcciones (`M:689-699`).

**Escenario y consecuencia:** conectar la ruta actual directamente a `place_order` no es posible sin un adaptador y una decisión sobre estados. Importar el `subtotal` demo como subtotal SQL duplicaría el IVA; reenviar una petición tras timeout puede crear otro pedido en el flujo local porque no hay clave idempotente en el payload.

**Remediación:** mantener explícito el límite de demo local y, al integrar, hacer que el servidor resuelva el carrito persistido, genere/retenga una clave estable por intento y llame al RPC. Guardar un hash del payload/cart asociado a la clave y rechazar una clave reutilizada con contenido distinto. Definir una tabla de mapeo de estados demo a enums SQL y un RPC autenticado para resultados ficticios que actualice pago, pedido, reserva y evento juntos. Renombrar/documentar el subtotal local como bruto o recalcular neto por línea con la tasa guardada; no persistir importes calculados por el navegador.

### DI-06 — La solicitud de soporte local no cabe en `support_tickets` y ticket/mensaje pueden quedar partidos — **Alta, integración pendiente**

**Evidencia:** el formulario y API envían email, número de pedido como texto y cuerpo inicial (`components/storefront/support-form.tsx:12-18`, `app/api/support/route.ts:9-15`). La tabla SQL requiere `customer_id` de Auth, acepta `order_id` UUID, no tiene email de contacto y el cuerpo vive en `support_messages` (`M:355-379`). El insert del ticket y el insert del mensaje tienen policies separadas (`M:1160-1187`), sin operación atómica.

**Escenario y consecuencia:** el formulario público actual es demo local, según la UI y la ruta. No existe un mapeo directo a Supabase: un número de pedido no puede insertarse en `order_id`, el correo no identifica una cuenta y el mensaje se perdería si solo se crea el ticket. Si se hacen dos INSERT independientes, puede quedar un ticket vacío cuando falle el segundo. La policy también permite indicar por separado una organización de la que se es miembro y un pedido propio sin comprobar que el pedido pertenezca a esa organización.

**Remediación:** decidir si soporte Supabase requiere sesión o admite solicitudes anónimas mediante una tabla de intake específica. Resolver `orderNumber` a un pedido propio en servidor. Crear ticket y mensaje inicial en una transacción/RPC. Validar conjuntamente organización/pedido o derivar la organización desde el pedido; no aceptar ambos enlaces independientes sin regla.

### DI-07 — La auditoría no cubre cambios sensibles y el inventario carece de libro de movimientos — **Alta para trazabilidad**

**Evidencia:** los triggers genéricos se instalan en productos, variantes, membresías, inventario, pedidos, pagos y reservas (`M:885-898`), pero no en `user_role_grants`, organizaciones, CRM, solicitudes/cotizaciones ni tickets/mensajes/devoluciones. `audit_row_change` solo almacena nombres de columnas (`M:562-616`); no guarda delta ni valores. No existe tabla de movimientos de inventario; usuarios de logística pueden editar directamente `on_hand` y `reserved` (`M:1024-1031`, grants `M:1243`).

**Escenario y consecuencia:** un grant de rol, cambio de estado de ticket/cotización o ajuste manual de stock no deja una historia completa. Para stock solo se ve que cambió una columna, no cuánto ni por qué; no se puede reconstruir ni reconciliar un ajuste operativo.

**Remediación:** añadir auditoría append-only a concesión/revocación de roles y a transiciones de soporte, CRM, cotización y devolución, con actor y referencia de operación. Mantener el log genérico sin PII, pero crear `inventory_movements` con delta, tipo, motivo, actor, referencia y saldo resultante; aplicar entradas/salidas mediante RPC transaccional en lugar de edición arbitraria de contadores.

### DI-08 — Las direcciones de pedido aceptan objetos vacíos o incompletos — **Media**

**Evidencia:** `orders` y `private.place_order` solo comprueban que shipping/billing sean objetos JSON (`M:216-217`, `M:684-687`). El RPC es invocable por cualquier usuario autenticado mediante el wrapper público.

**Escenario y consecuencia:** una llamada directa al Data API puede crear un pedido con `{}` o sin calle, localidad o código postal, aunque la UI local marque esos campos como obligatorios. La transacción reserva inventario para un pedido imposible de preparar.

**Remediación:** definir el contrato de dirección con claves y límites; validar en el RPC (o en una función de dominio invocada exclusivamente por él) que los campos mínimos no estén ausentes/vacíos y que país/código postal sean compatibles con el alcance. Mantener validación Zod como UX, no como única autoridad.

### DI-09 — El catálogo permite productos publicados no vendibles y una jerarquía cíclica — **Media**

**Evidencia:** `products.is_published` no exige `published_at` ni variante activa; la policy pública solo mira `is_published` (`M:103-121`, `M:980-988`). La tabla `categories` solo impide que `parent_id = id` (`M:90-101`), no ciclos de varios nodos. El seed une categorías, SKUs y almacén por `JOIN` (`supabase/seed.sql:80-91`, `151-163`), por lo que una referencia faltante elimina filas sin abortar la ejecución.

**Escenario y consecuencia:** una publicación puede aparecer en lecturas públicas sin variante comprable, y un ciclo de categorías puede romper/bloquear recorridos recursivos. Un cambio futuro de slug/SKU puede dejar el seed incompleto aunque `db reset` termine con éxito.

**Remediación:** validar publicación como operación que comprueba al menos una variante activa y timestamp coherente. Prevenir ciclos con validación transaccional de jerarquía. Añadir aserciones post-seed de conteos y anti-joins esperados para las seis categorías/productos/variantes/filas de stock; hacer fallar el seed ante diferencias.

### DI-10 — El quote no conserva snapshots/currency de sus líneas — **Media**

**Evidencia:** `quote_items` conserva `variant_id`, cantidad y dos precios opcionales, pero no SKU/nombre/título/atributos/currency/tax snapshot (`M:308-317`). `quotes.currency` es independiente (`M:292-303`); no hay regla que exija que coincida con `product_variants.currency`.

**Escenario y consecuencia:** una variante cambia nombre, atributos, precio o moneda después de enviar o aceptar un presupuesto; la relación sigue apuntando al catálogo mutable y no basta para reconstruir qué se ofreció. También se pueden guardar líneas de monedas distintas bajo un único `quotes.currency`.

**Remediación:** al emitir una oferta, guardar snapshots de identidad de producto, moneda y precio/impuestos aplicables; validar moneda de cada línea contra la cotización. Acordar si la cotización queda congelada al pasar a `sent`/`accepted` y bloquear mutaciones incompatibles o versionarlas.

## Casos SQL recomendados

No se ejecutaron porque no hay servidor PostgreSQL local accesible. Ejecutar en una base descartable creada con `supabase db reset`, con dos sesiones para los casos concurrentes y JWTs/roles de prueba:

| Caso | Acción | Resultado esperado |
|---|---|---|
| Seed y FKs | Contar categorías/productos/variantes/stock y hacer anti-joins desde `product_categories` e `inventory` a slugs/SKUs/almacén esperados. | Seis productos y variantes enlazados; cero referencias esperadas ausentes; el seed debe fallar si no se cumple. |
| B2B volumen | Enviar cada valor exacto de `<option>` al mismo esquema Zod y al INSERT de `quote_inquiries`. | Todos los valores UI aceptados y persistidos en `requested_volume`; entradas fuera del enum rechazadas. |
| Empresa + propietario | Crear empresa y forzar fallo al insertar membresía; probar inserción de ventas con `role='owner'` y `added_by` de otro usuario. | La transacción completa revierte; las reglas de rol/actor rechazan combinaciones no autorizadas. |
| Dirección | Ejecutar `place_order` con `{}`, dirección incompleta y dirección válida. | Los dos primeros rechazan antes de crear pedido o reserva; la válida guarda snapshot completo. |
| Idempotencia checkout | Dos sesiones simultáneas, mismo usuario/clave/carrito; repetir clave con otro carrito/dirección. | Un solo pedido para el mismo intento; clave usada con otro payload se rechaza o devuelve conflicto según contrato documentado. |
| Stock concurrente | Dos checkouts para la última unidad de una variante desde carritos distintos. | Solo uno confirma; nunca `reserved > on_hand`; el perdedor no deja pedido, pago, evento ni reserva parcial. |
| Pago fallido/cancelación | Reservar, marcar pago fallido/cancelar y volver a leer inventario, reserva y eventos. | Todos los cambios atómicos; contador liberado una sola vez; reintento del mismo evento no duplica movimiento. |
| Devolución acumulada | Comprar una unidad; solicitarla en dos requests separados; probar pedido entregado hace 31 días pero comprado antes. | Segunda cantidad rechazada por acumulado; ventana calculada desde `delivered_at`. |
| Soporte | Crear ticket y mensaje inicial; provocar fallo del mensaje; probar pedido ajeno y organización/pedido cruzados. | No queda ticket parcial y RLS/RPC rechaza enlaces ajenos o incompatibles. |
| Auditoría | Cambiar/revocar rol, mover estado CRM/soporte y ajustar stock por movimiento. | Cada cambio tiene actor/referencia; el movimiento permite recomponer saldo sin leer PII. |
| Redondeo IVA | Carrito con varias líneas, tasas y precios con céntimos; sumar snapshots SQL y comparar con el total. | `grand_total = subtotal + tax_total + shipping_total - discount_total`; importes coinciden con suma por línea y política de redondeo acordada. |

## Límites de verificación y comandos

- Leídos: los seis documentos de contexto requeridos, `docs/database.md`, migración, seed, formularios, rutas API y fixtures de catálogo.
- Conteo estático: 27 declaraciones de tabla y 27 `ENABLE ROW LEVEL SECURITY`; esto no valida políticas efectivas ni grants resultantes en runtime.
- Git al iniciar: `HEAD 707b97b` (`Initial commit from Create Next App`) con numerosas modificaciones y archivos no rastreados preexistentes en el worktree; no se revirtieron ni editaron. El único archivo creado para esta auditoría es este documento.
- Comandos de lectura usados: `Get-Content` sobre los documentos/SQL/rutas; `rg --files` y `rg -n` para inventario de archivos, definiciones y referencias; `git status --short`, `git branch --show-current`, `git log -5 --oneline`, `git diff --stat`.
- Disponibilidad DB: `Get-Command docker,supabase,psql` encontró solo `docker.exe`; `docker info --format '{{.ServerVersion}}'` falló porque no existe el pipe del daemon `dockerDesktopLinuxEngine`. No se ejecutó `supabase db reset`, `supabase db lint`, SQL, RLS tests ni tests de aplicación.
- Sin PostgreSQL no se pudo comprobar sintaxis/compilación de PL/pgSQL, resolución de grants y propietarios, ejecución de triggers, planes/bloqueos, aislamiento entre sesiones, el comportamiento real de `SECURITY DEFINER`, aplicación del seed, ni los resultados de los casos SQL anteriores. La conclusión se limita al código estático y a los contratos visibles.

## Acciones recomendadas

1. Corregir inmediatamente el enum de volumen UI/API y persistirlo en el contrato B2B.
2. Acordar los RPC de pago, liberación/consumo de stock, alta de organización y apertura de ticket con sus consumidores antes de integrar esos flujos.
3. Corregir el control agregado de devoluciones y elegir la fecha de inicio del plazo.
4. Incorporar ledger de inventario y ampliar cobertura de auditoría de cambios privilegiados.
5. Ejecutar la matriz SQL/RLS en PostgreSQL local y comparar sus resultados con este informe antes de cambiar el estado de esos dominios a `Done`.
