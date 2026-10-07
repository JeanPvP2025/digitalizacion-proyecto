# Estado del proyecto

Estado observado el **2026-10-07** después de integrar la sexta ola y cerrar localmente RMA, anticipo B2B, bootstrap de roles demo y reconciliación de KPIs. Git, código, migraciones y pruebas locales prevalecen sobre estados anteriores de los agentes. No existe un proyecto Supabase remoto configurado ni se ha probado un despliegue de producción.

## Estado funcional

- ✅ **Checkout B2C conectado:** sesión Auth real, variante/precio/stock validados en servidor, pedido y líneas con snapshots, pago demo simulado, reservas transaccionales, rechazo/retry y control de idempotencia. 4/4 pruebas browser conectadas pasan.
- ✅ **Catálogo, búsqueda, carrito y PC Builder comprable:** el configurador añade variantes publicadas al carrito; el checkout vuelve a validar los datos de negocio. Hay pruebas de compatibilidad del slice, aunque ampliar la cobertura de compatibilidades sigue en calidad pendiente.
- ✅ **Reviews:** elegibilidad por línea entregada, moderación protegida, lectura pública solo de publicadas y acceso desde PDP.
- ✅ **CRM/B2B hasta pago demo:** cotización aceptada emite pedido formal tenant-scoped con snapshots/reserva; owner/admin simula anticipo aprobado o rechazado. Aprobado guarda pago, pedido, actividad CRM y eventos idempotentes; rechazado cancela y libera reserva. No se recogen datos de tarjeta ni se procesa dinero real.
- ✅ **Inventario y procurement básico:** ledger idempotente de movimientos, proveedores, órdenes de compra, recepciones parciales/finales vinculadas al movimiento y control de sobre-recepción.
- ✅ **Fulfillment:** pedido pagado pasa por picking, packing y expedición con timeline y consumo de reserva. La secuencia y autorización están cubiertas en PostgreSQL.
- ✅ **Support/RMA local:** ticket, conversación, revisión/reembolso demo, inspección de almacén y disposición por línea funcionan. Reponer incrementa `on_hand` una sola vez mediante ledger; desechar no incrementa stock; al inspeccionar todas las líneas la devolución se cierra con evento de timeline. Falta recorrido browser autenticado del panel de almacén.
- ✅ **Analytics del alcance publicado:** pedidos, ventas brutas aprobadas, aprobación de pago, inventario disponible y conversión de solicitudes CRM tienen fórmula, fuente, periodo de 30 días Europe/Madrid, límites y fixtures puros/SQL/E2E; el dashboard falla cerrado ante discrepancias. Ventas netas, margen, visitas y conversión específica de cotizaciones B2B no se presentan como KPIs todavía.
- ✅ **Demo Mode local:** modo de archivos limitado a desarrollo y sin Auth; Supabase configurado siempre gana y falla cerrado. La guía cubre reset local y organización ficticia; `scripts/demo/assign-staff-roles.ps1` asigna en loopback grants de los cinco roles internos a cuentas Auth locales ya creadas, sin crear ni almacenar contraseñas. Se ejecutó y verificó que escribe exactamente un grant por rol; `db reset --local` los elimina.
- ✅ **Seguridad/Auth local:** aislamiento, escalada, permisos sensibles y boundaries HTTP verificados con matriz documentada, suites SQL y 78 probes autenticados; esto no certifica un entorno remoto ni prueba CRUD exhaustivo por cada campo/endpoint. `manager` y `marketing` no son roles persistidos y no reciben permisos implícitos.
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
| `pnpm install --frozen-lockfile` | ✅ validado en el cierre coordinador |
| `pnpm exec tsc --noEmit` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm test` | ✅ 179 Vitest + 18 Node |
| `pnpm test:e2e` | ✅ 17/17 |
| `pwsh -File tests/e2e/connected-domains/run.ps1` | ✅ 5/5 y teardown limpio |
| `pwsh -File tests/e2e/checkout-connected/run.ps1` | ✅ 4/4; aprobado, rechazado, refresh/retry, payload distinto y concurrencia |
| `pwsh -File tests/e2e/connected-domains/run.ps1` | ✅ 5/5; teardown limpio |
| `pwsh -File tests/integration/b2b-connected/run.ps1` | ✅ 1/1; anticipo aprobado/rechazado, tenant, replay y fulfillment |
| `pnpm build` | ✅ producción; 38 páginas/rutas compiladas |
| `pnpm dlx supabase@latest db reset --local --yes` | ✅ 17 migraciones y seed aplicados |
| pgTAP database/checkout/reviews | ✅ 230 aserciones |
| SQL runtime RLS/RBAC/Auth/support/inventory/procurement | ✅ scripts aplicados con fixtures transaccionales |
| `pnpm dlx supabase@latest db lint --local --fail-on error` | ✅ sin errores de esquema |
| `tests/integration/support-flow/return-inspection.sql` | ✅ PostgreSQL local; autorización, cantidades, idempotencia, ledger, desecho, cierre/timeline |
| `tests/integration/support-flow/inspection-route.test.ts` | ✅ 4/4 |
| `pwsh -File tests/integration/auth-boundaries/run-local.ps1` | ✅ 78 probes HTTP autenticados; cero fallos |
| `git diff --check` | ✅ |

## Séptima ola — cierre de RMA y anticipo B2B

El Tech Lead implementó el siguiente slice después de verificar el backlog real: página protegida de cola de devoluciones, inspección por línea y almacén activo, motivo obligatorio, repetición idempotente, rechazo de payload distinto, ledger de reposición, desecho sin cambio de stock y cierre/timeline al completar todas las líneas. Roles de soporte/cliente no pueden inspeccionar; el RPC y las tablas privadas aplican controles en PostgreSQL además del route guard.

Verificación del slice: reset local aplicó 17 migraciones y seed; `tests/integration/support-flow/return-inspection.sql` pasó en PostgreSQL (autorización, cantidades, reposición/desecho, idempotencia incluso tras cerrar, conflicto de clave, timeline y stock). La route suite tiene 4 pruebas.

El mismo cierre de backlog incorporó anticipo B2B demo en una migración posterior: tenant owner/admin puede registrar resultado aprobado/rechazado, con idempotencia y registro de CRM. El runner aislado verifica permiso denegado a buyer, replay, payload diferente y liberación de reserva ante rechazo.

Warnings no bloqueantes conocidos: Node reporta `MODULE_TYPELESS_PACKAGE_JSON` en dos pruebas de módulos `.ts`; Playwright/Windows muestra conflicto `NO_COLOR`/`FORCE_COLOR`. El antiguo warning de estilo de caret en inputs no se ha atribuido al árbol React y requiere confirmar en navegador limpio.

## Backlog priorizado

### P0

- ✅ No hay bloqueo P0 reproducible en el stack local tras esta ola.
- ⛔ **Go-live remoto:** no-go hasta disponer de proyecto/credenciales, redirects/secret management, migraciones remotas y pruebas de despliegue; no está dentro de los gates locales.

### P1

- ✅ Matriz de permisos por rol y dominio documentada en `RBAC_MATRIX.md`, con 78 probes HTTP autenticados y pruebas SQL por dominios críticos. La matriz declara expresamente sus límites: no equivale a CRUD exhaustivo por columna ni prueba cada Server Action.

### P2

- [ ] Hacer auditoría visual/manual responsive y accesible en storefront y backoffice, con navegación teclado, diálogos, formularios, tablas, errores, carga y vacío.
- [ ] Medir Lighthouse/CWV y revisar bundle/imagenes/consultas con resultados reproducibles.
- [ ] Auditar navegación, filtros y acciones de rutas restantes para localizar fake completeness; priorizar controles visibles que no persisten.
- [ ] Completar un recorrido browser autenticado de almacén/RMA y una revisión manual de todos los roles demo después del bootstrap local.
- [ ] Completar metadatos, schema/sitemap y contenido público; blog/CMS se mantiene fuera de alcance si no es requisito académico.
- [ ] Confirmar el warning de caret en navegador limpio y reducir warnings Node si se puede sin cambiar semántica del proyecto.

### P3

- [ ] CMS/blog completo, monedas/mercados adicionales, facturas/impuestos/pagos de proveedor y sistemas externos, solo si se amplía el alcance académico.

## Criterio de cierre

Una feature solo es ✅ cuando su contrato, autorización servidor/DB, persistencia, estados de error/vacío, UX y recorrido principal están integrados y verificados. Un límite de demo debe expresarse en la UI y documentación. Los gates locales no certifican un entorno remoto.
