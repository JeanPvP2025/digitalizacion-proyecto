# Estado del proyecto

Estado de integración del código al **2026-10-08** (`eddd4a0`). Los siete worktrees de profundidad se inspeccionaron e integraron; los seis commits de código aún no están en Vercel. El Supabase remoto `ypnhdxpejcbcyjiosrhf` no se modificó. El reset/seed descrito aquí se ejecutó únicamente contra Supabase local. El entorno alojado sigue sin certificación funcional de Auth/correo.

## Hallazgos de auditoría inicial (antes de la ola A)

- ✅ La portada, `/catalogo`, `/acceso`, `/configurador` y `/empresas` respondieron HTTP 200 en la comprobación actual; disponibilidad no equivale a comportamiento autenticado.
- ⚠️ Auth está bloqueando pruebas de usuarios: se reportan `email rate limit exceeded`, `Invalid login credentials` y error al canjear el enlace. El SMTP integrado de Supabase limita el envío y no es adecuado para uso público; verificar URL Configuration, callback y SMTP.
- ⚠️ `/catalogo` muestra 12 resultados; `supabase/seed.sql` define 12 productos y seis categorías amplias. Las doce fichas usan `NODRIA` como marca. Es insuficiente para que búsqueda/filtros/comparación transmitan sensación de tienda.
- ⚠️ La portada obtiene destacados de fixtures locales (`demoProducts`) incluso cuando el catálogo principal es conectado; alinear merchandising con la fuente activa.
- ⏳ `/blog`, `/guias`, `/marcas`, `/campanas` y `/categorias/ordenadores` respondieron 404. No hay ecosistema editorial o páginas de marca/campaña; `/servicios` requiere auditoría de profundidad.
- ⚠️ La PDP tiene contenido base y especificaciones, pero carece de galería editorial, guías/FAQ conectadas, alternativas estructuradas y merchandising por producto.
- ✅ La identidad y las transacciones permanecen explícitamente ficticias; conservar avisos de simulación y no solicitar datos de tarjeta.

## Séptima ola — integración de profundidad comercial

