# Registro de decisiones

## D-023 — Profundidad comercial en el entorno alojado sin mutaciones destructivas

- **Fecha:** 2026-10-08
- **Estado:** Confirmada para esta fase.
- **Contexto:** NODRIA está accesible en Vercel y conectado a un proyecto Supabase, pero es una demo académica con datos ficticios. El entorno remoto contiene datos que deben conservarse.
- **Decisión:** Ampliar el producto con contenido y datos deterministas, sintéticos y compatibles. Cambios de BD solo aditivos e idempotentes; probar reset/seed exclusivamente en Supabase local aislado y revisar cualquier operación antes de aplicarla remotamente. Nunca resetear ni ejecutar seed completo de desarrollo contra producción.
- **Consecuencias:** Pedidos, pagos, reviews, stock y promociones siguen siendo ficticios; el checkout no solicita tarjeta. Conservar IDs/slugs existentes y snapshots transaccionales.

Las decisiones de alcance heredadas de la misión se marcan **Confirmada**. Las decisiones técnicas que aún dependen de migraciones o implementación se marcan **Propuesta** hasta que el código, los contratos o una revisión del tech lead las materialicen. Fecha del registro inicial: **2026-10-07**.

## D-001 — Identidad de producto: NODRIA

- **Fecha:** 2026-10-07
- **Estado:** Confirmada para la misión; identidad visual pendiente.
- **Contexto:** El proyecto necesita una empresa tecnológica ficticia y una marca propia.
- **Decisión:** Usar NODRIA como nombre del retailer tecnológico académico.
- **Alternativas:** Cambiar el nombre más adelante o conservar el nombre genérico del scaffold.
- **Motivo:** NODRIA es la identidad asignada para este proyecto; el scaffold `digitalizacion-web` es el nombre técnico del repositorio, no el nombre comercial.
- **Consecuencias:** Copy, wordmark, catálogo y datos de demo deben ser coherentes con NODRIA. No implica que el sistema visual o los assets estén implementados.

## D-002 — Mercado inicial: España, español y EUR

- **Fecha:** 2026-10-07
- **Estado:** Confirmada.
- **Contexto:** El producto requiere un mercado concreto, manteniendo orientación internacional.
- **Decisión:** Iniciar con España, idioma español y moneda EUR; preparar contratos explícitos para ampliar países/monedas más adelante.
- **Alternativas:** Diseñar primero un mercado global o implementar varios idiomas/monedas al inicio.
- **Motivo:** Coincide con el alcance solicitado y limita la complejidad inicial sin cerrar extensiones futuras.
- **Consecuencias:** El formato local de presentación no debe reemplazar códigos ISO/moneda en datos. No se declara internacionalización implementada.

## D-003 — Mantener el scaffold Next.js existente

- **Fecha:** 2026-10-07
- **Estado:** Confirmada.
- **Contexto:** El repositorio ya trae Next.js 16.4, React 19.3, TypeScript 5, Tailwind CSS 4, App Router y pnpm 10.32.1.
- **Decisión:** Construir sobre ese scaffold, sin migrarlo ni sustituir el framework.
- **Alternativas:** Re-inicializar, cambiar stack o comenzar otro proyecto.
- **Motivo:** La plataforma solicitada define Next.js/React/TypeScript y un scaffold compatible ya existe.
- **Consecuencias:** Antes de modificar código, leer los documentos instalados de Next.js 16 y confirmar las APIs vigentes. La app ya tiene marca NODRIA, grupos de ruta y componentes propios.

## D-004 — Monolito modular como arquitectura inicial

- **Fecha:** 2026-10-07
- **Estado:** Confirmada como arquitectura de esta entrega.
- **Contexto:** Storefront, comercio, B2B, CRM, inventario y soporte comparten entidades y flujos; separar servicios elevaría el coste de consistencia y despliegue.
- **Decisión:** Mantener una aplicación Next.js y separar módulos por dominio, con casos de uso en servidor y límites de propiedad claros.
- **Alternativas:** Microservicios, aplicaciones separadas por superficie o un conjunto de pantallas sin límites de dominio.
- **Motivo:** Equilibra complejidad académica útil, transacciones compartidas y facilidad de despliegue.
- **Consecuencias:** Los módulos comparten PostgreSQL, pero no deben duplicar reglas ni depender circularmente. No introducir infraestructura distribuida sin evidencia.

