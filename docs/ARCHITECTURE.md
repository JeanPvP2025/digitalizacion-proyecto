# Arquitectura inicial de NODRIA

**Estado de este documento:** arquitectura objetivo y snapshot integrado al 2026-10-07. El repo contiene storefront, Auth SSR, guards por rol, CRM, inventario de solo lectura, soporte, B2B, checkout y migraciones/seed. Pasa typecheck, lint, 42 Vitest, 18 Node, 7 E2E, build, reset/seed, 60 pgTAP, DB lint y un gate PostgreSQL runtime de roles/checkout seleccionado. El modo y las fronteras de `.data/` se resuelven en servidor. No hay credenciales remotas y el checkout conectado aún no orquesta los RPC de outcomes de pago. Ver gates y límites en `STATUS.md`, `SECURITY.md` y `TESTING.md`.

## Objetivo y restricciones

NODRIA es una empresa tecnológica ficticia para el mercado inicial de España, en español y EUR, con orientación internacional. El producto reúne B2C, B2B y operaciones internas. Debe priorizar un núcleo de funciones conectadas y verificables, evitando que la interfaz prometa workflows inexistentes.

La implementación usa Next.js 16.4, React 19.3, TypeScript 5 y Tailwind CSS 4. Es una aplicación Next.js modular con PostgreSQL/Supabase como destino de persistencia. No se proponen microservicios, colas, cachés o motores de búsqueda externos sin una necesidad medida.

## Vista de contexto

```mermaid
flowchart LR
  Customer[Cliente B2C] --> Web[Aplicación Next.js]
  Business[Usuario B2B] --> Web
  Staff[Equipo interno] --> Web
  Web --> Server[Server Components y casos de uso del servidor]
  Server --> Auth[Supabase Auth]
  Server --> DB[(PostgreSQL en Supabase)]
  Server --> Storage[Supabase Storage con acceso controlado]
  DB --> RLS[RLS como límite de acceso a filas]
  Server --> DemoPay[Simulador de pago ficticio]
```

El simulador no es una pasarela externa ni procesa dinero. El catálogo/PDP, solicitudes B2B, soporte, CRM, inventario de solo lectura y parte del checkout tienen integración Supabase condicionada a credenciales; los modos locales persisten en `.data/` y son demo. La pantalla del centro de operaciones todavía consume datos demo. Pago conectado, reservas terminales, workflow de fulfillment/RMA y autorización efectiva de cada policy requieren gates de PostgreSQL local.

## Límites de dominio

Los límites son módulos de negocio dentro de la misma aplicación y base relacional; no son servicios desplegados de forma independiente. Los contratos de esquema indicados son conceptuales hasta que las migraciones los definan.

| Dominio | Responsabilidad | Relaciones principales |
|---|---|---|
| Identidad y acceso | Perfil asociado a Auth, direcciones, membresías de organización, roles internos y autorización | Auth, clientes, organizaciones, auditoría |
| Catálogo | Marcas, categorías, productos, variantes y atributos técnicos tipados por categoría | Inventario, precio, búsqueda, contenido |
| Descubrimiento | Búsqueda, filtros, ordenación, comparador y recomendaciones | Catálogo; las consultas deben respetar publicación y disponibilidad |
| Comercio | Carritos, promociones, checkout, intentos de pago demo, pedidos y snapshots históricos | Cliente/organización, catálogo, inventario, envíos, devoluciones |
| Clientes | Perfil, direcciones, wishlist, construcciones guardadas, pedidos y preferencias | Identidad, comercio, soporte, reseñas |
| B2B y CRM | Organizaciones, contactos, leads, oportunidades, actividades, condiciones comerciales y presupuestos | Identidad/membresías, precios, pedidos y auditoría |
| Inventario y compras | Almacenes, cantidades físicas/reservadas, movimientos, proveedores, órdenes de compra y recepciones | Catálogo, pedidos, devoluciones y operaciones |
| Fulfillment y operaciones | Preparación, expedición, seguimiento, incidencias, devoluciones y RMA | Pedidos, inventario, soporte y timeline operacional |
| Soporte y reputación | Tickets, mensajes, devoluciones atendidas, reseñas, votos y moderación | Clientes, organizaciones, pedidos, productos |
| Contenido | Guías, blog, autores y páginas corporativas/legales ficticias | Catálogo y SEO; sin autoridad sobre datos transaccionales |
| Analítica y auditoría | Vistas derivadas de registros operativos y eventos de acciones privilegiadas | Todos los dominios; acceso interno según rol |

### Contratos de datos importantes

- El catálogo distingue producto y variante vendible cuando haya opciones de compra. Los atributos técnicos deben tener un conjunto consultable por tipo de producto; JSON puede guardar extensiones, no reemplazar indiscriminadamente las relaciones importantes.
- El pedido conserva snapshots de descripción/SKU, precios, descuentos, impuestos y direcciones usados al confirmarse. Cambios posteriores en catálogo no reescriben el historial.
- La disponibilidad se deriva de `physical - reserved`; reservar y liberar stock debe actualizarse de forma atómica con la transición de pedido correspondiente. No se mantiene una copia derivada sin una regla verificable.
- Los importes se almacenan como `NUMERIC` en PostgreSQL, con moneda explícita en contratos que deban poder extenderse a otros mercados. No se usan cálculos monetarios con coma flotante binaria.
- Carrito, checkout y precio mostrado no son autoridad final: el servidor vuelve a leer precios, descuentos y stock al confirmar.
- Analytics consulta datos transaccionales o vistas derivadas definidas explícitamente; no se rellenan KPIs con porcentajes elegidos a mano.
- Las migraciones son la fuente reproducible del esquema. Seed solo con entidades ficticias, con política clara de entornos.

