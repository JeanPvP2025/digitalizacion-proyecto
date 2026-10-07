# Revisión independiente de arquitectura NODRIA

**Fecha del snapshot:** 2026-10-07

**Alcance:** contraste de `docs/ARCHITECTURE.md` y `docs/DECISIONS.md` con el árbol de trabajo, los contratos SQL y el ownership actual. Auditoría estática; no se cambiaron código ni documentos globales.

## Veredicto

La decisión de mantener un monolito modular Next.js con Supabase/PostgreSQL como destino sigue siendo coherente con el producto y no hay evidencia que justifique cambiar el stack. `D-004` está materializada en el despliegue como una aplicación única; la separación por dominio aún es más una intención que una frontera aplicada al código. No observé dependencias circulares en el grafo estático de imports revisado.

Los documentos describen correctamente que la integración y la seguridad siguen en curso, pero el código tiene dos riesgos que requieren atención antes de exponer datos reales: la ruta interna `/backoffice` no exige autorización, y la lectura del archivo local de pedidos no tiene una guarda de entorno. Además, la activación de Supabase no conecta checkout, B2B ni soporte; el contrato B2B implementado tampoco coincide todavía con el contrato público de la migración.

**Prioridades:** P1 bloquea el uso con datos reales o una declaración de integración; P2 debe resolverse durante la integración del dominio; P3 necesita un owner antes de iniciar ese trabajo.

## Base de revisión y límites

Se leyeron `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `STATUS.md`, `WORKSTREAMS.md`, `AGENT_HANDOFF.md` y `database.md`, además de rutas, componentes, librerías, configuración, migración y seed.

El árbol estaba en `HEAD (no branch)`, con `707b97b Initial commit from Create Next App` como único commit visible. La implementación auditada contiene muchos archivos modificados o no rastreados en ese árbol; por tanto, este informe describe el snapshot de trabajo y no atribuye sus cambios a commits anteriores. `node_modules` no está presente en este worktree. No se ejecutaron build, lint, pruebas, `supabase db reset` ni validación PostgreSQL; se usaron inspecciones estáticas y referencias a verificaciones ya registradas en `STATUS.md`.

## Mapa observado

```mermaid
flowchart TD
  Browser[Browser]
  Store[Storefront Server Components]
  Client[Client Components: localStorage y formularios]
  Fixtures[Fixtures: lib/catalog y lib/pc-builder]
  API[Route Handlers: checkout, quotes, support]
  Files[Archivos locales ignorados en .data]
  AuthUI[AuthForm: cliente Supabase]
  Proxy[proxy.ts: refresh de claims/cookies]
  Account[mi-cuenta: servidor]
  Supa[(Supabase Auth + PostgreSQL)]
  Backoffice[/backoffice: servidor]

  Browser --> Store
  Store --> Fixtures
  Store --> Client
  Client -->|carrito, favoritos, comparación| Browser
  Client -->|POST| API
  API --> Fixtures
  API --> Files
  AuthUI --> Supa
  Browser --> Proxy
  Proxy --> Supa
  Account -->|getUser y lectura de orders| Supa
  Account -->|sin credenciales| Files
  Backoffice --> Files
  SQL["Migración: 27 tablas con RLS y public.place_order"] -. "sin consumidor de checkout en app/lib" .-> Supa