## D-005 — Supabase/PostgreSQL como fuente de verdad prevista

- **Fecha:** 2026-10-07
- **Estado:** Confirmada; schema/seed, checkout conectado, inventario básico y pruebas GoTrue/PostgREST local implementados. No hay proyecto remoto desplegado.
- **Contexto:** La misión requiere Supabase para Postgres, Auth, Storage y RLS. Migraciones/reset/seed y pruebas locales pasan, pero no hay credenciales remotas ni ejecución de producción.
- **Decisión:** Diseñar persistencia alrededor de PostgreSQL gestionado por Supabase, con migraciones reproducibles y RLS. Las migraciones y objetos de base pertenecen a `supabase/**`.
- **Alternativas:** Datos solo locales/mock, cambios manuales en dashboard o un backend separado.
- **Motivo:** Cumple el requisito del producto y permite integridad relacional, políticas y despliegue reproducible.
- **Consecuencias:** Migraciones definen tablas, roles, policies y RPCs; reset/seed, 189 pgTAP, runtime SQL y 78 probes Auth/PostgREST locales pasan. Storefront, checkout, CRM, soporte, reviews, operations, analytics, inventario básico y PC Builder consumen contratos conectados por slices; compras avanzadas y algunos workflows siguen parciales. No presentar `.data/` como PostgreSQL. El arranque local usa puertos alternativos en `supabase/config.toml` por exclusiones de Windows.

## D-010 — Modo de datos demo resuelto en servidor

- **Fecha:** 2026-10-07
- **Estado:** Confirmada e integrada.
- **Contexto:** Conviven fixtures, archivos `.data/` y Supabase; una elección basada en UI permitiría cruces accidentales de datos.
- **Decisión:** `lib/server/data-mode.ts` determina modo en servidor. El modo de archivo demo requiere `NODE_ENV=development`, `DEMO_MODE=true` y no tener credenciales Supabase; cuando hay configuración Supabase no se usa fallback local ante errores conectados.
- **Consecuencias:** Backoffice demo no se habilita sin sesión/rol real en modo conectado. Las lecturas de catálogo/búsqueda y fixtures siguen bajo auditoría para asegurar la misma regla en todas las superficies.

## D-011 — Mutaciones operativas por RPC y RLS probado localmente

- **Fecha:** 2026-10-07
- **Estado:** Confirmada parcialmente; gates locales pasan.
- **Contexto:** La escritura directa en orders, payments, inventory y memberships podía romper estado o cruzar tenants.
- **Decisión:** Revocar DML directo sobre transiciones operativas protegidas y exponer operaciones PostgreSQL acotadas como `place_order`, `resolve_demo_payment`, `fulfill_order`, `mark_order_delivered` y `adjust_inventory`; controlar cambios mediante transacción/RLS y grants mínimos.
- **Consecuencias:** `receive_inventory` y `adjust_inventory` comprueban en DB los roles warehouse/superadmin, validan idempotency key + fingerprint y preservan reservas. 189 pgTAP, SQL runtime y gates RLS pasan localmente; la matriz CRUD no es exhaustiva ni sustituye despliegue remoto.

## D-006 — Pago únicamente simulado

