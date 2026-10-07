# Estado del proyecto

Estado observado el **2026-10-07** después de integrar la sexta ola, cerrar localmente RMA/anticipo B2B/bootstrap de demo y ejecutar una auditoría Lighthouse de dos rutas. Git, código, migraciones y pruebas locales prevalecen sobre estados anteriores de los agentes. No existe un proyecto Supabase remoto configurado ni se ha probado un despliegue de producción.

## Estado funcional

- ✅ **Checkout B2C conectado:** sesión Auth real, variante/precio/stock validados en servidor, pedido y líneas con snapshots, pago demo simulado, reservas transaccionales, rechazo/retry y control de idempotencia. 4/4 pruebas browser conectadas pasan.
- ✅ **Catálogo, búsqueda, carrito y PC Builder comprable:** el configurador añade variantes publicadas al carrito; el checkout vuelve a validar los datos de negocio. Hay pruebas de compatibilidad del slice, aunque ampliar la cobertura de compatibilidades sigue en calidad pendiente.
- ✅ **Reviews:** elegibilidad por línea entregada, moderación protegida, lectura pública solo de publicadas y acceso desde PDP.
- ✅ **CRM/B2B hasta pago demo:** cotización aceptada emite pedido formal tenant-scoped con snapshots/reserva; owner/admin simula anticipo aprobado o rechazado. Aprobado guarda pago, pedido, actividad CRM y eventos idempotentes; rechazado cancela y libera reserva. No se recogen datos de tarjeta ni se procesa dinero real.
- ✅ **Inventario y procurement básico:** ledger idempotente de movimientos, proveedores, órdenes de compra, recepciones parciales/finales vinculadas al movimiento y control de sobre-recepción.
- ✅ **Fulfillment:** pedido pagado pasa por picking, packing y expedición con timeline y consumo de reserva. La secuencia y autorización están cubiertas en PostgreSQL.
- ✅ **Support/RMA local:** ticket, conversación, revisión/reembolso demo, inspección de almacén y disposición por línea funcionan. Reponer incrementa `on_hand` una sola vez mediante ledger; desechar no incrementa stock; al inspeccionar todas las líneas la devolución se cierra con evento de timeline. El recorrido browser conectado cliente → soporte → almacén queda cubierto.
- ✅ **Analytics del alcance publicado:** pedidos, ventas brutas aprobadas, aprobación de pago, inventario disponible y conversión de solicitudes CRM tienen fórmula, fuente, periodo de 30 días Europe/Madrid, límites y fixtures puros/SQL/E2E; el dashboard falla cerrado ante discrepancias. Ventas netas, margen, visitas y conversión específica de cotizaciones B2B no se presentan como KPIs todavía.
- ✅ **Demo Mode local:** modo de archivos limitado a desarrollo y sin Auth; Supabase configurado siempre gana y falla cerrado. La guía cubre reset local y organización ficticia; `scripts/demo/assign-staff-roles.ps1` asigna en loopback grants de los cinco roles internos a cuentas Auth locales ya creadas, sin crear ni almacenar contraseñas. Se ejecutó y verificó que escribe exactamente un grant por rol; `db reset --local` los elimina.
- ✅ **Seguridad/Auth local:** aislamiento, escalada, permisos sensibles y boundaries HTTP verificados con matriz documentada, suites SQL y 78 probes autenticados; esto no certifica un entorno remoto ni prueba CRUD exhaustivo por cada campo/endpoint. `manager` y `marketing` no son roles persistidos y no reciben permisos implícitos.
- 🚧 **Experiencia y presentación:** storefront medido en Lighthouse local: portada móvil 92 (LCP simulado 3,2 s; traza observada local 0,56 s) y catálogo desktop 100. Se añadieron sweeps UX de 27 rutas y roles internos en tres viewports. Customer/B2B Auth, contraste/lector de pantalla en backoffice, la UI de catálogo y el shell de soporte siguen pendientes; no hay CrUX/INP ni URL pública.

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
| `pwsh -File tests/e2e/connected-domains/run.ps1` | ✅ 6/6 y teardown limpio; incluye cliente → aprobación soporte → inspección warehouse |
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

