# Contratos de analítica operativa

Estado contrastado con lib/analytics/metrics.ts, lib/analytics/data.ts, las migraciones y el seed local al 2026-10-07. La analítica actual consulta PostgreSQL/Supabase; no usa métricas demo, porcentajes elegidos a mano ni datos de .data/.

## Acceso y lectura

- getAnalyticsSnapshot requiere una sesión Auth y el grant persistido super_admin. Las consultas usan el cliente autenticado de esa sesión y RLS; no emplean service-role.
- Las fuentes son orders, order_events, payment_transactions, inventory y quote_inquiries. Cada lectura pagina en bloques de 500 y falla cerrada al superar 5.000 filas por fuente.
- Si una fuente falla, excede el límite o los eventos, pagos, importes y snapshots no concuerdan, la página oculta todos los KPIs y muestra un estado recuperable. No se presentan agregados parciales.
- La ventana de actividad cubre 30 fechas de calendario de Europe/Madrid: desde la medianoche local de la fecha actual menos 29 días, inclusive, hasta el instante de consulta, exclusivo. El offset se calcula con la regla horaria de Madrid para respetar los cambios CET/CEST.

## KPIs publicados

| KPI | Fuente y cálculo | Periodo / estado | Límites explícitos |
|---|---|---|---|
| Pedidos válidos | orders: cuenta IDs únicos por placed_at. | Dentro de la ventana. Incluye paid, processing, shipped y delivered. | Excluye pending_payment, cancelled y refunded. No depende de un evento de pago. |
| Ventas brutas aprobadas · EUR | Una vez por pedido, suma orders.grand_total —con IVA y envío, menos descuentos— cuando el evento terminal más reciente es payment_paid y coincide con una transacción terminal aprobada. Valida estado, importe y moneda contra el snapshot del pedido. | order_events.occurred_at y payment_transactions.processed_at deben estar en la ventana. Los estados de pago aceptados son paid, partially_refunded y refunded. | Es venta bruta histórica, no neta: no resta devoluciones ni reembolsos. No convierte otras monedas a EUR; excluye esos importes y muestra su cantidad por separado. |
| Aprobación de pagos | Numerador: pedidos únicos con pareja consistente de evento payment_paid y transacción aprobada. Denominador: pedidos únicos con evento terminal payment_paid o payment_failed y transacción compatible. | Evento y transacción deben estar en la ventana. Resultados pendientes y autorizaciones no entran. | Un evento sin transacción, una transacción sin evento o estados incompatibles invalidan la instantánea completa. Sin denominador se muestra —. |
| Unidades disponibles | inventory: suma on_hand - reserved para cada pareja almacén-variante. Se muestra también la suma reservada y el número de ubicaciones SKU. | Instantánea al consultar, sin ventana histórica. | Agrega las filas visibles por el acceso interno. No infiere compras futuras ni disponibilidad por fecha. Cantidades inválidas ocultan la instantánea. |
| Conversión de solicitudes CRM | quote_inquiries: solicitudes únicas actualmente en estado converted / solicitudes únicas creadas en la ventana, cualquiera que sea su estado actual. | Cohorte por created_at; el estado se evalúa al consultar. | Este KPI no mide la conversión de cotizaciones formales B2B: quotes y business_quote_conversions no pertenecen a su fuente ni demuestran la creación de un pedido. Sin solicitudes se muestra —. |

Los últimos eventos y pagos se seleccionan por pedido. Repeticiones para el mismo pedido no multiplican ventas ni resultados. Los valores monetarios del dashboard se convierten a céntimos enteros para agregar.

## Evidencia determinista

tests/integration/analytics/metrics.test.ts define la fixture pura de contrato. tests/database/analytics_metrics.sql inserta una fixture en las tablas PostgreSQL reales, consulta las mismas fuentes y valida límites, estados y deduplicación con pgTAP. La expectativa compartida es:

| Resultado de fixture | Valor |
|---|---:|
| Pedidos válidos | 3 |
| Ventas brutas aprobadas | 201,50 € |
| Pedidos aprobados / resueltos | 2 / 3 (66,7 %) |
| Disponible / reservado / ubicaciones SKU | 12 / 6 / 3 |
| Solicitudes convertidas / totales | 1 / 2 (50 %) |

La fixture incluye una repetición de pago aprobado, pago parcialmente reembolsado, pago fallido, solicitud pendiente, pedido reembolsado, estados en la frontera inicial y registros en la frontera final exclusiva. La suite conectada tests/e2e/connected-domains/connected-domains.spec.ts añade filas locales mediante fixtures de prueba y confirma en el dashboard el incremento de cada KPI contra su valor previo. También comprueba el acceso denegado de support_agent y que una discrepancia evento-pago oculta todos los valores.

## Fuentes que todavía faltan

- Ventas netas tras devolución: falta un ledger de reembolsos con importe y fecha.
- Margen bruto: falta el coste histórico de compra del producto en el snapshot de pedido.
- Conversión de visita a pedido: no hay eventos de sesión o analítica web conectados.
- Conversión de presupuesto B2B a pedido: la conversión auditada actual conserva snapshots, pero no emite orders ni reserva stock.
- No se ha probado la conexión contra un proyecto Supabase remoto ni un despliegue.

Un KPI futuro debe declarar fuente, numerador, denominador, ventana, zona horaria, estados y comportamiento ante inconsistencias antes de aparecer en el dashboard. Debe incluir fixture SQL y expectativa de cálculo antes de marcarse verificado.