- **Fecha:** 2026-10-07
- **Estado:** Confirmada como límite del producto académico; outcomes de prueba se resuelven desde servidor conectado y nunca procesan dinero.
- **Contexto:** La demo debe mostrar un checkout defendible sin procesar dinero.
- **Decisión:** Mantener simulador server-side con resultados de prueba, intentos persistidos, pedido relacionado e historial ficticio. No usar pasarela real y no solicitar números bancarios reales.
- **Alternativas:** Stripe/pasarela bancaria real, o checkout que solo aparenta confirmar pedidos.
- **Motivo:** Evita dinero real y permite enseñar estados de aprobación, rechazo y reintento con trazabilidad.
- **Consecuencias:** UI y documentación advierten no introducir datos bancarios. Route Handler autenticado crea/recupera el pedido; `payment-admin.ts` llama RPC de resultado con clave secreta solo servidor; RPC vincula outcome/evento, pago, pedido, timeline y reserva atómicamente. E2E GoTrue/PostgREST local cubre aprobado/rechazado, retry, refresh, payload distinto y concurrencia de stock; no se procesan cargos reales.

## D-007 — Inventario derivado y checkout transaccional

- **Fecha:** 2026-10-07
- **Estado:** Materializada por `place_order_from_checkout`, `resolve_demo_payment`, `fulfill_order` y RPCs de movimientos; validada en DB y E2E local.
- **Contexto:** Pedidos simultáneos, cancelaciones y devoluciones pueden dejar stock incoherente.
- **Decisión:** Modelar disponibilidad como físico menos reservado y coordinar reserva/liberación y cambios de pedido de manera atómica en base de datos. El servidor confirma precios y stock al checkout.
- **Alternativas:** Tratar el stock enviado por el cliente como autoridad o mantener contadores duplicados sin reconciliación.
- **Motivo:** Protege invariantes de negocio bajo concurrencia y deja el histórico auditable.
- **Consecuencias:** `docs/DATA_MODEL.md` documenta snapshots y relaciones; SQL/E2E verifica sobreventa, retry, liberación, rollback, movimientos idempotentes y reconciliación. Checkout conectado e inventario básico están integrados; procurement y fulfillment visual completo siguen parciales.

## D-008 — Datos de demostración siempre ficticios

- **Fecha:** 2026-10-07
- **Estado:** Confirmada; seed ficticio inicial añadido.
- **Contexto:** La aplicación necesita datos creíbles para la presentación, pero no tiene credenciales/seed configurados.
- **Decisión:** Usar productos, personas, empresas, VAT/NIF, pagos, facturas y envíos inventados; separar seed de demo de datos productivos.
- **Alternativas:** Datos personales/empresariales reales o fixtures presentados como datos reales.
- **Motivo:** La demostración puede ser rica sin introducir información real ni confundir una simulación con producción.
- **Consecuencias:** La procedencia y carácter ficticio deben quedar claros en las rutas y materiales de demo. El seed no crea usuarios Auth ni permite login de contactos ficticios.

## D-009 — No activar Cache Components hasta adoptar sus patrones

- **Fecha:** 2026-10-07
- **Estado:** Confirmada para la base actual.
- **Contexto:** El scaffold habilitaba Cache Components y Partial Prefetching por defecto, mientras que la aplicación depende de rutas dinámicas con sesión y Route Handlers configurados para runtime Node.
- **Decisión:** Mantener el comportamiento dinámico estándar de Next.js hasta que exista una necesidad concreta de caché y se adopten sus patrones de sesión/streaming.
- **Alternativas:** Forzar la migración de todas las rutas al modelo de Cache Components en esta entrega.
- **Motivo:** La aplicación todavía no tiene caché de datos que aproveche esa opción; mantener el patrón estándar reduce configuración sin uso y permite compilar los flujos actuales.
- **Consecuencias:** `next.config.ts` no habilita `cacheComponents` ni `partialPrefetching`. Revisar esta decisión si se incorpora caché de dominio.

## D-011 — Ventana comercial B2B y privacidad de actividad

