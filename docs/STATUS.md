# Estado del proyecto

Estado observado el **2026-10-07** después de integrar la sexta ola. Git, código, migraciones y pruebas locales prevalecen sobre estados anteriores de los agentes. No existe un proyecto Supabase remoto configurado ni se ha probado un despliegue de producción.

## Estado funcional

- ✅ **Checkout B2C conectado:** sesión Auth real, variante/precio/stock validados en servidor, pedido y líneas con snapshots, pago demo simulado, reservas transaccionales, rechazo/retry y control de idempotencia. 4/4 pruebas browser conectadas pasan.
- ✅ **Catálogo, búsqueda, carrito y PC Builder comprable:** el configurador añade variantes publicadas al carrito; el checkout vuelve a validar los datos de negocio. Hay pruebas de compatibilidad del slice, aunque ampliar la cobertura de compatibilidades sigue en calidad pendiente.
- ✅ **Reviews:** elegibilidad por línea entregada, moderación protegida, lectura pública solo de publicadas y acceso desde PDP.
- ✅ **CRM/B2B hasta pedido formal:** cotización aceptada puede emitir un pedido formal tenant-scoped, conserva precios/direcciones en snapshots y crea el vínculo comercial. El pedido queda `pending_payment` bajo anticipo; la captura/liquidación del anticipo es un límite pendiente y el pedido no se expide antes.
- ✅ **Inventario y procurement básico:** ledger idempotente de movimientos, proveedores, órdenes de compra, recepciones parciales/finales vinculadas al movimiento y control de sobre-recepción.
- ✅ **Fulfillment:** pedido pagado pasa por picking, packing y expedición con timeline y consumo de reserva. La secuencia y autorización están cubiertas en PostgreSQL.
- 🚧 **Support/RMA:** tickets, conversación, decisión de devolución y reembolso demo idempotente funcionan. Las unidades aprobadas quedan en `pending_inspection`; todavía falta escaneo/recepción física y disposición autorizada (reponer o desechar).
- 🚧 **Analytics:** KPIs consultan filas operativas y ocultan totales inconsistentes; se necesitan checks de reconciliación por métrica/rango y cobertura de filtros antes de cerrar el módulo.
- 🚧 **Demo Mode:** el modo no elude autorización y no hace fallback a datos demo cuando Supabase está configurado; falta un recorrido repetible por roles y reset determinista de datos demo.
- 🚧 **Seguridad/Auth:** aislamiento, escalada, permisos sensibles y boundaries HTTP locales verificados; la matriz no es un CRUD exhaustivo de cada tabla/campo/endpoint. `manager` y `marketing` no son roles persistidos y no deben recibir permisos implícitos.
- 🚧 **Experiencia y presentación:** E2E cubre rutas clave, pero no se ha hecho una auditoría visual completa en todos los breakpoints, medición Lighthouse/CWV ni auditoría integral de SEO/contenido. No hay CMS/blog editorial.

## Sexta ola integrada

Se inspeccionaron commits y diffs reales de las cinco conversaciones/worktrees; el cambio de QA que aún estaba sin commit y los ajustes de prueba de integración se rescataron. Commits integrados en la rama actual:

- `4e7d1e6` — proveedores, órdenes de compra y recepciones vinculadas.
- `8946f7e` — etapas de fulfillment conectado.
- `68c6dfa` — pedido formal desde presupuesto B2B aceptado.
- `25c074d` — suite B2B conectada en Supabase aislado.
- `2f4599c` — efectos de negocio al aprobar RMA.
- `2f17bd2` — QA conectado de dominios y analytics.

La prueba E2E transversal verifica permisos de emisión B2B sin crear pedidos residuales; el flujo real de pedido B2B se cubre en el runner aislado de ese dominio. Se corrigieron conteos absolutos de filas de seed en el test de aislamiento RLS. El reset de Supabase local limpió fixtures residuales y reaplicó las 15 migraciones y seed.

