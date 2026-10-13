# Estado del proyecto

## Iteración activa: tienda propia con checkout simulado — 2026-10-13

- ✅ El propietario confirmó previamente en Supabase 64 modelos publicados, 64 fotos únicas y ocho opciones por clase.
- ✅ La tienda se queda dentro de NODRIA: catálogo, fichas, búsqueda, PC Builder→carrito→checkout y pedidos internos; ya no hay enlaces/copy de compra externa. El pago demo se aprueba automáticamente, no pide tarjeta ni mueve dinero. Las reseñas reales requieren pedido entregado y moderación; las muestras se etiquetan y no cuentan.
- ✅ Gates locales: instalación congelada, TypeScript, ESLint, 293 Vitest + 26 Node, E2E 18/18, build y `git diff --check`.
- ⏳ Falta ejecutar manualmente `supabase/migrations/20261013120000_nodria_storefront_checkout.sql` en el proyecto Supabase correcto y confirmar sus funciones/stock.
- ⏳ Después de aplicar la migración, publicar en Vercel y recorrer una compra conectada autenticada.
- ⚠️ No se ejecutaron reset/pgTAP/DB lint: Docker Desktop no tiene activo el motor. La migración remota tampoco se aplicó ni se verificó en esta sesión.
- ⚠️ Los modelos, precios observados e imágenes son reales; stock/pedidos/pago/envíos son ficticios. Las licencias de imágenes remotas siguen por verificar para uso comercial.
- ⚠️ Playwright imprime una advertencia de hidratación por `caret-color: transparent` en inputs; las 17 pruebas pasan. El árbol de trabajo está en `main` y aún no se ha commiteado ni desplegado.

## Corte previo de catálogo de consulta (histórico)

Actualización de catálogo **2026-10-13**. La migración está aplicada en Supabase Production; el operador confirmó 64 modelos, 64 fotos únicas y ocho productos en cada una de las ocho clases. El commit `8ea5b78` está en `main` y Vercel informó `success`; `/`, `/catalogo` y `/configurador` responden HTTP 200. Esto valida el catálogo y su despliegue, no todos los flujos autenticados de la aplicación.

El catálogo local ahora contiene **64 referencias reales** de PcComponentes España: modelos y números de fabricante exactos, precio consultado el 13/10/2026, ficha de vendedor y foto comercial individual. Hay 8 productos por cada una de las 8 clases del PC Builder. Las 64 imágenes devolvieron `200 image/jpeg` y sus 64 cuerpos tienen hashes distintos.

- ✅ **Modelos, precios y fotos:** dataset local sin productos sintéticos visibles; cada precio tiene vendedor y fecha, cada producto enlaza a su propia ficha, y no se muestran reseñas ni stock inventados.
- ✅ **Límite comercial:** NODRIA no es PcComponentes ni otro vendedor. El catálogo y el configurador son de consulta; el modo demo no ofrece carrito de compra, cobro, envío ni devoluciones.
- ✅ **Supabase remoto:** migración aplicada y conteos verificados por el operador en SQL Editor: 64 modelos, 64 imágenes distintas y 8 por cada clase del configurador.
- ✅ **Vercel:** commit `8ea5b78` desplegado; Vercel informó `success`. Smoke HTTP: `/`, `/catalogo` y `/configurador` responden 200; catálogo y configurador muestran 64 referencias.
- 🚧 **Entrega global:** listo como demo académica de catálogo/configurador. No certificar como comercio electrónico operativo: compra/cobro/envío están deliberadamente desactivados y no se hizo una prueba remota autenticada de todos los roles, Auth y RLS.
- ⚠️ **Uso de fotografías:** se enlazan las imágenes del catálogo público de PcComponentes. Un uso comercial de NODRIA requeriría permiso/licencia del titular; el proyecto sigue siendo una demo académica.

### Catálogo verificado y checkout de solo consulta — 2026-10-13

- ✅ El storefront local, búsqueda, fichas de producto, favoritos, comparación y PC Builder leen las mismas referencias exactas.
- ✅ Las tarjetas y fichas usan la foto única de la ficha del vendedor. Las 64 respuestas fueron JPEG válidos con contenido distinto. La fecha del precio se muestra como observación, no como precio vigente garantizado.
- ✅ En modo demo, `/checkout` explica que la compra se realiza directamente con el vendedor y no solicita datos, simula pagos ni crea pedidos.
- ✅ `pnpm install --frozen-lockfile`, TypeScript, ESLint, `pnpm test` (289 Vitest + 26 Node), `pnpm test:e2e` (17/17), `pnpm build` y `git diff --check` pasan localmente. La build generó 40 páginas estáticas; las fotos se verificaron por HTTP y el E2E comprobó el uso de `next/image`.
- ⚠️ Playwright sigue mostrando el aviso de hidratación `caret-color: transparent` en campos; no aparece en el código del proyecto y no afecta al resultado de las pruebas. Windows también informa del cambio esperado de finales LF/CRLF.