- **Fecha:** 2026-10-07
- **Estado:** Confirmada para la cola actual; requiere revisión si se amplía el equipo.
- **Contexto:** ventas necesita reclamar solicitudes empresariales no asignadas para que el presupuesto pueda avanzar a oferta; una cuenta de ventas no requiere un directorio global de organizaciones, rosters ni datos de pago.
- **Decisión:** `sales_manager` puede leer la cola de presupuestos formales `requested` sin propietario y los presupuestos asignados a su usuario. No puede enumerar organizaciones/membresías, pedidos o pagos. Antes del claim, puede ver actividad `internal`; las notas `organization` solo las ven miembros de la organización. Después de reclamar, la actividad de trabajo pertenece a la superficie asignada.
- **Alternativas:** negar toda cola y exigir asignación previa manual; o permitir lectura global de todas las tablas CRM/B2B.
- **Motivo:** conserva el flujo comercial de claim/oferta sin mantener el hallazgo de enumeración de organizaciones y notas privadas.
- **Consecuencias:** políticas se prueban en `tests/integration/security/postgres-object-isolation.sql`; si se requieren vistas/campos distintos en producción, crear un contrato dedicado y pruebas antes de ampliar acceso.

## D-012 — El checkout identifica la variante vendible

- **Fecha:** 2026-10-07
- **Estado:** Confirmada e integrada en `c03e63b`.
- **Contexto:** Un producto puede tener varias variantes; un `productId` genérico no identifica con seguridad la línea de compra.
- **Decisión:** El cliente envía `variantId` y cantidad. El servidor exige una variante activa/publicada y vuelve a resolver precio y stock; nunca acepta importes de cliente. Se conserva compatibilidad `productId` solo cuando hay exactamente una variante vendible no ambigua.
- **Consecuencias:** El seed publica componentes PC ficticios con `attributes.pc_builder`; el configurador preserva variante al añadir al carrito y checkout vuelve a resolver precio/stock. Ver `lib/pc-builder/cart.ts` y `tests/integration/pc-builder/**`.

## D-013 — Las transiciones de soporte/RMA usan RPC

- **Fecha:** 2026-10-07
- **Estado:** Confirmada e integrada en `b79cc99`.
- **Contexto:** Mensajes de agentes, estado de tickets y decisiones de devolución deben producir timeline y mantener invariantes en una sola transacción.
- **Decisión:** Revocar DML directo de `authenticated` sobre tickets/mensajes y exigir RPCs autorizadas, con idempotencia para mensaje y resolución de RMA.
- **Consecuencias:** La matriz SQL debe probar la acción por RPC; no debe intentar un `UPDATE support_tickets` directo. Eventos del ticket y RMA son consultables con policies por propietario/equipo.

## D-014 — Tailwind global y CSS Modules usan pipelines compatibles

- **Fecha:** 2026-10-07
- **Estado:** Confirmada; corrección integrada durante la cuarta ola.
- **Contexto:** La regla Turbopack `*.css` aplicaba el loader global también a `*.module.css`, dejándolos sin exports de clase en HTML.
- **Decisión:** Procesar Tailwind 4 por `@tailwindcss/postcss` en `postcss.config.mjs` y dejar CSS Modules en el pipeline nativo de Next/Turbopack.
- **Consecuencias:** B2B y otras superficies recuperan sus clases; E2E verifica root classes y responsive. No volver a aplicar una regla global de loader CSS a todos los módulos.

## D-015 — La cotización B2B aceptada se audita y después puede emitir un pedido formal

- **Fecha:** 2026-10-07
- **Estado:** Confirmada e integrada; las dos fases se registran como conversión auditable y pedido formal enlazado.
- **Contexto:** Las cotizaciones B2B conservan precios negociados e identidad empresarial, mientras `orders` solo se crea hoy desde el checkout con direcciones, fingerprint de carrito, precio/stock actuales, reserva de inventario y pago demo.
- **Decisión:** Owner/admin puede registrar idempotentemente la conversión y emitir un pedido formal desde cotización `accepted`. Se conservan snapshots de organización, oferta, líneas y direcciones; la emisión revalida tenant y stock, reserva unidades y enlaza `business_quote_orders` con `orders`.
- **Alternativas:** insertar directamente filas de comercio desde CRM sin resolver direcciones/condiciones de pago ni reutilizar la reserva autoritativa; o mantener una aceptación sin paso posterior auditable.
- **Motivo:** Preserva auditoría/aislamiento y evita saltarse el contrato autoritativo de checkout o el ownership de inventario.
- **Consecuencias:** La orden requiere anticipo y queda `pending_payment`; no se expide antes del pago habilitado. La simulación B2B auditada está implementada y no se representa como pago real. Ver `20261007160000_crm_b2b_formal_order.sql`, `20261007210000_b2b_demo_advance_payment.sql` y el runner `tests/integration/b2b-connected/run.ps1`.