## Gates de integración

| Check | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ validado en la integración de esta ola |
| `pnpm exec tsc --noEmit` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm test` | ✅ 175 Vitest + 18 Node |
| `pnpm test:e2e` | ✅ 17/17 |
| `pwsh -File tests/e2e/connected-domains/run.ps1` | ✅ 5/5 y teardown limpio |
| `pwsh -File tests/e2e/checkout-connected/run.ps1` | ✅ 4/4; aprobado, rechazado, refresh/retry, payload distinto y concurrencia (verificación integrada previa) |
| runner B2B aislado | ✅ 1/1; pedido formal y límites tenant/stock (verificación integrada previa) |
| `pnpm build` | ✅ producción; 36 páginas/rutas compiladas |
| `pnpm dlx supabase@latest db reset --local --yes` | ✅ 15 migraciones y seed aplicados |
| pgTAP database/checkout/reviews/fulfillment | ✅ 265 aserciones |
| SQL runtime RLS/RBAC/Auth/support/inventory/procurement | ✅ scripts aplicados con fixtures transaccionales |
| `pnpm dlx supabase@latest db lint --local --fail-on error` | ✅ sin errores de esquema |
| `git diff --check` | pendiente tras cerrar documentación/commit |

Warnings no bloqueantes conocidos: Node reporta `MODULE_TYPELESS_PACKAGE_JSON` en dos pruebas de módulos `.ts`; Playwright/Windows muestra conflicto `NO_COLOR`/`FORCE_COLOR`. El antiguo warning de estilo de caret en inputs no se ha atribuido al árbol React y requiere confirmar en navegador limpio.

## Backlog priorizado

### P0

- ✅ No hay bloqueo P0 reproducible en el stack local tras esta ola.
- ⛔ **Go-live remoto:** no-go hasta disponer de proyecto/credenciales, redirects/secret management, migraciones remotas y pruebas de despliegue; no está dentro de los gates locales.

### P1

- [ ] Completar recepción física e inspección de RMA, con disposición auditada y una sola actualización de stock; probar cantidades, repetición y permisos de almacén.
- [ ] Cerrar el pago/anticipo de pedidos B2B o dejar explícito como límite de demo en UI, estados, documentación y guion; impedir expedición mientras no se registre el anticipo esperado.
- [ ] Completar Demo Mode por rol con reset local reproducible y recorrido de storefront, CRM, soporte y almacén sin credenciales privilegiadas cliente.
- [ ] Completar una matriz de permisos defensible por acción/ruta/RPC y ampliar pruebas HTTP de roles persistidos; no inventar grants para `manager`/`marketing`.
- [ ] Reconciliar KPIs operativos con casos de negocio (definición, filtro, fuente, rango y zona horaria) y cubrir inconsistencia de cada métrica.

### P2

- [ ] Hacer auditoría visual/manual responsive y accesible en storefront y backoffice, con navegación teclado, diálogos, formularios, tablas, errores, carga y vacío.
- [ ] Medir Lighthouse/CWV y revisar bundle/imagenes/consultas con resultados reproducibles.
- [ ] Auditar navegación, filtros y acciones de rutas restantes para localizar fake completeness; priorizar controles visibles que no persisten.
- [ ] Completar metadatos, schema/sitemap y contenido público; blog/CMS se mantiene fuera de alcance si no es requisito académico.
- [ ] Confirmar el warning de caret en navegador limpio y reducir warnings Node si se puede sin cambiar semántica del proyecto.

### P3

- [ ] CMS/blog completo, monedas/mercados adicionales, facturas/impuestos/pagos de proveedor y sistemas externos, solo si se amplía el alcance académico.

## Criterio de cierre

Una feature solo es ✅ cuando su contrato, autorización servidor/DB, persistencia, estados de error/vacío, UX y recorrido principal están integrados y verificados. Un límite de demo debe expresarse en la UI y documentación. Los gates locales no certifican un entorno remoto.