- ✅ **Catálogo conectado:** migración aditiva determinista añade 84 productos ficticios, 6 marcas y categorías jerárquicas; el reset/seed local resulta en 96 productos publicados, 27 categorías, 7 marcas y 96 variantes EUR activas. No se aplicó al proyecto remoto.
- ✅ **Descubrimiento:** filtros, conteos, categorías anidadas, marcas, precio, características técnicas, ordenación y URL persistente. Disponibilidad exacta solo se filtra en demo local; en Supabase se confirma durante checkout.
- ✅ **Portada:** selección de destacados, categorías y campaña desde la fuente de catálogo activa; ante error no sustituye catálogo conectado por fixtures.
- ✅ **PDP:** galería, especificaciones agrupadas, alternativas, guías enlazadas y compra por variante publicada. El servidor vuelve a validar precio/stock al checkout; añadir al carrito no reserva unidades.
- ✅ **Búsqueda:** ranking de nombre/SKU/marca/especificaciones, sinónimos y recuperación para cero resultados. El endpoint usa solo el catálogo activo.
- ✅ **Editorial:** `/blog`, `/blog/[slug]`, `/guias` y `/guias/[slug]` sirven seis artículos ficticios con enlaces al catálogo activo, metadatos y sitemap.
- ✅ **Auth UX/callback:** callback usa el origen actual y redirect local seguro; mensajes de error son accionables y el reenvío no es automático. Esto no elimina el límite del proveedor SMTP ni verifica Auth alojado.
- ⚠️ **Operación remota pendiente:** revisar y aplicar manualmente la migración `20261008135808_catalog_depth_dataset.sql` solo en el proyecto de staging tras respaldo/revisión; luego verificar filas y rutas en Vercel. No usar `db reset` ni `seed.sql` remoto.
- ⚠️ **Integración externa pendiente:** para estabilizar altas/recuperación, configurar Site URL/redirect allowlist de Supabase y SMTP propio; validar con una cuenta de prueba en `nodria-staging.vercel.app`.

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
- 🚧 **Experiencia y presentación:** storefront medido en Lighthouse local: portada móvil 92 (LCP simulado 3,2 s; traza observada local 0,56 s) y catálogo desktop 100. Sweeps UX cubren rutas anónimas, customer/B2B y roles internos en tres viewports; catálogo y shell de soporte están integrados. No se ha medido contraste/lector de pantalla exhaustivo en backoffice; no hay CrUX/INP ni URL pública.

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
| `pnpm test` | ✅ 288 Vitest + 18 Node |
| `pnpm test:e2e` | ✅ Suite base 17/17 y 2 E2E nuevos de editorial/PDP 2/2 |
| `pwsh -File tests/e2e/connected-domains/run.ps1` | ✅ 6/6 y teardown limpio; incluye cliente → aprobación soporte → inspección warehouse |
| `pwsh -File tests/e2e/checkout-connected/run.ps1` | ✅ 4/4; aprobado, rechazado, refresh/retry, payload distinto y concurrencia |
| `pwsh -File tests/e2e/ux-audit/run-roles.ps1` | ✅ 1/1; edición real de catálogo y denegaciones por rol |
| `pwsh -File tests/e2e/ux-audit/run-customer-b2b.ps1` | ✅ 1/1; customer + owner/admin/buyer/viewer, tenant y responsive |
| `pwsh -File tests/integration/b2b-connected/run.ps1` | ✅ 1/1; anticipo aprobado/rechazado, tenant, replay y fulfillment |
| `pnpm build` | ✅ producción; 39 páginas/rutas compiladas |
| `pnpm dlx supabase@latest db reset --local --yes` | ✅ 19 migraciones y seed aplicados en local; la primera ejecución detectó y permitió corregir una ambigüedad SQL de `parent_id` |
| `pnpm dlx supabase@latest test db --local tests/database` | ✅ 183 aserciones pgTAP |
| SQL runtime RLS/RBAC/Auth/support/inventory/procurement | ✅ scripts aplicados con fixtures transaccionales |
| `pnpm dlx supabase@latest db lint --local --schema public,private --level error --fail-on error` | ✅ sin errores de esquema |
| `tests/integration/support-flow/return-inspection.sql` | ✅ PostgreSQL local; autorización, cantidades, idempotencia, ledger, desecho, cierre/timeline |
| `tests/integration/support-flow/inspection-route.test.ts` | ✅ 4/4 |
| `pwsh -File tests/integration/auth-boundaries/run-local.ps1` | ✅ 78 probes HTTP autenticados; cero fallos |
| `node scripts/catalog/generate.mjs --check` | ✅ migración determinista |
| Catálogo local tras reset | ✅ 96 productos publicados, 27 categorías, 7 marcas, 96 variantes EUR activas |
| `git diff --check` | ✅ sin errores; Git advierte conversión LF/CRLF de Windows |

## Séptima ola — cierre de RMA y anticipo B2B

El Tech Lead implementó el siguiente slice después de verificar el backlog real: página protegida de cola de devoluciones, inspección por línea y almacén activo, motivo obligatorio, repetición idempotente, rechazo de payload distinto, ledger de reposición, desecho sin cambio de stock y cierre/timeline al completar todas las líneas. Roles de soporte/cliente no pueden inspeccionar; el RPC y las tablas privadas aplican controles en PostgreSQL además del route guard.

Verificación del slice: reset local aplicó 17 migraciones y seed; `tests/integration/support-flow/return-inspection.sql` pasó en PostgreSQL (autorización, cantidades, reposición/desecho, idempotencia incluso tras cerrar, conflicto de clave, timeline y stock). La route suite tiene 4 pruebas.

El mismo cierre de backlog incorporó anticipo B2B demo en una migración posterior: tenant owner/admin puede registrar resultado aprobado/rechazado, con idempotencia y registro de CRM. El runner aislado verifica permiso denegado a buyer, replay, payload diferente y liberación de reserva ante rechazo.

Warnings no bloqueantes conocidos: Node reporta `MODULE_TYPELESS_PACKAGE_JSON` en dos pruebas de módulos `.ts`; Playwright/Windows muestra conflicto `NO_COLOR`/`FORCE_COLOR`. El antiguo warning de estilo de caret en inputs no se ha atribuido al árbol React y requiere confirmar en navegador limpio.

## Backlog priorizado

### P0