```

| Capa | Implementación observada | Estado real |
|---|---|---|
| Rutas públicas | Grupo `app/(store)`, layouts, páginas de catálogo y producto | Server Components consumen principalmente `lib/catalog.ts`; los datos son fixtures locales. |
| Interacción de compra | `store-interactions.tsx` conserva carrito, favoritos y comparación en `localStorage`; `checkout-form.tsx` envía IDs/cantidades y datos de cliente | El servidor vuelve a validar y recalcular el checkout demo, pero aún consulta fixtures, no catálogo, precios ni stock de Supabase. |
| Persistencia local | `lib/server/demo-orders.ts` y `demo-inbox.ts` serializan escrituras a JSON bajo `.data/` | Útil para un proceso local Node; la cola es memoria de proceso y no constituye persistencia compartida o transaccional. |
| Supabase/Auth | Cliente browser para Auth; cliente SSR; `proxy.ts` llama `getClaims`; `mi-cuenta` valida `getUser` y lee `orders` | Solo la ruta de cuenta hace una consulta de dominio observada. El proxy renueva cookies/claims, no autoriza rutas o roles. |
| Base de datos | Una migración crea 27 tablas con RLS, funciones privadas y `public.place_order`; seed ficticio | Contrato escrito, sin ejecución PostgreSQL comprobada. No se encontró una llamada de aplicación a `place_order`. |
| Operaciones | `/backoffice` lee pedidos demo y el fixture del catálogo | Renderizado de servidor, públicamente accesible; no usa una consulta staff autenticada ni inventario conectado. |

## Hallazgos priorizados

### P1 — `/backoffice` no aplica autorización de staff y muestra información de pedidos

`app/backoffice/page.tsx:18` carga pedidos al procesar la página y `:52` entrega los registros a `OperationsCenter`; no consulta Auth ni comprueba un rol. La tabla renderiza referencias, identificadores, nombre y correo del cliente en `components/backoffice/operations-center.tsx:340` y `:341`. La autorización pendiente que reconoce `STATUS.md:15` es, por tanto, una brecha actual de la ruta, no solo una fase futura.

Los pedidos ahora son demo, pero la API acepta datos de contacto y el propio modelo de pedido incluye teléfono y dirección (`lib/server/demo-orders.ts:14`). El límite de demo no sustituye a una guarda de acceso.

**Remediación incremental:** proteger la ruta en servidor con la sesión y el rol staff que defina Auth/RBAC; comprobar acceso también en cualquier futura acción de operaciones; después limitar los campos que se renderizan. Mantenerla como demo deliberada hasta que la guarda y su prueba de acceso estén integradas.

### P1 — Los lectores del archivo demo no quedan limitados al entorno local

Los escritores de checkout, solicitudes B2B y soporte rechazan el modo demo cuando `NODE_ENV === "production"` (`app/api/checkout/route.ts:31`, `app/api/quotes/route.ts:20`, `app/api/support/route.ts:17`). Sin embargo, `getDemoOrderRecords()` solo lee `.data/orders.json` y no comprueba el entorno (`lib/server/demo-orders.ts:55`). `mi-cuenta` usa esa lectura cuando el cliente Supabase no se crea (`app/(store)/mi-cuenta/page.tsx:18`, `:32`); `/backoffice` la usa sin condición (`app/backoffice/page.tsx:19`). Esto diverge del brief y de arquitectura, que restringen el fallback de archivos a desarrollo local.

**Remediación incremental:** centralizar la resolución del modo de datos en servidor y hacer que lectores y escritores compartan la misma política. En cualquier entorno distinto de desarrollo local, una configuración sin Supabase debe devolver un estado explícito sin leer `.data`; el backoffice debe quedar además detrás de P1 anterior. No asumir que ignorar `.data` en Git impide que un archivo exista en el runtime.

### P1 — B2B público no tiene una ruta funcional con Supabase configurado y su contrato no está cerrado

El formulario recoge `volume` (`components/business/business-quote-form.tsx:62`, `:149`); la ruta lo exige y lo guarda en el JSON demo (`app/api/quotes/route.ts:14`, `:36`). Al detectar credenciales, la ruta responde 503 diciendo que requiere sesión empresarial (`app/api/quotes/route.ts:20`, `:23`) y no crea un cliente Supabase. En cambio, la migración permite insertar de forma anónima en `quote_inquiries` (`supabase/migrations/20261007073027_nodria_commerce_foundation.sql:1150`) con grants de columnas para `contact_name`, `email`, `phone`, `company`, `message` y `consent_to_contact` (`:1253`). Esa tabla no contiene `volume` (`:338`–`:353`), aunque el flujo documentado permite solicitudes antes de crear cuenta (`docs/database.md:11`).

**Remediación incremental:** el owner B2B y el owner de `supabase/**` deben acordar el mapeo antes de conectar el formulario: decidir si `volume` se conserva en una migración reproducible o se retira del intake; convertir explícitamente `privacyAccepted` a `consent_to_contact`; usar la inserción anónima estrechamente concedida descrita por el contrato; y hacer que la respuesta confirme la persistencia real. No exigir sesión empresarial para la solicitud pública pre-cuenta.

### P1 — Checkout/soporte siguen desconectados del modelo Supabase; no declarar esos dominios conectados

`app/api/checkout/route.ts:43` rechaza la ruta conectada con 503; en demo recalcula desde `demoProducts` y `pcBuilderComponents` (`:64`–`:80`) y guarda en archivo (`:106`). No se encontró llamada desde `app/`, `components/` o `lib/` a `public.place_order`. El SQL sí exige un carrito autenticado y mantiene precio/stock en la transacción (`docs/database.md:9`). Soporte sigue en la misma separación: la ruta demo escribe en archivo, y cuando hay credenciales responde 503 (`app/api/support/route.ts:20`, `:31`), mientras que el contrato SQL exige `customer_id` y puede enlazar `order_id` (`supabase/migrations/20261007073027_nodria_commerce_foundation.sql:355`, `:358`, `:360`).

Esto coincide con el estado `In progress` en `STATUS.md:9`, `:14` y con el handoff de base; no es motivo para reemplazar el stack ni para marcar un workflow como terminado. Es un bloqueo real para cualquier despliegue que prometa persistencia integrada.

**Remediación incremental:** conectar primero sesión y carrito persistido; en checkout, invocar `place_order` con idempotencia y tratar sus errores; en soporte, asociar el ticket a usuario y pedido autorizado en servidor. No pasar precio, stock, customer ID ni autorización desde el browser como autoridad. Mantener la ruta demo separada y explícita.

### P2 — Los indicadores de modo permiten una aplicación híbrida y la cuenta puede leer el origen equivocado

Checkout habilita archivo local si `DEMO_MODE=true`, incluso cuando las credenciales Supabase están completas (`app/api/checkout/route.ts:30`, `:31`). B2B y soporte, en cambio, consideran demo solo cuando faltan credenciales (`app/api/quotes/route.ts:20`; `app/api/support/route.ts:17`). La cuenta elige Supabase simplemente si puede construir el cliente (`app/(store)/mi-cuenta/page.tsx:18`, `:24`). Por tanto, en desarrollo con credenciales y `DEMO_MODE=true`, checkout escribe un pedido local mientras la cuenta lee exclusivamente `orders` de Supabase; B2B y soporte fallan con 503. `.env.example:8` deja `DEMO_MODE=true` junto con las variables públicas vacías (`:2`–`:3`), y no hay contrato único de modo de datos.

**Remediación incremental:** definir un modo server-only discriminado (`demo-local` o `supabase`) y derivarlo una vez de la configuración validada. Si no se puede garantizar que un workflow esté conectado, responder con estado explícito, sin alternar silenciosamente de origen entre rutas. Cubrir las combinaciones de variables como tabla de configuración cuando se integre QA.

### P2 — Los límites de dominio no están reflejados aún en módulos de casos de uso

`D-004` conserva la decisión correcta de monolito, pero las Route Handlers mantienen esquema, validación, reglas de compra e I/O local dentro de `app/api/*`; no hay módulos de caso de uso/repository para Commerce, Quotes o Support en este snapshot. El carrito y las listas comparten funciones y tipos dentro de `components/storefront/store-interactions.tsx`; catálogo público y checkout importan fixtures directamente. Así, la estructura no hace cumplir la propiedad de reglas prevista en `ARCHITECTURE.md:56`–`:62`.

No se observó un ciclo de import estático: la dirección principal va de rutas/componentes a `lib`, fixtures y utilidades; hay imports entre componentes de storefront, pero sin retorno desde `lib` a `app`/`components`. Este hallazgo es de acoplamiento y enforcement, no de ciclo probado.

**Remediación incremental:** al conectar cada dominio, extraer su esquema y casos de uso detrás de un contrato de servidor (`lib/commerce`, `lib/quotes`, `lib/support`) y dejar Route Handlers como adaptadores HTTP. Mantener `lib/server/*` para adaptadores demo de filesystem, sin convertirlos en la interfaz de dominio compartida con producción. Evitar una extracción transversal grande mientras los contratos activos están cambiando.

### P2 — Reglas y catálogos duplicados necesitan una fuente de verdad al integrar

El subtotal/envío se vuelve a calcular en UI (`components/storefront/checkout-form.tsx:35`, `:36`) y servidor (`app/api/checkout/route.ts:77`, `:78`); ambos coinciden hoy y el servidor prevalece, así que la duplicación actual es razonable para presentación. Pero datos comerciales están en dos fixtures: `lib/catalog.ts:29` y `supabase/seed.sql`; el PC Builder mantiene su catálogo y precio en `lib/pc-builder/fixtures.ts:10`, y el carrito crea IDs `builder:<id>` (`components/storefront/store-interactions.tsx:44`) que no son IDs de variantes persistidas. El contrato de `place_order` consume un carrito de base de datos, no líneas arbitrarias del browser (`docs/database.md:9`).

**Remediación incremental:** al integrar Storefront Data, elegir la base como fuente de precios/stock y mantener fixtures solo para demo. Mapear builds a variantes vendibles persistidas antes de que entren al checkout integrado. Mantener una sola regla autoritativa de envío/impuestos en servidor/SQL y tratar el total de UI como estimación.

### P2 — Pago simulado conectado todavía no resuelve el estado ni las reservas

`D-006`/`D-007` y `AGENT_HANDOFF.md` ya declaran que `place_order` crea el intento pendiente, pero falta registrar el resultado de demo y consumir/liberar la reserva al pago, rechazo o cancelación. El código local representa esos outcomes, pero no hay consumidor del RPC ni contrato DB para esa transición. Es una decisión abierta y correctamente reconocida, no una contradicción nueva de arquitectura.

**Remediación incremental:** Commerce y el owner de migraciones deben acordar una RPC limitada para registrar un outcome simulado con autorización e idempotencia y cerrar la reserva/transición de pedido atómicamente. Mientras no exista, los outcomes locales no deben describirse como estado conectado.

### P2 — Configuración de Auth no usa un origen de aplicación común

`.env.example:4` define `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, pero no se encontró una lectura de esa variable en la app. `supabase/config.toml:160` define `site_url` en `http://127.0.0.1:3000`, mientras la guía local abre `localhost:3000`; el formulario de recuperación construye el `redirectTo` desde `window.location.origin` (`components/storefront/auth-form.tsx:35`). Esto deja el flujo dependiente de una allowlist distinta según hostname y hace que la variable anunciada no sea efectiva. No existe configuración Vercel/entorno remoto en este árbol, coherente con los docs de despliegue previsto.

**Remediación incremental:** durante Auth/RBAC, definir el origen y allowlist por entorno (localhost consistente, Preview y producción) y verificar recuperación/confirmación desde cada host. No introducir URLs remotas inventadas ahora.

### P3 — Contenido y analítica no tienen owner asignado en el board actual

`STATUS.md:33` marca “Analytics y contenido” como pendiente. `WORKSTREAMS.md` contiene owners de catálogo, CRM, operaciones, Auth, comercio, soporte y B2B, pero no una fila para esos dos dominios. En el código y la migración inicial tampoco se observan tablas o módulos para CMS/analítica. Esto es alcance futuro, no falta de una implementación prometida: la arquitectura los define como dominios conceptuales. Antes de planificar su ejecución, asignar owner y especificar qué métricas se derivan de datos reales y qué contenido tiene dueño editorial.

## Decisiones: vigencia observada

| Decisión | Evaluación frente al código |
|---|---|
| D-003, mantener Next.js | Sigue vigente; la app y dependencias usan Next.js 16.4 / React 19.3 / TypeScript / Tailwind. No se propone migración. |
| D-004, monolito modular | Vigente. No hay infraestructura distribuida; falta consolidar fronteras por dominio a medida que se conecten workflows. |
| D-005, Supabase fuente de verdad prevista | Vigente como destino; aún no es verdad operativa general. Solo cuenta consulta Auth/`orders`; la migración no se ejecutó en PostgreSQL. |
| D-006 / D-007, simulación y checkout transaccional | Vigentes con brecha explícita: demo local funciona aparte del RPC; falta ciclo de resultado de pago/reservas conectado. |
| D-008, datos ficticios | Vigente. Debe acompañarse de las guardas de modo y la autorización P1 para que la etiqueta demo no sea la única protección. |
| D-009, sin Cache Components | Se refleja en `next.config.ts`: no se activa `cacheComponents` ni `partialPrefetching`. No encontré motivo para cambiar la decisión en este snapshot. |

## Plan de acción recomendado

1. **Auth/RBAC + integración:** cerrar autorización server-side de `/backoffice` y limitar acceso a los lectores de `.data`; registrar acceso denegado y cubrimiento de autorización antes de introducir datos que no sean ficticios.
2. **Contrato compartido:** acordar modo único (`demo-local`/`supabase`) y los contratos de `quote_inquiries`, `support_tickets`, carrito, variantes y RPC de resultado de pago antes de integrar rutas. El coordinador conserva ownership de contratos sensibles, según `WORKSTREAMS.md`.
3. **Conectar por dominio:** priorizar Auth/roles → catálogo/cart → checkout/pago → soporte/B2B; extraer casos de uso pequeños con adaptadores demo/Supabase sin crear servicios separados.
4. **Cerrar verificación DB:** cuando el entorno permita Docker/Postgres, ejecutar `supabase db reset`/`db lint`, inspección RLS/RPC y pruebas de flujos y concurrencia. El estado actual no tiene esos resultados en este worktree.
5. **Asignar lo pendiente:** crear ownership explícito para contenido y analítica cuando se planifique ese trabajo; no marcar esos dominios como implementados por aparecer en la arquitectura objetivo.

## Handoff y evidencia ejecutada

**Documento creado:** `docs/ARCHITECTURE_REVIEW.md`. No se editaron `ARCHITECTURE.md`, `DECISIONS.md`, código, migraciones ni otros documentos.

**Comandos/inspecciones ejecutados:**

- `git status --short --branch` → `HEAD (no branch)`; mostró cambios y archivos sin seguimiento en el snapshot existente.
- `git log -5 --oneline` → solo `707b97b Initial commit from Create Next App`.
- `rg --files` y listados de `app/`, `components/`, `lib/`, `supabase/` → inventario de rutas y módulos; no se halló `vercel.json`, suite/config de pruebas integrada ni CI en el árbol listado.
- `rg -n` sobre llamadas Supabase, RPC, guardas demo, imports, políticas y objetos SQL → evidencia citada arriba; no se encontró consumidor de `place_order` en la app.
- `Test-Path node_modules/next/dist/docs` → `False` en este worktree. No se escribió código, por lo que no se necesitó consultar guías de implementación de Next.js.

**Limitaciones:** revisión estática de un árbol mayoritariamente no rastreado; no hay dependencias instaladas ni servicios de Supabase/PostgreSQL verificados en este worktree. La seguridad efectiva de las policies, el comportamiento de Auth con redirect allowlists y los resultados de runtime quedan por validar. La verificación previa descrita en `STATUS.md` pertenece al checkout coordinador y no se repitió aquí.

**Riesgo principal:** no avanzar a datos no ficticios ni a un estado `Done` para checkout, B2B, soporte o backoffice hasta cerrar autorización, modo de datos y contrato conectado. La intención arquitectónica y la elección de stack se mantienen.