## D-016 — Movimientos manuales de inventario son ledger e idempotentes

- **Fecha:** 2026-10-07
- **Estado:** Integrada en `20261007133000_inventory_receipts_idempotent_movements.sql`.
- **Contexto:** La UI de inventario era de solo lectura; recepción/ajustes directos podían perder auditoría, duplicarse al reintentar o consumir unidades reservadas.
- **Decisión:** Exponer `receive_inventory` y la variante idempotente de `adjust_inventory`, con clave/fingerprint y ledger append-only. PostgreSQL autoriza `fulfillment_manager`/`super_admin`; solo cambia `on_hand` y un ajuste no puede bajar de `reserved`.
- **Consecuencias:** La UI envía requests al Route Handler conectado y muestra disponible recalculado; no hay proveedor maestro ni PO, que quedan como trabajo separado.

## D-017 — Reintentos de checkout validan pedido antes de mutar carrito

- **Fecha:** 2026-10-07
- **Estado:** Integrada en `20261007140000_checkout_retry_lookup.sql`.
- **Contexto:** El Route Handler podía crear un segundo carrito y escribir sus líneas antes de que checkout hallara un pedido idempotente ya existente.
- **Decisión:** `find_checkout_order` exige identidad, valida el payload y compara su fingerprint contra el pedido antes de resolver pago. El retry igual reusa el evento/pedido; la clave con payload distinto produce conflicto y no crea carrito.
- **Consecuencias:** E2E conectado comprueba una sola cesta, un pago, una reserva y eventos consistentes en retries. El RPC es autenticado y no devuelve pedidos de otro usuario.

## D-018 — Las recepciones de procurement completan órdenes de compra mediante el ledger

- **Fecha:** 2026-10-07
- **Estado:** Integrada en `20261007145943_procurement_purchase_orders.sql`.
- **Contexto:** Las recepciones directas de inventario ya generan movimientos idempotentes, pero no conservaban el proveedor, la orden de compra ni cantidades recibidas contra una solicitud.
- **Decisión:** Gestionar proveedores con desactivación lógica y órdenes de compra con snapshots de proveedor/producto. Solo `fulfillment_manager` y `super_admin` leen y mutan procurement; cambios pasan por RPCs acotadas. Una recepción parcial/final aplica `receive_inventory` por línea dentro de la misma transacción, vincula cada línea al movimiento resultante y actualiza estado/timeline de PO.
- **Alternativas:** alterar inventario desde la UI o mantener recibos desconectados del ledger, lo que permitiría saltarse autorización, idempotencia o reconciliación.
- **Consecuencias:** Clave UUID más fingerprint evita duplicados y conflictos de payload; excesos y órdenes no receivables quedan registrados como rechazados sin modificar stock. La moneda del coste es EUR. Facturas, impuestos de proveedor, pagos, devoluciones a proveedor y sincronización con sistemas externos no forman parte del slice. Ver `20261007145943_procurement_purchase_orders.sql` y `tests/integration/procurement/procurement.sql`.

## D-019 — La aprobación RMA no equivale a inspección ni reposición

- **Fecha:** 2026-10-07
- **Estado:** Implementada localmente en `20261007200000_return_inspection_disposition.sql`.
- **Contexto:** Aprobar una devolución puede autorizar un reembolso simulado, pero el producto aún no se ha recibido ni se ha comprobado su estado.
- **Decisión:** La aprobación crea un efecto de reembolso idempotente y marca unidades `pending_inspection`. El rol `fulfillment_manager` inspecciona la cantidad completa aprobada por línea y elige reponer o desechar con motivo. Reponer actualiza inventario y ledger en la misma transacción; desechar no aumenta stock. Claves iguales con mismo fingerprint hacen replay; una clave o línea reutilizada con datos distintos se rechaza. La última línea inspeccionada cierra la devolución y genera timeline; solo la RPC autorizada puede realizar esa transición.
- **Consecuencias:** Nunca incrementar stock al aprobar una solicitud. El ledger cambia solo tras inspección física autorizada. El recorrido autenticado cliente → soporte → warehouse está cubierto por `tests/e2e/connected-domains` (6/6), además de pruebas SQL y route.