- ⚠️ **Auth de la demo alojada:** corregir URL Configuration/allowlist y correo SMTP; verificar alta, confirmación, inicio y recuperación con una cuenta de prueba. Los errores reportados impiden llamar al entorno estable para usuarios.
- ✅ No se detectó caída HTTP en las rutas alojadas probadas; falta verificación funcional remota.
- ⚠️ No es un comercio real: checkout/pagos/envíos, clientes, productos y opiniones son ficticios; presentarlo como demo y mantener el límite visible.

### P1

- ⚠️ Revisar y aplicar en staging la migración aditiva del catálogo, luego validar el despliegue. La implementación y reset local pasan; el remoto aún no contiene estas 84 fichas.
- ⏳ Crear páginas de marcas, campañas y categoría landing (`/marcas`, `/campanas`, `/categorias/ordenadores`); el catálogo ya tiene datos de marcas y jerarquía pero esas rutas siguen sin existir.
- 🚧 Verificar en el entorno conectado PDP/variantes con precios reales de demo, checkout y catálogo poblado; las pruebas browser actuales usan datos demo locales y la migration no está desplegada.
- ⏳ Revisar `/servicios` y añadir historial operativo/CRM sintético repetible sin aparentar transacciones reales ni sobrescribir datos existentes.
- ✅ Matriz de permisos por rol y dominio documentada en `RBAC_MATRIX.md`, con 78 probes HTTP autenticados, pruebas SQL por dominios críticos y E2E de roles; no equivale a CRUD exhaustivo por columna ni prueba cada Server Action.
- ✅ **Escritura segura de catálogo:** migration revoca DML amplio y `update_catalog_product_editorial` aplica allowlist/rol en PostgreSQL. API de sesión, route/unit tests y E2E que edita y restaura un producto seed. Ver `docs/CATALOG_MANAGER_UI.md`.

### P2

- [x] Medir Lighthouse local en portada móvil y catálogo desktop; corregir contraste, nombres accesibles, objetivos táctiles e imágenes responsive. Evidencia detallada en `docs/PERFORMANCE_AUDIT.md` y `.seo-cache/`.
- [ ] Repetir CWV con la URL de producción y datos de campo cuando exista despliegue; el perfil Lighthouse móvil simulado aún da LCP 3,2 s, mientras que su traza observada en localhost da 0,56 s.
- [x] Ampliar el barrido E2E anónimo a 27 rutas, teclado, nombres de controles, enlaces/destinos y overflow en desktop, móvil (390 px) y tablet (768 px); detalle en `docs/UX_FINAL_AUDIT.md`.
- [x] Walkthrough responsive autenticado de roles internos en Supabase local efímero: support, sales, fulfillment, catalog (denegación documentada) y superadmin; evidencia en `docs/UX_FINAL_AUDIT.md`.
- [x] Recorrido Auth visual con sesión de cliente y membresías buyer/viewer/owner/admin, tenant ajeno y viewports 390/768/1280; sin mutaciones CRUD. Ver `docs/UX_CUSTOMER_B2B_AUDIT.md`.
- [x] Shell y navegación interna de `/soporte/agente` con saltos de teclado/estados y viewports 390/768/1280. Ver `docs/UX_STAFF_SHELL.md`.
- [ ] Medir contraste y revisar lector de pantalla de todas las superficies backoffice con tooling dedicado; E2E de nombre/foco/overflow no sustituye esa auditoría.
- [ ] Añadir historial sintético variado para CRM/operaciones de forma segura y repetible, sin crear eventos que parezcan transacciones reales ni sobrescribir datos existentes.
- [ ] Configurar dominio público para verificar `robots.txt`, sitemap, schema y metadatos en despliegue. En local se bloquea indexación deliberadamente para evitar publicar una demo sin dominio real.
- [ ] Identificar el origen del estilo `caret-color: transparent` que Playwright registra en la hidratación y resolver warnings de entorno sin alterar semántica del producto.

### P3

- [ ] CMS/blog, monedas/mercados adicionales, facturas/impuestos/pagos de proveedor y sistemas externos quedan fuera de los slices funcionales actuales; ampliar solo si la misión académica los exige.

## Criterio de cierre

Una feature solo es ✅ cuando su contrato, autorización servidor/DB, persistencia, estados de error/vacío, UX y recorrido principal están integrados y verificados. Un límite de demo debe expresarse en la UI y documentación. Los gates locales no certifican un entorno remoto.