## Organización lógica prevista

La implementación debe conservar los límites anteriores en una sola aplicación. Como guía, los componentes de interfaz viven cerca de sus rutas; la lógica de casos de uso, validación y acceso a datos se mantiene en módulos de dominio del servidor. Los módulos no deben importar internamente detalles de otro dominio de forma circular: intercambian contratos explícitos o usan el caso de uso propietario.

Los grupos de rutas previstos son superficies públicas (storefront/contenido), autenticadas de cliente, portal B2B e internas. Son una organización conceptual; la estructura final debe seguir los patrones de Next.js 16 y las guías instaladas en `node_modules/next/dist/docs/`. Server Components son el punto de partida; los Client Components quedan para interacciones que necesitan estado o APIs del navegador. Mutaciones críticas se validan y autorizan en servidor mediante la primitiva adecuada de Next.js.

No se deben duplicar reglas de negocio en componentes cliente, Server Actions, Route Handlers y SQL. La transacción de base de datos debe proteger invariantes concurrentes —por ejemplo, reserva de stock o idempotencia de checkout— cuando una verificación aislada en aplicación no sea suficiente.

## Seguridad prevista y límites actuales

**La migración define controles y tiene gates locales ejecutados; faltan recorrido conectado y cobertura exhaustiva.** El resultado de `tests/integration/postgres-rls.sql` comprueba escenarios seleccionados contra PostgreSQL local; `docs/SECURITY.md` detalla alcance y riesgos restantes.

1. Supabase Auth será responsable de autenticar. La aplicación resolverá el usuario actual en servidor y vinculará su `auth.uid()` a perfiles y membresías persistidas.
2. RLS limitará lecturas y mutaciones por propietario o membresía de organización. Las políticas deben cubrir cada tabla expuesta, incluida la separación entre usuarios de una organización y usuarios de otra.
3. Los permisos de personal se comprobarán en servidor y en las políticas apropiadas. No se confiará en roles editables desde el cliente ni en ocultar enlaces como control de acceso.
4. Cada mutación valida datos con esquemas y vuelve a comprobar el acceso al objeto solicitado para evitar IDOR. Los privilegios elevados requieren autorización explícita y registro de auditoría.
5. La clave pública/anon, si se usa desde el navegador, no sustituye RLS. Una clave service-role, si se demuestra necesaria, permanece únicamente en entorno servidor y nunca se envía al cliente.
6. Storage usa rutas y políticas que separen recursos públicos de documentos privados; las descargas privadas requieren autorización o URL firmada de vida corta.
7. El pago demo no recoge ni almacena datos de tarjetas reales. Los estados aprobados, rechazados o temporales son fixtures de simulación y generan un intento y trazabilidad ficticios.
8. No se suben secretos ni datos personales reales al repositorio o a seeds. Preview, desarrollo y producción usan proyectos/credenciales separados.

La migración habilita RLS en 27 tablas, define grants y funciones de permisos/checkout. La UI Auth, callback, sesión SSR y guards de backoffice están integrados; las políticas se probaron en escenarios locales seleccionados, no para todas las operaciones y roles. SQL ofrece pago demo y consume/libera reservas en transacción, pero la ruta/UI conectada aún deja el pedido pendiente y no llama ese RPC. Los `.data/` y fixtures son solo demostración local y algunas lecturas de storefront aún requieren auditoría de boundaries. No hay entorno remoto probado; no considerar el producto apto para producción.

## Configuración local y despliegue previsto

### Desarrollo

Requisitos observados: Node.js compatible con Next.js 16 y Corepack/pnpm 10.32.1. Para arrancar el scaffold:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

No se han recibido credenciales remotas. `.env.example` permite activar demo local y documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Supabase local sí está configurado, migrado y probado. El modo demo de archivos solo opera en desarrollo; consulta `lib/server/data-mode.ts` y el estado de fallbacks en `STATUS.md`.

Los nombres públicos configurados son `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca se deben poner valores secretos en variables `NEXT_PUBLIC_*`. No inventar valores ni guardar credenciales reales en Git.

### Entornos de entrega

El objetivo es Vercel para Next.js y Supabase para base de datos/Auth/Storage. Antes de publicar se requiere: proyecto Supabase por entorno; URLs de Auth/redirección; variables protegidas en Vercel; aplicación automatizable de migraciones versionadas; seed ficticio solo en desarrollo/demo; revisión de policies RLS; y build validado. No hay una configuración de producción creada o probada.

Vercel Preview debe usar datos no productivos y credenciales separadas. Los cambios de schema deben desplegarse en orden controlado antes del código que los consume. El procedimiento concreto de migración y rollback debe seguir las herramientas y migraciones presentes en el repositorio cuando se implemente el workstream de base de datos.

## Verificación y calidad

Los scripts declaran `pnpm lint`, `pnpm build`, `pnpm test` y `pnpm test:e2e`; el typecheck se ejecuta con `pnpm exec tsc --noEmit`. La base integrada tiene 10 pruebas Vitest, 19 pruebas contractuales Node y 2 E2E de catálogo. El siguiente gate debe cubrir reglas monetarias, autorización, policies RLS, transiciones de estado, concurrencia de stock y más flujos E2E antes de marcar un dominio como completo. Un build o una pantalla renderizada no demuestra integridad funcional ni seguridad.