## D-020 — Los pedidos B2B requieren anticipo antes de fulfillment

- **Fecha:** 2026-10-07
- **Estado:** Implementado como simulación académica tenant-scoped en `20261007210000_b2b_demo_advance_payment.sql`.
- **Contexto:** Las condiciones de la oferta B2B establecen pago anticipado; la simulación de checkout B2C no representa el cobro de una factura comercial.
- **Decisión:** La orden B2B se crea con estado `pending_payment` y reservas. Owner/admin puede elegir aprobado o rechazado en un paso identificado como demo; no se piden datos de tarjeta. La RPC valida membresía del tenant, guarda fingerprint idempotente y registra el resultado en pedido, pago y actividad de CRM. El rechazo cancela el pedido y libera la reserva. Fulfillment sigue exigiendo pago `paid`.
- **Consecuencias:** El escenario académico de anticipo funciona de punta a punta; no equivale a un proveedor de pago real ni procesa dinero.

## D-021 — Optimizar imágenes de catálogo demo sin ampliar orígenes conectados

- **Fecha:** 2026-10-07
- **Estado:** Integrado en portada, tarjetas y PDP de datos demo.
- **Contexto:** Lighthouse encontró imágenes mayores que su tamaño de render y el hero LCP estaba diferido por lazy loading y una animación de opacidad.
- **Decisión:** Las imágenes demo de Unsplash usan `next/image` con `sizes` y eager/high priority solo para la imagen LCP. Las imágenes conectadas conservan `<img>` porque sus URL pueden venir de hosts que no están incluidos en `remotePatterns`.
- **Consecuencias:** La entrega responsive pasa el audit en las rutas medidas; Lighthouse marca cero ahorro estimado. Mantener el allowlist de hosts y revisar el origen antes de migrar imágenes conectadas.

## D-022 — La UI interna de catálogo utiliza una frontera de escritura por campo

- **Fecha:** 2026-10-08
- **Estado:** Implementada en `20261007221456_catalog_editorial_write_contract.sql` y `/backoffice/catalog`.
- **Contexto:** `catalog_manager` existe y RLS le concede DML sobre el catálogo, pero el grant actual abarca columnas protegidas y PostgREST permite saltarse cualquier allowlist exclusiva del Route Handler.
- **Decisión:** Revocar DML amplio del catálogo a `authenticated` y permitir edición editorial de productos existentes únicamente por `update_catalog_product_editorial(text,jsonb)`. PostgreSQL valida rol persistido y allowlist; la UI server-side usa la sesión, envía campos modificados y no usa service role.
- **Consecuencias:** El manager de catálogo puede leer y editar los seis campos editoriales permitidos; precio, publicación, stock y variantes quedan fuera. pgTAP, route tests y E2E Auth prueban rechazo de campos protegidos y persistencia/reversión de edición.

## D-023 — La expansión del catálogo es sintética, aditiva y separada del seed operativo

- **Fecha:** 2026-10-08
- **Estado:** Integrada en `20261008135808_catalog_depth_dataset.sql`; probada únicamente en Supabase local, todavía no desplegada en staging.
- **Contexto:** El seed alojado tenía 12 productos, seis categorías y una marca. La tienda necesita variedad para probar facetas, búsqueda, PDP y variantes.
- **Decisión:** Mantener el dataset fuente en `scripts/catalog/dataset.mjs`; generar una migración determinista con 84 productos ficticios, seis marcas nuevas, 21 familias y 27 categorías finales. La migración usa IDs/slug/SKU estables, serializa reruns, rechaza colisiones y no reescribe productos existentes. No meter estos registros en `supabase/seed.sql` de producción.
- **Consecuencias:** El reset local resulta en 96 productos, 27 categorías y 7 marcas. Los datos no son stock, ventas, reviews ni recomendaciones reales. Aplicación remota solo mediante migración aditiva revisada.