## Cierre de rendimiento/accesibilidad local — 2026-10-07

- TypeScript, lint, build (38 rutas), pruebas (179 Vitest + 18 Node) y E2E demo/UX (17/17) pasan después de los cambios de storefront.
- Portada móvil Lighthouse 92 / accesibilidad 100; catálogo desktop 100 / accesibilidad 100. Contraste, nombres accesibles, objetivos táctiles y optimización de imágenes pasan en las rutas medidas.
- Métricas completas y límites de laboratorio en `docs/PERFORMANCE_AUDIT.md`; se ignoran los datos crudos en `.seo-cache/`.
- No se ha aplicado despliegue ni se afirma certificación de producción.

## Auditoría UX final local — 2026-10-07; integración verificada 2026-10-08

- Suite demo/UX: 17/17; el barrido de `tests/e2e/ux-audit/ux-audit.spec.ts` ahora incluye 27 rutas, Desktop Chrome 1280 × 720, móvil 390 × 844 y tablet 768 × 1024, sin overflow horizontal de página ni controles visibles sin nombre en las rutas inspeccionadas.
- Teclado, búsqueda/sugerencias, errores B2B, foco al primer campo inválido, estado de checkout vacío y navegación interna pasan. TypeScript y lint pasan.
- El backoffice se recorrió en estado anónimo y con cinco roles internos en un Supabase local efímero; no se mutaron los contenedores compartidos. Roles internos cubiertos a 1280/390/768 px. Cliente y membresías B2B siguen pendientes.
- Se corrigió el callejón sin salida de moderación: `/backoffice/reviews` ofrece “Volver a operaciones” en estados de contenido, no disponible, error y permiso denegado; el E2E prueba su navegación por teclado.
- La bandeja `/soporte/agente` conserva cabecera/pie del storefront y carece de navegación entre herramientas internas; queda como riesgo UX P2 para un shell de equipo.
- No se repitió Lighthouse: sus valores y alcance siguen en `docs/PERFORMANCE_AUDIT.md`. No se midió contraste del backoffice ni se validó producción.
- Playwright volvió a mostrar `style="caret-color: transparent"` en la hidratación y warnings `NO_COLOR`/`FORCE_COLOR`; no se atribuyen a la aplicación ni se modificó CSS global.
- Informe completo: `docs/UX_FINAL_AUDIT.md`.

### Revalidación de integración — 2026-10-08

- `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (179 Vitest + 18 Node), `pnpm test:e2e` (17/17), `pnpm build` (38 rutas) y `pwsh -File tests/e2e/ux-audit/run-roles.ps1` (1/1 en Supabase efímero) pasan sobre la integración.
- La suite Auth vuelve a mostrar `The destination stream errored while writing data` durante navegación; el test terminó aprobado y el runner detuvo su proyecto Supabase aislado. El origen del mensaje sigue sin atribuirse.
- `git diff --check` pasa tras quitar espacios finales del nuevo informe. Warnings restantes de Node `MODULE_TYPELESS_PACKAGE_JSON` y Playwright `NO_COLOR`/`FORCE_COLOR` no afectan los resultados.

## Integración de UX y catálogo — 2026-10-08

- Cerrada la ola 8: shell de soporte, recorrido visual customer/B2B autenticado, frontera SQL de catálogo y UI de catálogo están integrados. La migración real usa `update_catalog_product_editorial`, no el nombre provisional `update_catalog_product` que aparecía en el tablero anterior.
- El gate demo inicialmente descubrió por error el spec customer/B2B, que requiere un proyecto Supabase aislado. `playwright.config.ts` ahora excluye ese spec, igual que excluye checkout conectado, dominios y roles; el runner dedicado sigue siendo el único responsable de la suite. La ejecución completa del gate se repite tras el cambio.
- Riesgos locales restantes: auditoría dedicada de contraste/lector de pantalla del backoffice, warning de hidratación del caret sin origen atribuido y UX/product polish no bloqueante. No son autorización para etiquetar esas áreas como auditadas.
- Bloqueos fuera del repo: proyecto/credenciales Supabase remotos, dominio, despliegue y CWV/CrUX de campo. Ningún cambio local puede sustituir esa configuración externa.
