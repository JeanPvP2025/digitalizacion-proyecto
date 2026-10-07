# Estado del proyecto

Estado observado el **2026-10-07** tras integrar la tercera ola. Git, migraciones y gates locales son la fuente de este resumen. No hay entorno Supabase remoto, sesión de Auth del navegador ni despliegue de producción probado.

## Resumen

- ✅ **Checkout/Pedido/Pago simulado (SQL):** carrito persistido, lectura de precio/stock en servidor, fingerprint de pedido, snapshots históricos, reserva transaccional, intentos de pago, resultado aprobado/rechazado, liberación y recuperación ante fallo parcial. PgTAP cubre idempotencia y recuperación.
- 🚧 **Checkout conectado en aplicación:** `POST /api/checkout` crea/recupera el pedido por RPC y llama el resultado de pago con cliente secreto solo servidor. La ruta está cubierta con mocks y la base con SQL, pero no se ha recorrido la API contra Supabase Auth local/GoTrue y PostgREST ni con doble sesión concurrente desde navegador.
- ✅ **Boundary storefront:** demo fixtures solo se usan bajo el modo demo explícito; catálogo conectado no vuelve a fixtures cuando falla Supabase. Búsqueda conectada devuelve error/resultado vacío controlado. Playwright cubre solo demo local.
- ✅ **CRM/B2B base:** organizaciones/membresías, portal, solicitud con snapshots, cola de ventas, claim y oferta/aceptación, actividades y políticas tenant. No es CRM completo ni hay conversión automática de oferta aceptada a pedido.
- ✅ **Soporte/RMA base:** alta de ticket + primer mensaje atómica; solicitud de devolución idempotente y con límite acumulado comprado/entregado. Aún no existe un recorrido UI completo de agente/mensajes/resolución y revisión RMA.
- 🚧 **RBAC/RLS:** pruebas runtime PostgreSQL para anon, customers, B2B buyer/admin, support, sales, fulfillment y superadmin. Scope de roles está documentado en `RBAC_MATRIX.md`; `catalog_manager` no tiene recorrido runtime amplio; no hay roles `marketing`/`manager` genérico. CRUD exhaustivo y pruebas con tokens GoTrue siguen pendientes.
- 🚧 **Storefront y cuenta:** catálogo, PDP, búsqueda, favoritos/comparador, carrito y guardados funcionan parcialmente con demo/browser storage. PC Builder ahora carga solo variantes publicadas con `attributes.pc_builder` completos, valida compatibilidad cubierta y guarda/recupera selecciones por `variantId`. El catálogo actual no contiene componentes PC con ese schema, así que muestra estado vacío y mantiene deshabilitada la compra; el puente requiere primero catálogo vendible y el nuevo contrato de checkout por `variantId`.
- 🚧 **Backoffice:** CRM/B2B e inventario conectado en lectura. Operations Center, analytics, compras/recepciones y dashboards siguen demo o parciales.
- 🚧 **Calidad visual:** 8 E2E demo, sin E2E conectado para pagos/portal; responsive y accesibilidad requieren recorrido manual global. Performance, SEO, reviews/contenido y polish permanecen abiertos.

## Hallazgos de integración de la tercera ola

- Todos los worktrees presentaron commit y estado limpio; se integraron cinco commits lógicos y se reconciliaron sus docs en el coordinador.
- Se repararon fixtures SQL que quedaron incompatibles con las nuevas restricciones de pedido/presupuesto y el uso de RPC de membresías.
- La auditoría reproducía exposición global a ventas de organizaciones/membresías; la migración CRM ya la restringe. La cola de presupuestos B2B sin asignar es global por requisito de asignación comercial, queda explícitamente documentada; ventas no obtiene lectura de pedidos ni pagos.
- La auditoría detectó que notas CRM `organization` de una propuesta sin asignar podían verse en la cola de ventas. Se restringieron; además se eliminó `sales_manager` de la policy de pagos.
- No se confirmó hallazgo Critical. Hallazgo de acceso a notas CRM de otra organización corregido en la migración nueva; scope restante de la cola comercial está aceptado/documentado y cubierto por prueba.

## Backlog priorizado

### P0

- [ ] Hacer una prueba conectada real de API/route → Auth Supabase local → pedido → payment RPC usando solo clave server-side; cubrir doble envío, timeout/retry y refresh durante processing.
- [ ] Validar CRUD y acciones sensibles de todos los endpoints/RPC mediante tokens GoTrue/PostgREST; añadir prueba para `catalog_manager` y separación demo/prod runtime.
- [ ] Confirmar el modelo comercial de pedido empresarial: oferta aceptada → pedido B2B o registro de conversión.

### P1

- [ ] Publicar variantes reales CPU/placa/RAM/caja/fuente con `attributes.pc_builder`; integrar el checkout por `variantId` y completar la compra del PC Builder.
- [ ] Conectar Operations Center a eventos y pedidos reales; workflow de picking, envío y timeline.
- [ ] Implementar recepción/movimientos de inventario y procurement con ledger idempotente.
- [ ] Completar ciclo de soporte/RMA con bandeja de agentes, mensajes, revisión y resolución.
- [ ] Conectar métricas CRM/analytics a datos operativos comprobables.

### P2

- [ ] E2E por checkout conectado aprobado/rechazado, cuenta/pedido, B2B CRM y Support/RMA.
- [ ] Pruebas de concurrencia con solicitudes paralelas sobre la misma clave/carrito/stock.
- [ ] Revisión manual de teclado, focus, dialogs, responsive y contraste en storefront/backoffice.
- [ ] Medir performance real de rutas/imágenes/bundle y corregir fallos de estado vacío/error.
- [ ] Auditar botones/enlaces, persistencia, paginación, reviews, moderación, blog/SEO.

### P3

- [ ] CMS/blog completo, catálogo/proveedores/compras avanzadas, monedas/países adicionales y recomendaciones.
- [ ] Guion de demo y material académico final con diagramas y límites del modo demo.

## Gates de esta integración

| Check | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ |
| `pnpm exec tsc --noEmit` | ✅ después del build |
| `pnpm lint` | ✅ sin diagnósticos; runner tardó por carga de procesos externos |
| `pnpm test` | ✅ 86 Vitest + 18 Node, tras integrar PC Builder |
| `pnpm test:e2e` | ✅ 8 Playwright de catálogo/demo, repetidos tras integrar PC Builder |
| `pnpm build` | ✅ Next.js producción, 26 páginas estáticas |
| `supabase db reset --local --yes` | ✅ migraciones y seed |
| pgTAP `tests/database` + checkout-flow | ✅ 156 aserciones |
| PostgreSQL RLS, seguridad, soporte/RMA | ✅ scripts transaccionales con rollback |
| `supabase db lint --local --fail-on error` | ✅ sin avisos/esquema |
| `git diff --check` | ✅; avisos LF/CRLF de Windows |

## Criterio de cierre

Una feature queda ✅ solo con contrato integrado, autorización server/database, persistencia, estados de error/vacío, UX navegable y pruebas del recorrido principal. Gates locales no prueban producción ni sustituyen Auth/PostgREST E2E.
