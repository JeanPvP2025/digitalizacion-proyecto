# Estado del proyecto

Estado observado el **2026-10-07** tras integrar la cuarta ola. Git, migraciones y gates locales son la fuente de este resumen. No hay entorno Supabase remoto, sesión GoTrue/PostgREST desde navegador ni despliegue de producción probado.

## Resumen

- ✅ **Checkout/Pedido/Pago simulado (SQL):** carrito persistido, precio/stock autoritativos en servidor, fingerprint de pedido, snapshots históricos, reserva transaccional, intents de pago, rechazo/aprobación y recuperación; PgTAP cubre la misma clave con payload distinto.
- 🚧 **Checkout conectado en aplicación:** `POST /api/checkout` acepta `variantId`, reconstruye el contenido y llama RPCs para pedido/pago con credencial privilegiada solo servidor. Route tests y SQL pasan; falta recorrer la ruta por GoTrue/PostgREST con sesión real, retry/refresco y doble POST concurrente desde navegador.
- ✅ **Boundary storefront:** demo fixtures solo se usan bajo el modo demo explícito; catálogo conectado no vuelve a fixtures cuando falla Supabase. Búsqueda conectada devuelve error/resultado vacío controlado. Playwright cubre solo demo local.
- ✅ **CRM/B2B base:** organizaciones/membresías, portal, solicitud con snapshots, cola de ventas, claim y oferta/aceptación, actividades y políticas tenant. No es CRM completo ni hay conversión automática de oferta aceptada a pedido.
- ✅ **Soporte/RMA conectado:** bandeja agente, mensajes y transiciones mediante RPC, timeline, revisión idempotente y límite de unidades; sin efectos de reembolso/stock integrados.
- 🚧 **RBAC/RLS:** matrix runtime PostgreSQL ahora incluye anon, clientes A/B, buyer/admin B2B, catalog manager, support, sales, fulfillment y superadmin. El acceso a transición de soporte se ejerce por RPC; DML directo permanece revocado. Falta validar con JWT GoTrue/PostgREST y completar cobertura endpoint/columna.
- 🚧 **Storefront y cuenta:** catálogo, PDP, búsqueda, favoritos/comparador, carrito y guardados funcionan parcialmente con demo/browser storage. PC Builder carga variantes publicadas con `attributes.pc_builder` completos, valida compatibilidad cubierta y guarda/recupera selecciones por `variantId`. El checkout ya acepta `variantId`, pero el seed no contiene componentes PC; muestra estado vacío y mantiene deshabilitada la compra hasta tener catálogo vendible.
- 🚧 **Backoffice:** Operations Center y analytics consultan pedidos/eventos/métricas operativas y tienen tests de módulo. Inventario sigue solo lectura; procurement/recepciones no están implementados.
- ✅ **Reseñas base:** elegibilidad por línea entregada, escritura pendiente de moderación, publicación/rechazo de moderador y RLS con pgTAP. La integración visual desde la PDP aún requiere revisión.
- 🚧 **Calidad visual:** 15 E2E de catálogo/demo y UX responsive/teclado; CSS Modules restaurados para todas las superficies. No cubren Auth conectado ni checkout real. Performance, SEO, reviews en PDP, contenido y polish global permanecen abiertos.

## Hallazgos de integración de la tercera ola

- Todos los worktrees presentaron commit y estado limpio; se integraron cinco commits lógicos y se reconciliaron sus docs en el coordinador.
- Se repararon fixtures SQL que quedaron incompatibles con las nuevas restricciones de pedido/presupuesto y el uso de RPC de membresías.
- La auditoría reproducía exposición global a ventas de organizaciones/membresías; la migración CRM ya la restringe. La cola de presupuestos B2B sin asignar es global por requisito de asignación comercial, queda explícitamente documentada; ventas no obtiene lectura de pedidos ni pagos.
- La auditoría detectó que notas CRM `organization` de una propuesta sin asignar podían verse en la cola de ventas. Se restringieron; además se eliminó `sales_manager` de la policy de pagos.
- No se confirmó hallazgo Critical. Hallazgo de acceso a notas CRM de otra organización corregido en la migración nueva; scope restante de la cola comercial está aceptado/documentado y cubierto por prueba.

## Hallazgos de integración de la cuarta ola

- Se integraron ocho worktree commits verificables de dominios/tests/docs; los commits de coordinador cerraron los límites de variantId, CSS, acciones UX y contrato de RPC de soporte.
- Los E2E revelaron CSS Modules vacíos en toda la app porque `*.css` usaba el loader global de Tailwind. Se migró Tailwind a PostCSS y se verificó con E2E responsive.
- El checkout permitía submit con carrito vacío y el footer ofrecía un “Volver arriba” sin interacción; ambos quedaron corregidos y con E2E sin expected-failure.
- La role matrix primero falló porque probó DML directo revocado en `support_tickets`. El test ahora valida el RPC autorizado y la transición resultante; grants directos permanecen cerrados.
- No hay diff/commit verificable de los workstreams checkout E2E con Auth ni inventario/procurement. No se promueven a completados; siguen P0/P1.

## Backlog priorizado

### P0

- [ ] Hacer E2E conectado de API/route → GoTrue/PostgREST → pedido/pago; cubrir doble envío, timeout/retry, refresh y concurrencia de stock. El checkout E2E anterior no dejó cambios verificables integrables.
- [ ] Validar CRUD y acciones sensibles con tokens GoTrue/PostgREST; ampliar Auth boundary y separación demo/prod runtime.
- [ ] Confirmar el modelo comercial de pedido empresarial: oferta aceptada → pedido B2B o registro de conversión.

### P1

- [ ] Publicar variantes reales CPU/placa/RAM/caja/fuente con `attributes.pc_builder`; el checkout ya acepta `variantId`, pero no hay componentes sembrados ni compra del configurador.
- [ ] Completar inventario/procurement con recepciones, movimientos y ledger idempotente; no se halló diff verificable de esta tarea en la cuarta ola.
- [ ] Confirmar conversión de propuesta B2B aceptada a pedido o evento formal de conversión.
- [ ] Integrar Operations Center con picking, envío y estados completos; la cola y acciones conectadas son un slice, no todo el fulfillment.
- [ ] Verificar y enlazar reseñas elegibles desde PDP; completar moderación con recorrido visual integrado.

### P2

- [ ] E2E conectado para checkout aprobado/rechazado, detalle de pedido, CRM/B2B y Support/RMA.
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
| `pnpm exec tsc --noEmit` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm test` | ✅ 148 Vitest + 18 Node |
| `pnpm test:e2e` | ✅ 15 Playwright demo/UX; no Checkout Auth conectado |
| `pnpm build` | ✅ Next.js producción, 32 páginas estáticas |
| `supabase db reset --local --yes` | ✅ migraciones y seed, incluida RMA/reviews |
| pgTAP `tests/database`, checkout y reviews | ✅ 179 aserciones |
| PostgreSQL RLS, role matrix, auth boundary, soporte/RMA | ✅ rollback scripts; la matriz fue corregida para usar el RPC de soporte |
| `supabase db lint --local --fail-on error` | ✅ sin errores de schema |
| `git diff --check` | ✅ |

## Criterio de cierre

Una feature queda ✅ solo con contrato integrado, autorización server/database, persistencia, estados de error/vacío, UX navegable y pruebas del recorrido principal. Gates locales no prueban producción ni sustituyen Auth/PostgREST E2E.