## Histórico de salida inicial — 2026-10-09

Las notas de despliegue y PC Builder a continuación describen el estado de esa fecha; quedan supersedidas por la revisión actual de 2026-10-12.

### Actualización PC Builder — 2026-10-09

- 🚧 El dataset ampliado conserva las 32 piezas originales y añade 32 piezas, con ocho variantes en cada una de las ocho clases.
- ✅ El nuevo catálogo incluye opciones sintéticas AM4/DDR4 y AM5/DDR5; las tarjetas de elección se ordenan por precio ascendente.
- ✅ La nueva migración es determinista, aditiva, detecta colisiones y no cambia tablas, RLS, permisos ni filas existentes.
- ⏳ Ejecutar `supabase/migrations/20261009113024_pc_builder_catalog_expansion.sql` en el Supabase de staging. Hasta entonces la interfaz seguirá mostrando únicamente las opciones que ya estén publicadas.

### Estado de salida a producción — verificación 2026-10-08

- ✅ `pnpm install --frozen-lockfile`, TypeScript, ESLint, `pnpm test` (288 Vitest + 39 Node), `pnpm test:e2e` (19/19), `pnpm build` (38 páginas estáticas generadas) y `git diff --check` pasan localmente.
- ✅ Los diez commits locales se publicaron en `origin/main`; Vercel registró `4ed17f3` como Production success. Las rutas nuevas pasaron el smoke check HTTP.
- ⚠️ Datos alojados: `/marcas` solo lista NODRIA; verificar el dataset con SQL. No ejecutar `seed.sql` ni `db reset` en el proyecto remoto.
- ⚠️ Auth alojado: falta probar confirmación, inicio y recuperación con SMTP y redirect allowlist verificados. No se enviaron correos de prueba desde esta sesión.
- ⚠️ El deployment se sirve en `nodria-staging.vercel.app`; no hay dominio propio configurado. No se certificó compra, correo ni RLS en el entorno remoto.

## Hallazgos de auditoría inicial (histórico, antes de la ola A)

- ✅ En la auditoría original la portada, `/catalogo`, `/acceso`, `/configurador` y `/empresas` respondieron HTTP 200; disponibilidad no equivale a comportamiento autenticado.
- ⚠️ Auth está bloqueando pruebas de usuarios: se reportan `email rate limit exceeded`, `Invalid login credentials` y error al canjear el enlace. El SMTP integrado de Supabase limita el envío y no es adecuado para uso público; verificar URL Configuration, callback y SMTP.
- ⚠️ `/catalogo` muestra 12 resultados; `supabase/seed.sql` define 12 productos y seis categorías amplias. Las doce fichas usan `NODRIA` como marca. Es insuficiente para que búsqueda/filtros/comparación transmitan sensación de tienda.
- ⚠️ La portada obtiene destacados de fixtures locales (`demoProducts`) incluso cuando el catálogo principal es conectado; alinear merchandising con la fuente activa.
- ⏳ `/blog`, `/guias`, `/marcas`, `/campanas` y `/categorias/ordenadores` respondieron 404. No hay ecosistema editorial o páginas de marca/campaña; `/servicios` requiere auditoría de profundidad.
- ⚠️ La PDP tiene contenido base y especificaciones, pero carece de galería editorial, guías/FAQ conectadas, alternativas estructuradas y merchandising por producto.
- ✅ La identidad y las transacciones permanecen explícitamente ficticias; conservar avisos de simulación y no solicitar datos de tarjeta.

## Séptima ola — integración de profundidad comercial