## D-024 — Las facetas de categoría leen el árbol y las memberships del catálogo

- **Fecha:** 2026-10-08
- **Estado:** Integrado en `lib/catalog-repository.ts`, `lib/catalog-mapping.ts` y `/catalogo`.
- **Contexto:** La migración crea categorías hijas y relaciona cada producto con raíz y hoja; el contrato anterior solo conservaba el nombre de categoría raíz.
- **Decisión:** El repositorio público selecciona `categories.parent_id`; el mapper conserva `parentId` y todos los `categoryIds`, sin cambiar el campo `Product.category` usado por tarjetas y módulos existentes. El descubrimiento usa esos IDs para filtrar una categoría y sus descendientes. La cantidad exacta sigue fuera del payload conectado.
- **Consecuencias:** Se mantiene compatibilidad de consumidores existentes y el árbol de filtros funciona con datos jerárquicos. Un test de integración cubre mapeo raíz/hoja, producto, conteo y filtros técnicos.

## D-025 — Los enlaces de correo usan el origen donde se inició Auth

- **Fecha:** 2026-10-08
- **Estado:** Integrado en `components/storefront/auth-form.tsx` y `app/auth/callback/route.ts`; falta verificación de Auth hospedado.
- **Contexto:** Los enlaces de Supabase estaban regresando a `localhost` cuando `NEXT_PUBLIC_SITE_URL` no coincidía con el deployment actual.
- **Decisión:** Crear enlaces de confirmación/recuperación con `window.location.origin`, canjearlos en `/auth/callback` y aceptar solo redirects internos seguros. La UI ofrece reintento explícito y mensajes neutrales; no intenta reenviar automáticamente.
- **Consecuencias:** Preview y staging regresan al mismo host de inicio, pero el operador aún debe añadir los redirect URLs de Supabase y configurar SMTP propio. El límite del proveedor de correo no se resuelve en la aplicación.

## D-026 — Las páginas de descubrimiento derivan del catálogo activo

- **Fecha:** 2026-10-08
- **Estado:** Integrado en `/marcas`, `/categorias`, `/campanas` y `app/sitemap.ts`.
- **Contexto:** Una jerarquía de catálogo no basta si los visitantes no tienen rutas de llegada desde campañas, marcas y categorías.
- **Decisión:** Generar grupos, conteos, productos, metadatos y sitemap desde `getCatalogData()`; categorías incluyen descendientes por IDs/membership, las selecciones usan slugs activos y marcas normalizadas. Ante error del catálogo no se sustituyen datos demo; rutas desconocidas devuelven 404 y metadatos no indexables. Las selecciones no implican descuentos ni compatibilidad técnica.
- **Consecuencias:** No se añade tabla CMS ni contrato de base de datos. La ruta depende de la migración opcional de catálogo para las nuevas marcas/familias; el catálogo base sigue funcionando y muestra sus categorías existentes.

## D-027 — La matriz del PC Builder valida reglas declaradas, no certifica compatibilidad total

- **Fecha:** 2026-10-08
- **Estado:** La cobertura del dataset pasa localmente; siguen pendientes verificaciones técnicas que requieren atributos/datos no incluidos.
- **Contexto:** El dataset ampliado proporciona cuatro variantes por cada una de ocho clases de componente.
- **Decisión:** Verificar las 256 combinaciones CPU/placa/RAM/caja del catálogo, conflictos GPU-caja y avisos de margen PSU con `attributes.pc_builder` tipado. No inferir BIOS/QVL, conectores de potencia ni espacios de radiador desde texto libre.
- **Consecuencias:** La matriz ofrece una comprobación reproducible de las reglas publicadas, no una certificación de hardware ni una garantía para montar equipos reales. Checkout vuelve a validar precio y disponibilidad.