- [x] Medir Lighthouse local en portada móvil y catálogo desktop; corregir contraste, nombres accesibles, objetivos táctiles e imágenes responsive. Evidencia detallada en `docs/PERFORMANCE_AUDIT.md` y `.seo-cache/`.
- [ ] Repetir CWV con la URL de producción y datos de campo cuando exista despliegue; el perfil Lighthouse móvil simulado aún da LCP 3,2 s, mientras que su traza observada en localhost da 0,56 s.
- [x] Ampliar el barrido E2E anónimo a 27 rutas, teclado, nombres de controles, enlaces/destinos y overflow en desktop, móvil (390 px) y tablet (768 px); detalle en `docs/UX_FINAL_AUDIT.md`.
- [x] Walkthrough responsive autenticado de roles internos en Supabase local efímero: support, sales, fulfillment, catalog (denegación documentada) y superadmin; evidencia en `docs/UX_FINAL_AUDIT.md`.
- [ ] Completar recorrido con sesión de cliente y membresías buyer/viewer/owner/admin; las vistas de portal B2B y cuenta siguen sin prueba visual autenticada por rol.
- [ ] Añadir una UI interna de catálogo para `catalog_manager` o retirar la expectativa de gestión de catálogo como capacidad visual del demo.
- [ ] Configurar dominio público para verificar `robots.txt`, sitemap, schema y metadatos en despliegue. En local se bloquea indexación deliberadamente para evitar publicar una demo sin dominio real.
- [ ] Identificar el origen del estilo `caret-color: transparent` que Playwright registra en la hidratación y resolver warnings de entorno sin alterar semántica del producto.

### P3

- [ ] CMS/blog completo, monedas/mercados adicionales, facturas/impuestos/pagos de proveedor y sistemas externos, solo si se amplía el alcance académico.

## Criterio de cierre

Una feature solo es ✅ cuando su contrato, autorización servidor/DB, persistencia, estados de error/vacío, UX y recorrido principal están integrados y verificados. Un límite de demo debe expresarse en la UI y documentación. Los gates locales no certifican un entorno remoto.

## Cierre de rendimiento/accesibilidad local — 2026-10-07

- TypeScript, lint, build (38 rutas), pruebas (179 Vitest + 18 Node) y E2E demo/UX (17/17) pasan después de los cambios de storefront.
- Portada móvil Lighthouse 92 / accesibilidad 100; catálogo desktop 100 / accesibilidad 100. Contraste, nombres accesibles, objetivos táctiles y optimización de imágenes pasan en las rutas medidas.
- Métricas completas y límites de laboratorio en `docs/PERFORMANCE_AUDIT.md`; se ignoran los datos crudos en `.seo-cache/`.
- No se ha aplicado despliegue ni se afirma certificación de producción.

## Auditoría UX final local — 2026-10-07

- Suite demo/UX: 17/17; el barrido de `tests/e2e/ux-audit/ux-audit.spec.ts` ahora incluye 27 rutas, Desktop Chrome 1280 × 720, móvil 390 × 844 y tablet 768 × 1024, sin overflow horizontal de página ni controles visibles sin nombre en las rutas inspeccionadas.
- Teclado, búsqueda/sugerencias, errores B2B, foco al primer campo inválido, estado de checkout vacío y navegación interna pasan. TypeScript y lint pasan.
- El backoffice se recorrió en estado anónimo y con cinco roles internos en un Supabase local efímero; no se mutaron los contenedores compartidos. Roles internos cubiertos a 1280/390/768 px. Cliente y membresías B2B siguen pendientes.
- Se corrigió el callejón sin salida de moderación: `/backoffice/reviews` ofrece “Volver a operaciones” en estados de contenido, no disponible, error y permiso denegado; el E2E prueba su navegación por teclado.
- La bandeja `/soporte/agente` conserva cabecera/pie del storefront y carece de navegación entre herramientas internas; queda como riesgo UX P2 para un shell de equipo.
- No se repitió Lighthouse: sus valores y alcance siguen en `docs/PERFORMANCE_AUDIT.md`. No se midió contraste del backoffice ni se validó producción.
- Playwright volvió a mostrar `style="caret-color: transparent"` en la hidratación y warnings `NO_COLOR`/`FORCE_COLOR`; no se atribuyen a la aplicación ni se modificó CSS global.
- Informe completo: `docs/UX_FINAL_AUDIT.md`.