- ✅ **Catálogo conectado:** migración aditiva determinista añade 84 productos ficticios, 6 marcas y categorías jerárquicas; la expansión PC añade 32 componentes. Tras aplicar ambas migraciones, el reset/seed local contiene 128 productos publicados, 27 categorías, 7 marcas y 128 variantes EUR activas. El usuario informa haber ejecutado SQL en Supabase; esta sesión no verificó el conteo remoto.
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
- 🚧 **Catálogo, búsqueda, carrito y PC Builder comprable:** el configurador añade variantes publicadas al carrito; el checkout vuelve a validar datos de negocio. La base local tiene ocho opciones por clase, pero Production solo muestra 4–5 y 44 fichas/3 marcas. El carrito y el checkout se cubren contra Supabase aislado; la variedad final alojada aún no.
- ✅ **Reviews:** elegibilidad por línea entregada, moderación protegida, lectura pública solo de publicadas y acceso desde PDP.
- ✅ **CRM/B2B hasta pago demo:** cotización aceptada emite pedido formal tenant-scoped con snapshots/reserva; owner/admin simula anticipo aprobado o rechazado. Aprobado guarda pago, pedido, actividad CRM y eventos idempotentes; rechazado cancela y libera reserva. No se recogen datos de tarjeta ni se procesa dinero real.
- 🚧 **CRM comercial de clientes y pedidos:** se añadieron localmente directorio/ficha de cliente, historial y filtros de pedido/pago/preparación/devolución, detalle con artículos snapshot, importes y timeline. Cuatro RPCs limitadas están en `20261013100000_crm_customer_orders_workspace.sql`; typecheck, ESLint y 23 aserciones pgTAP pasan en Supabase local. Falta aplicar la migración en Production y validar las vistas con sesiones sales/customer/support antes de desplegar. No amplía mutaciones ni RLS directo.
- ✅ **Inventario y procurement básico:** ledger idempotente de movimientos, proveedores, órdenes de compra, recepciones parciales/finales vinculadas al movimiento y control de sobre-recepción.
- ✅ **Fulfillment:** pedido pagado pasa por picking, packing y expedición con timeline y consumo de reserva. La secuencia y autorización están cubiertas en PostgreSQL.
- ✅ **Support/RMA local:** ticket, conversación, revisión/reembolso demo, inspección de almacén y disposición por línea funcionan. Reponer incrementa `on_hand` una sola vez mediante ledger; desechar no incrementa stock; al inspeccionar todas las líneas la devolución se cierra con evento de timeline. El recorrido browser conectado cliente → soporte → almacén queda cubierto.
- ✅ **Analytics del alcance publicado:** pedidos, ventas brutas aprobadas, aprobación de pago, inventario disponible y conversión de solicitudes CRM tienen fórmula, fuente, periodo de 30 días Europe/Madrid, límites y fixtures puros/SQL/E2E; el dashboard falla cerrado ante discrepancias. Ventas netas, margen, visitas y conversión específica de cotizaciones B2B no se presentan como KPIs todavía.
- ✅ **Demo Mode local:** modo de archivos limitado a desarrollo y sin Auth; Supabase configurado siempre gana y falla cerrado. La guía cubre reset local y organización ficticia; `scripts/demo/assign-staff-roles.ps1` asigna en loopback grants de los cinco roles internos a cuentas Auth locales ya creadas, sin crear ni almacenar contraseñas. Se ejecutó y verificó que escribe exactamente un grant por rol; `db reset --local` los elimina.
- ✅ **Seguridad/Auth local:** aislamiento, escalada, permisos sensibles y boundaries HTTP verificados con matriz documentada, suites SQL y 78 probes autenticados; esto no certifica un entorno remoto ni prueba CRUD exhaustivo por cada campo/endpoint. `manager` y `marketing` no son roles persistidos y no reciben permisos implícitos.
- 🚧 **Experiencia y presentación:** storefront medido en Lighthouse local: portada móvil 92 y catálogo desktop 100. El dominio público, robots y sitemap ya usan el host final; las rutas comprobadas no presentan overflow a 390 px y no hay errores JavaScript. No se ha medido contraste/lector de pantalla exhaustivo en backoffice ni CrUX/INP de campo.

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
| Catálogo local tras reset y expansión PC Builder | ✅ 128 productos publicados, 27 categorías, 7 marcas, 128 variantes EUR activas |
| `git diff --check` | ✅ sin errores; Git advierte conversión LF/CRLF de Windows |

## Séptima ola — cierre de RMA y anticipo B2B

El Tech Lead implementó el siguiente slice después de verificar el backlog real: página protegida de cola de devoluciones, inspección por línea y almacén activo, motivo obligatorio, repetición idempotente, rechazo de payload distinto, ledger de reposición, desecho sin cambio de stock y cierre/timeline al completar todas las líneas. Roles de soporte/cliente no pueden inspeccionar; el RPC y las tablas privadas aplican controles en PostgreSQL además del route guard.

Verificación del slice: reset local aplicó 17 migraciones y seed; `tests/integration/support-flow/return-inspection.sql` pasó en PostgreSQL (autorización, cantidades, reposición/desecho, idempotencia incluso tras cerrar, conflicto de clave, timeline y stock). La route suite tiene 4 pruebas.

El mismo cierre de backlog incorporó anticipo B2B demo en una migración posterior: tenant owner/admin puede registrar resultado aprobado/rechazado, con idempotencia y registro de CRM. El runner aislado verifica permiso denegado a buyer, replay, payload diferente y liberación de reserva ante rechazo.

Warnings no bloqueantes conocidos: Node reporta `MODULE_TYPELESS_PACKAGE_JSON` en dos pruebas de módulos `.ts`; Playwright/Windows muestra conflicto `NO_COLOR`/`FORCE_COLOR`. El antiguo warning de estilo de caret en inputs no se ha atribuido al árbol React y requiere confirmar en navegador limpio.

## Backlog priorizado

### P0

- ⏳ **Auth Supabase alojado:** fijar Site URL y Redirect URLs en `https://nodria-academico.vercel.app`, configurar SMTP verificado y probar alta, enlace, inicio y recuperación con una cuenta ficticia. Esta sesión no tiene acceso a la organización Supabase correcta.
- ✅ Smoke público: rutas base responden HTTP 200 y no se observaron errores JavaScript/overflow en el navegador de producción. Esto no sustituye pruebas de sesión, RLS ni escritura.
- ⚠️ NODRIA no es un comercio real: checkout/pagos/envíos, clientes, productos y opiniones son ficticios; mantener el aviso en UI y no aceptar tarjetas/datos reales.

### P1

- ⚠️ **Dataset alojado incompleto:** el público muestra 44 fichas/3 marcas y el configurador 4–5 opciones por clase, frente a 8. Consultar historial y conteos; aplicar solo las migraciones aditivas que falten y repetir el walkthrough.
- ✅ Crear páginas conectadas de marcas, selecciones temáticas y categorías (`/marcas`, `/campanas`, `/categorias` y sus rutas por slug); el sitemap y los enlaces de portada/pie se derivan del catálogo activo. Cubierto por el gate de storefront; no hay fallback de fixtures ante error conectado.
- 🚧 Recorrer en producción una PDP, PC Builder y checkout conectado aprobado/rechazado con una cuenta y datos ficticios tras corregir el catálogo. Las suites aisladas locales pasan, pero no generan pedidos remotos.
- ⏳ Revisar `/servicios` y añadir historial operativo/CRM sintético repetible sin aparentar transacciones reales ni sobrescribir datos existentes.
- ✅ Matriz de permisos por rol y dominio documentada en `RBAC_MATRIX.md`, con 78 probes HTTP autenticados, pruebas SQL por dominios críticos y E2E de roles; no equivale a CRUD exhaustivo por columna ni prueba cada Server Action.
- ✅ **Escritura segura de catálogo:** migration revoca DML amplio y `update_catalog_product_editorial` aplica allowlist/rol en PostgreSQL. API de sesión, route/unit tests y E2E que edita y restaura un producto seed. Ver `docs/CATALOG_MANAGER_UI.md`.
- 🚧 **CRM de pedidos en Production:** el CRM está implementado y su prueba pgTAP pasa en local; requiere migración `20261013100000_crm_customer_orders_workspace.sql`, verificación de roles en Supabase alojado y posterior deployment. No publicar el frontend antes de que existan los RPC.

### P2

- ⏳ **CRM tipo Shopify, siguiente alcance:** etiquetas/notas editables, segmentos dinámicos, valor de vida calculado con política explícita de reembolsos, y acciones comerciales aún no existen. No simularlos como completos.

- [x] Medir Lighthouse local en portada móvil y catálogo desktop; corregir contraste, nombres accesibles, objetivos táctiles e imágenes responsive. Evidencia detallada en `docs/PERFORMANCE_AUDIT.md` y `.seo-cache/`.
- [ ] Repetir CWV de laboratorio en el dominio final y obtener datos de campo cuando haya tráfico; no hay datos CrUX/INP actuales.
- [x] Ampliar el barrido E2E anónimo a 27 rutas, teclado, nombres de controles, enlaces/destinos y overflow en desktop, móvil (390 px) y tablet (768 px); detalle en `docs/UX_FINAL_AUDIT.md`.
- [x] Walkthrough responsive autenticado de roles internos en Supabase local efímero: support, sales, fulfillment, catalog (denegación documentada) y superadmin; evidencia en `docs/UX_FINAL_AUDIT.md`.
- [x] Recorrido Auth visual con sesión de cliente y membresías buyer/viewer/owner/admin, tenant ajeno y viewports 390/768/1280; sin mutaciones CRUD. Ver `docs/UX_CUSTOMER_B2B_AUDIT.md`.
- [x] Shell y navegación interna de `/soporte/agente` con saltos de teclado/estados y viewports 390/768/1280. Ver `docs/UX_STAFF_SHELL.md`.
- [ ] Medir contraste y revisar lector de pantalla de todas las superficies backoffice con tooling dedicado; E2E de nombre/foco/overflow no sustituye esa auditoría.
- [ ] Añadir historial sintético variado para CRM/operaciones de forma segura y repetible, sin crear eventos que parezcan transacciones reales ni sobrescribir datos existentes.
- ✅ URL de producción actualizada antes de la reconstrucción `4905c47`; `robots.txt` y las 74 URLs del sitemap ya usan solo el dominio final.
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
- Bloqueos fuera del repo: el proyecto Supabase staging y deployment Vercel existen según el operador, pero no se confirmó un request de runtime exitoso después de configurar variables, ni el flujo Auth/SMTP. CWV/CrUX de campo siguen sin medirse.

## Landings comerciales y matriz PC Builder — cierre local 2026-10-08

- ✅ `/marcas` y `/marcas/[slug]`, `/categorias` y `/categorias/[slug]`, `/campanas` y `/campanas/[slug]` leen el catálogo activo. Categorías incluyen descendientes mediante `parentId` y `categoryIds`; selecciones y grupos no persisten conteos duplicados. Catálogo conectado fallido no recibe fallback de fixtures.
- ✅ La portada apunta las categorías a sus landings y la campaña a una selección activa; el pie enlaza marcas/categorías/selecciones. Canonical/robots respetan el dominio público configurado; el sitemap incluye los slugs activos y páginas de producto.
- ✅ Dataset PC Builder: ocho variantes por cada una de ocho clases en el conjunto expandido; 784 combinaciones CPU/placa/RAM/caja compatibles con las reglas declaradas, prueba de GPU que excede caja y advertencia de margen de fuente. La migración delta espera aplicación manual en Supabase.
- ✅ Gates de esta ronda: TypeScript, ESLint, `pnpm test` (288 Vitest + 39 Node), `pnpm build`, Playwright 19/19 y `git diff --check`. Las rutas nuevas pasan verificación de headings, nombres de controles/enlaces y overflow desktop/móvil/tablet.
- Commit funcional local: `c5e2025 feat(storefront): add catalog landings and PC matrix`.
- ⚠️ Warnings Playwright preexistentes/de entorno: `caret-color: transparent` inyectado durante hidratación y `NO_COLOR` junto con `FORCE_COLOR`; no bloquearon los E2E ni se atribuyeron a estilos del producto.
- ⏳ No se aplicó ninguna migración ni se modificó el proyecto Supabase remoto durante esta ronda. Falta verificar estado remoto, probar Auth alojado con allowlist/SMTP y repetir el walkthrough con el catálogo remoto poblado.

## Mejora del PC Builder — 2026-10-09

- ✅ El configurador ahora guía la selección por categoría, muestra el progreso de las cinco piezas esenciales y separa las ampliaciones opcionales.
- ✅ Las variantes disponibles se presentan como opciones comparables; el resumen muestra selecciones y permite volver a editarlas. Guardados locales, mensajes de compatibilidad y bloqueo de compra siguen conectados al comportamiento existente.
- ✅ Validación local: TypeScript, ESLint sobre `components/storefront/pc-builder.tsx` y `git diff --check`.
- ⚠️ La vista previa local se comprobó en modo demo, que deliberadamente no ofrece piezas ficticias. La revisión visual de tarjetas con variantes reales requiere que el catálogo conectado esté disponible y poblado; no se modificaron migraciones ni Supabase remoto.
- ✅ Publicado desde `e91a165` en Vercel Production; el deployment figura `success` y `https://nodria-staging.vercel.app/configurador` respondió HTTP 200 con el nuevo flujo.
