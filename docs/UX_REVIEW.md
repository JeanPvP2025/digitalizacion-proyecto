⚠️ DEGRADED: single-context (el usuario declinó subagentes; evaluaciones A y B secuenciales)

# Auditoría UX de NODRIA

> **Actualización de integración (2026-10-07):** el trabajo de UX retiró métricas/testimonios no verificados, ajustó el home a precios fixture, facilitó recuperar/vaciar la configuración del PC Builder y aclaró categorías/configuración. La navegación móvil y errores del formulario B2B también recibieron cambios. Este informe sigue siendo baseline para checkout/carrito, precios, enlaces y otros hallazgos; ver `STATUS.md` y `AGENT_HANDOFF.md`.

**Fecha:** 7 de octubre de 2026
**Alcance:** home, catálogo, ficha, carrito/checkout demo, B2B, PC Builder, cuenta/acceso, soporte y backoffice.
**Baseline:** checkout local en `707b97b`; el árbol ya contenía cambios no integrados en múltiples rutas y documentos antes de esta auditoría.
**Método:** lectura de código y recorrido en navegador local Next.js 16.4 a 1250×724; prueba de un producto desde catálogo hasta checkout; envío B2B con datos ficticios para comprobar el contrato. Detector Impeccable sobre `app/`. No se hicieron cambios de código.

## Evaluación ejecutiva

La tienda tiene una identidad visual reconocible y el recorrido de compra básico se entiende: categoría, ficha, carrito y checkout comunican precio, disponibilidad, garantía y que el pago es simulado. El PC Builder también presenta compatibilidad y coste a partir de fixtures, con límites descritos.

La experiencia no está lista para dar por terminados los flujos: el formulario B2B falla en servidor con todas las opciones que ofrece la interfaz; la categoría Componentes abre una lista vacía; en la vista observada, las páginas B2B y backoffice pierden sus estilos modulares; y en móvil las reglas CSS ocultan navegación principal y cuenta sin ofrecer menú alternativo. Además, varias señales de confianza parecen reales pese a que los datos son ficticios.

**Veredicto de especificidad:** el storefront sí se siente ligado a NODRIA: bosque oscuro, acento lima, tipografías editoriales y metadatos técnicos funcionan bien para un retailer de tecnología que promete criterio. Esa identidad no llega de forma consistente a B2B/backoffice en la ejecución observada, y las señales de confianza de la home no distinguen ficción de experiencia real.

## Salud heurística

Puntuación para el conjunto de flujos; las diez heurísticas aplican. Cada número es una puntuación de 0–4.

| # | Heurística | Puntuación | Evidencia principal |
|---|---|---:|---|
| 1 | Visibilidad del estado | 2 | Hay cintillo demo, estados de carrito y confirmaciones; el error B2B no identifica el campo rechazado. |
| 2 | Correspondencia con el mundo real | 2 | Español, EUR y lenguaje de producto claros; cifras ficticias y precio contradictorio reducen confianza. |
| 3 | Control y libertad | 2 | Se puede cambiar cantidades, quitar artículos y reintentar pagos demo; no se recupera una configuración guardada. |
| 4 | Consistencia y estándares | 2 | Tienda coherente; B2B/backoffice aparecen sin el estilo modular esperado y las señales demo varían entre rutas. |
| 5 | Prevención de errores | 1 | B2B permite completar el formulario pero falla por contrato; checkout vacío conserva botón activo y el carrito deja exceder stock antes del servidor. |
| 6 | Reconocimiento antes que recuerdo | 3 | Formularios etiquetados, filtros con conteo, breadcrumbs y CTAs principales visibles. |
| 7 | Flexibilidad y eficiencia | 2 | Hay búsqueda, orden y atajos por enlaces; `⌘ K` se muestra pero no ejecuta una acción. |
| 8 | Diseño estético y minimalista | 2 | Buen foco visual en storefront; cabecera alta, microtexto pequeño y pantallas internas sin estilo afectan la lectura. |
| 9 | Recuperación de errores | 2 | Checkout ofrece estados ficticios de rechazo/reintento; B2B retorna un error genérico y no señala la causa. |
| 10 | Ayuda y documentación | 2 | Soporte y datos demo están explicados; no hay ayuda contextual para compra, guardado o estados operativos. |
| **Total** |  | **20/40 · Aceptable** | **Hay base visual sólida, con varios bloqueos antes de una demo fiable para usuarios.** |

## Hallazgos priorizados

Esfuerzo estimado de implementación: **XS** unas horas; **S** una tarea pequeña; **M** requiere coordinación o varias superficies.

| ID | Prioridad | Impacto / esfuerzo | Ruta y evidencia | Cambio concreto |
|---|---|---|---|---|
| UX-01 | **P0 · bloqueante** | Impide completar el contacto B2B / **S** | `/empresas#solicitar`: el formulario ofrece `1–5 equipos`, `6–25 equipos`, `26–100 equipos`, `Más de 100 equipos`, `Proyecto de infraestructura` y `Por definir` ([business-quote-form.tsx:150](components/business/business-quote-form.tsx:150)); `/api/quotes` solo acepta `1-10`, `11-50`, `51-200` y `200+` ([route.ts:14](app/api/quotes/route.ts:14)). Envío ficticio validado por el navegador terminó en **HTTP 400** y alerta “Revisa los campos obligatorios y vuelve a intentarlo.” | Definir un contrato compartido de volumen o convertir explícitamente los valores antes del POST. Alinear mensaje y validación para que un rechazo explique el campo. Repetir el recorrido y verificar que la solicitud queda registrada en el destino demo esperado. |
| UX-02 | **P1 · mayor** | B2B y operaciones pierden jerarquía visual / **M** | `/empresas` y `/backoffice`: capturas del navegador local mostraron contenido en flujo HTML sin la composición prevista; el DOM de `/empresas` no llevaba clases de módulo y el CTA incluía `undefined button button--accent`. Ambas rutas importan CSS Modules (`business-page.module.css`, `operations-center.module.css`). | Corregir el mapeo/export de clases de los CSS Modules en estas rutas y validar en navegador que los nombres de clase llegan al DOM y que el estilo se aplica. Revisar también el estado responsive tras restaurarlos. |
| UX-03 | **P1 · mayor** | Navegación y cuenta quedan ocultas en móvil / **S** | En `app/globals.css:407-422`, bajo 760 px se oculta `.primary-nav`; hasta 1100 px también se oculta `.account-link`. La subnav queda como tira horizontal de categorías, y allí no están PC Builder, Empresas ni cuenta. No existe control de menú alternativo en `StoreHeader`. | Sustituir los enlaces ocultos por un menú móvil con Tienda, Componentes, PC Builder, Empresas, cuenta, favoritos y carrito. Mantener destinos prioritarios y áreas táctiles accesibles. |
| UX-04 | **P1 · mayor** | Confianza y privacidad de operaciones / **M** | “Portal equipo” está enlazado desde la navegación pública ([store-header.tsx:56](components/storefront/store-header.tsx:56)). `/backoffice` lee pedidos y datos de cliente demo en `app/backoffice/page.tsx` sin una comprobación de sesión/rol. Hoy los registros son locales y ficticios; si se conecta información real, la ruta no puede quedar expuesta así. | Retirar el enlace público o convertirlo en acceso para personal; exigir autorización server-side antes de leer pedidos o inventario. Mantener la aclaración de demo dentro del backoffice, no como sustituto del control de acceso. |
| UX-05 | **P1 · mayor** | Afirmaciones de confianza parecen verificadas / **XS** | En home se muestran `+12.000 proyectos`, `4,8/5`, `24 h` y reseñas con “Cliente verificada” ([page.tsx:36-38](app/(store)/page.tsx:36), [page.tsx:15-17](app/(store)/page.tsx:15)). El brief define personas y valoraciones como ficticias. En la ficha, en cambio, las reseñas sí se describen como datos de demostración. | Etiquetar de forma visible estadísticas y testimonios como demostración en todas las rutas o sustituirlos por texto de producto sin datos verificables. Usar la misma convención en home y ficha. |
| UX-06 | **P1 · mayor** | Duda de precio en la decisión de compra / **XS** | El hero anuncia “Desde 1.299 € · Configurable” ([page.tsx:48](app/(store)/page.tsx:48)); la tarjeta y la ficha muestran 1.499 €. El catálogo no permite configurar ese portátil. | Usar precio y estado de configuración del mismo dato de producto; si existe una variante de entrada, exponerla como tal y enlazar a la selección correspondiente. |
| UX-07 | **P2 · menor** | Un destino de navegación principal no da resultados / **S** | Home y ambas navegaciones enlazan `categoria=componentes`; la ruta en navegador muestra **0 resultados** y el conteo de la tarjeta también es 0, pese al copy “Piezas para crear tu propio equipo”. El catálogo contiene seis productos y ninguno está en categoría Componentes ([lib/catalog.ts](lib/catalog.ts)). | Añadir productos demo a esa categoría, conectar los componentes demo del Builder a un listado de catálogo, o quitar la categoría y renombrar sus enlaces hasta que haya contenido. No dejar un destino prominentemente vacío sin contexto. |
| UX-08 | **P2 · menor** | El historial de cuenta puede no mostrar la compra / **S** | Checkout permite editar el correo; el modo demo de `/mi-cuenta` siempre consulta `alex.garcia@demo.nodria.test` ([mi-cuenta/page.tsx:18-34](app/(store)/mi-cuenta/page.tsx:18)). El aviso explica el correo fijo, pero el comprador puede cambiarlo sin aviso de que perderá el vínculo. | En modo demo, fijar el correo de prueba con explicación o asociar el historial a un correo ingresado/identificador persistente. En modo conectado, mostrar solo pedidos del usuario autenticado. |
| UX-09 | **P2 · menor** | “Guardar configuración” no permite volver a la configuración / **S** | PC Builder escribe selección en `localStorage` y enseña confirmación ([pc-builder.tsx:38-40](components/storefront/pc-builder.tsx:38)); al abrir o recargar la ruta siempre se inicia con `defaultSelection`, y no hay acción para restaurar. | Leer y validar la selección al iniciar; ofrecer “Cargar configuración”/“Restablecer”, o cambiar la etiqueta a “Guardar solo en este navegador” y quitar la promesa de recuperarla desde Mi espacio. |
| UX-10 | **P2 · menor** | Checkout transmite una falsa continuidad y precio incompleto / **S** | Abrir `/checkout` sin artículos deja el formulario y botón “Confirmar compra demo” activos con total `0,00 €`; la API rechaza carrito vacío solo al enviar. En carrito, el envío bajo 100 € figura como “Calculado” y el total no lo incluye; checkout aplica 5,90 €. | Con carrito vacío, presentar CTA para volver al catálogo y deshabilitar el envío. Mostrar el importe de envío/total estimado en carrito antes de avanzar; mantenerlo idéntico en checkout. |
| UX-11 | **P2 · menor** | Dos affordances no responden como parecen / **XS** | Cabecera anuncia `⌘ K`, pero la búsqueda es un formulario normal sin listener de atajo ([store-header.tsx:35](components/storefront/store-header.tsx:35)). El pie muestra “VOLVER ARRIBA” como `span`, no como enlace ni botón ([store-footer.tsx:18](components/storefront/store-footer.tsx:18)). | Implementar el atajo con foco y cierre/limpieza, o retirar la indicación. Hacer “Volver arriba” un enlace a `#top` o eliminar el tratamiento de acción. |

## Evidencia por ruta y límite funcional

| Ruta | Observado en navegador | Qué demuestra y qué no |
|---|---|---|
| `/` | Home con jerarquía editorial, CTA de catálogo/B2B, productos y testimonios. En la tarjeta de FluxBook se ve 1.499 € frente a 1.299 € del hero. | Composición visual y navegación existen. Las cifras/testimonios son contenido estático demo sin etiqueta explícita. |
| `/catalogo` | Seis productos demo; búsqueda, orden y categorías visibles. | Controles de búsqueda/orden son UI conectada a fixtures locales; no demuestra lectura Supabase ni catálogo completo. |
| `/catalogo?categoria=componentes` | 0 resultados, “No encontramos lo que buscas” y conteo 0; “Limpiar búsqueda” sí devuelve a catálogo. | Estado vacío está explicado, pero el propio destino de navegación no tiene inventario asociado. |
| `/producto/fluxbook-14-pro` | Especificaciones, stock demo, precio, garantía, devolución, favoritos/comparar y añadir al carrito. La sección inferior indica reseñas demo. | Ficha estática demo; cantidad de valoraciones y reseñas no representan compras reales. CTA de carrito sí actualiza contador local. |
| `/carrito` | Tras añadir FluxBook desde catálogo: contador 1, línea de producto y total 1.499 €. Vaciar carrito devuelve un estado vacío con CTA a catálogo. | Carrito funciona en `localStorage`; no es autoridad de precio/stock y puede divergir hasta la verificación server-side. |
| `/checkout` | Con artículo: formulario con dirección demo y cinco resultados de pago simulados; copy advierte que no hay pasarela ni tarjeta. Sin artículo: botón sigue activo y total 0 €. | El formulario y los estados están implementados; esta auditoría no envió el pedido para no escribir un registro local. La persistencia de órdenes no quedó probada aquí. |
| `/empresas#solicitar` | Formulario con campos etiquetados y consentimiento; un envío válido para el navegador respondió 400 con mensaje genérico. | El flujo de solicitud no es completables con las opciones actuales. Aun alineado, el destino descrito en el proyecto es local/demo, no CRM operativo. |
| `/configurador` | Ocho categorías preseleccionadas; revisión “Compatibilidad correcta”, consumo estimado 444 W, fuente ≥550 W y coste 1.842 €. La página avisa de fixtures demo y cálculo orientativo. | Reglas de compatibilidad y precios salen de fixtures. Añadir a carrito está integrado por código; guardado solo escribe en navegador y no se restaura. |
| `/mi-cuenta` | Muestra “Hola, Alex”, cero pedidos y aviso “Cuenta demo local” con el correo fijo. | No es cuenta autenticada en modo local. No demuestra Auth/RLS/Supabase; los pedidos demo se filtran por correo fijo. |
| `/acceso` | Formulario de iniciar sesión/crear cuenta/recuperación. El texto explica que no hay sesión real sin Supabase. | Se puede recorrer la UI; sin variables/configuración Supabase no se verifica una sesión real. La pantalla observada se ve menos trabajada que el storefront. |
| `/soporte` | Formulario con tema, pedido opcional, mensaje y advertencia de almacenamiento local/datos ficticios. | El intake está implementado por API local según código; esta auditoría no lo envió. No hay conversación/ticket consultable ni cola de soporte integrada en backoffice. |
| `/backoffice` | Cero pedidos y ventas, 138 unidades de fixtures, un producto con stock bajo; el copy declara local/demo. Vista observada sin composición CSS prevista. | Panel de lectura de registros locales y catálogo fixture. No es inventario conectado, analítica real ni acceso de personal protegido. |

## Recorrido principal observado

1. **Home → catálogo:** “Explorar la tienda” abre el listado; las tarjetas de categorías ayudan a orientarse, salvo Componentes, que lleva a cero resultados.
2. **Catálogo → ficha:** FluxBook 14 Pro expone precio, stock y especificaciones. El hero previo deja una expectativa de 1.299 € que la ficha cambia a 1.499 €.
3. **Ficha/catálogo → carrito:** añadir el producto actualiza el contador; en navegador se observó una línea y total de 1.499 €. Las cantidades se pueden editar. El servidor es quien recalcula el pedido en el checkout demo.
4. **Carrito → checkout:** el resumen del pedido y las opciones `DEMO-*` están visibles y el sistema dice que no pide tarjeta. La auditoría no confirmó un pedido para no dejar datos demo persistidos.
5. **Checkout → cuenta:** el checkout permite cambiar correo, pero la cuenta local mantiene el correo fijo de Alex. Para una dirección distinta, la continuidad del historial falla.

El recorrido B2B se inicia desde el hero, baja al formulario y termina en un error aunque todos los campos pasen la validación de navegador. Soporte expone intake local, pero no una conversación posterior que cierre la promesa de ayuda.

## Carga cognitiva, estados y accesibilidad

- **Decisiones con más de cuatro opciones:** el checkout presenta cinco radios de resultado demo a la vez; el volumen B2B ofrece seis opciones; PC Builder reparte ocho selectores por una página larga. Son útiles para la demo técnica, pero no deberían confundirse con métodos de pago, productos o configuraciones persistidas de una tienda real. Agrupar escenarios de pago bajo “resultado de simulación” y añadir presets por uso al Builder reduciría la carga inicial.
- **Estados:** el carrito tiene carga y vacío; operaciones distingue sin registros de filtros sin coincidencia; formulario B2B tiene alerta y estado de envío. Mejorar el error del servidor con campo y solución. Checkout vacío debe resolverse antes de mostrar datos de entrega.
- **Reconocimiento:** inputs de catálogo, pedido, soporte y B2B están etiquetados; cantidad y favoritos ofrecen nombres accesibles. No se hizo una validación WCAG de contraste ni navegación completa con lector de pantalla.
- **Lectura:** varios metadatos/ayudas usan tamaños de 7–10 px en CSS; son legibles en la captura de escritorio, pero conviene revisar a 200 % y en móvil, especialmente en tarjetas y formularios.
- **Móvil en la auditoría inicial:** el viewport dedicado no estuvo disponible entonces; la tira horizontal de categorías y la falta de enlaces principales alternativos se detectaron por CSS. La revisión posterior a 390 px queda registrada abajo.

## Fortalezas

1. La home expresa con claridad la propuesta “tecnología elegida con criterio” y ofrece caminos distintos a tienda, empresas y construcción de PC.
2. La ficha de producto reúne precio, especificaciones, stock, garantía, devoluciones y acciones principales en una jerarquía fácil de recorrer.
3. Los límites del pago demo se comunican varias veces, no se solicita tarjeta y se distinguen escenarios de aprobado, rechazo, fondos insuficientes y procesamiento.

## Recorrido por personas

- **Jordan, primera compra:** la categoría Componentes parece un camino válido y termina vacía; la cuenta “Hola, Alex” puede parecer una sesión real hasta leer el aviso; el precio cambia al entrar en la ficha. Hace falta mayor continuidad y etiquetas demo cerca de cada afirmación.
- **Casey, móvil y con interrupciones:** desaparecen Tienda, PC Builder, Empresas y cuenta de la cabecera sin un menú alternativo; PC Builder exige recorrer ocho piezas y el estado guardado no se recupera al volver.
- **Riley, prueba los bordes:** selecciona un volumen B2B válido y recibe un 400 genérico; abre checkout con carrito vacío y ve un botón activo; incrementa artículos y solo el servidor pone el límite de stock/cantidad. Los límites son detectables tarde.

## Recomendación de secuencia

1. **Bloqueante de conversión:** alinear el contrato de volumen B2B entre formulario y API; comprobar respuesta 201/estado guardado con datos de prueba.
2. **Confianza y protección:** aplicar estilos en B2B/backoffice; cerrar `/backoffice` a público y roles no autorizados; ocultar o rotular métricas y reseñas ficticias.
3. **Compra móvil y precios:** restaurar navegación móvil, unificar precio FluxBook y mostrar envío/total antes de checkout; bloquear checkout vacío.
4. **Continuidad:** vincular correo de pedido a cuenta demo o fijarlo explícitamente; hacer recuperable una configuración guardada o cambiar su promesa.
5. **Pulido:** conectar el atajo de búsqueda o quitarlo, convertir “Volver arriba” en acción real, y revisar microtexto a 200 %.

## Alcance y verificaciones de la auditoría inicial

- Leídos antes de empezar: `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/STATUS.md`, `docs/WORKSTREAMS.md`, `docs/AGENT_HANDOFF.md`; revisión de estado Git: baseline `707b97b`, ya con cambios no integrados antes de la auditoría.
- `corepack pnpm install --frozen-lockfile`: correcto; resolvió 366 paquetes usando el store local, sin descargas.
- `corepack pnpm dev --hostname 127.0.0.1 --port 3100`: servidor Next 16.4 listo. Una invocación previa con separador extra (`pnpm dev -- --hostname ...`) falló al tratar `--hostname` como directorio; se corrigió.
- Rutas observadas en navegador local devolvieron HTTP 200; el envío B2B de comprobación devolvió `POST /api/quotes 400`. No se creó `.data/`.
- Detector: `impeccable.cmd detect --json app`, salida 0; un aviso advisory `codex-grid-background` en `app/globals.css:116`. La rejilla está limitada al hero y encaja con el lenguaje técnico del brief; no la considero defecto.
- Slug Impeccable: `app`. `.impeccable/critique/ignore.md`: ausente. Evaluación A antes de B; misma sesión porque el usuario declinó subagentes, por eso se marca como degradada.
- El navegador permitió observar y capturar páginas, pero su evaluación JavaScript es de solo lectura: no se inyectó overlay de detector. Capturas fueron inspeccionadas en la sesión y no se guardaron como archivos.
- Servidor temporal cerrado con Ctrl+C y pestaña temporal cerrada. La instalación materializó `node_modules/` desde caché y Next generó su salida de desarrollo ignorada bajo `.next/`; no guardé capturas ni otros temporales. No se ejecutaron lint, build, tests, Supabase/PostgreSQL ni pruebas RLS; no se configuraron credenciales. El checkout no se envió para evitar persistir un pedido ficticio. No se verificó viewport móvil dedicado.
- La auditoría inicial quedó archivada en este archivo. Su seguimiento de implementación y los checks del storefront se registran a continuación.

## Preguntas para la siguiente iteración

1. ¿Qué bloqueador conviene resolver primero?
   - **A.** Contrato B2B para que el formulario pueda registrar solicitudes.
   - **B.** Estilos, acceso y navegación móvil de B2B/backoffice.
   - **C.** Confianza y continuidad de compra: precios, señales demo, cuenta y guardado del Builder.
2. Para métricas y reseñas ficticias, ¿qué dirección refleja mejor la demo?
   - **A.** Conservarlas con una etiqueta visible “Datos de demostración”.
   - **B.** Sustituirlas por copy sin cantidades ni testimonios.

## Seguimiento storefront UX — 2026-10-07

Este bloque actualiza los hallazgos dentro del ownership storefront asignado. La puntuación `20/40` y las observaciones anteriores reflejan la auditoría inicial; no se recalculó el resto de rutas ni se cerró la auditoría global.

| Hallazgo | Estado de este seguimiento | Evidencia y límite |
|---|---|---|
| UX-05 · métricas, reseñas y promesas de confianza | **Parcial; quedan superficies fuera de ownership** | Home ya no presenta cifras ni testimonios como reales y declara que catálogo, valoraciones y reseñas son ficticios. Se retiraron del home las promesas de envío, montaje, garantía y atención. Las tarjetas destacadas rotulan precio, descuento, stock y valoración como datos demo. El listado `/catalogo`, la cifra de valoración superior de la ficha de producto, la cabecera y el pie conservan contenido generado por otras superficies; necesitan revisión de sus propietarios. |
| UX-06 · precio del FluxBook | **Corregido en Home** | Hero usa `demoProducts[0].price` y muestra `1.499 €`, igual que la tarjeta; se quitó “Desde 1.299 € · Configurable”. |
| UX-07 · categoría Componentes vacía | **Parcial; bloqueada en navegación/catálogo compartidos** | La tarjeta de Home explica que el catálogo demo no tiene piezas sueltas y abre PC Builder. La navegación global y `/catalogo?categoria=componentes` aún llevan al estado sin resultados. |
| UX-09 · recuperación del PC Builder | **Corregido** | La selección se restaura desde `nodria.pc-build.v1` solo si sus ocho IDs siguen perteneciendo a la categoría correspondiente. Hay un botón para restablecer el ejemplo y borrar el guardado local. En navegador se guardó una selección, se recargó la página, se comprobó la recuperación y se restableció el ejemplo; no quedó el fixture de prueba guardado. |
| UX-10 · envío en carrito y checkout vacío | **Bloqueado por ownership** | No se modificaron `components/storefront/store-interactions.tsx` ni `components/storefront/checkout-form.tsx`. En el checkout móvil se verificó que un carrito vacío mantiene el formulario, el botón de confirmación y un total `0,00 €`. El resumen del carrito aún llama “Calculado” al envío bajo 100 € y no lo suma al total; el checkout calcula 5,90 € en ese tramo. La política de envíos confirma que es un importe de ejemplo, sin transportista ni entrega real. Coordinación necesaria con los propietarios de carrito/checkout; no se tocó la API de checkout. |

### Revisión visual y verificación

- Revisión en navegador con viewport de escritorio `1280×720` y móvil `390×844`: Home, categorías y PC Builder; carrito vacío y checkout vacío en móvil. El hero, la tarjeta de Componentes y las tarjetas de categoría se ajustan al ancho observado. En móvil, el resumen del Builder aparece antes que la lista de piezas. No se hizo validación WCAG ni prueba a zoom 200 %.
- La tira horizontal de categorías del header sigue mostrando solo parte de los destinos móviles; es un hallazgo global fuera de esta asignación. La cabecera y pie también conservan copy de atención humana que requiere verificación del propietario de esas superficies.
- `pnpm install --frozen-lockfile`: correcto, paquetes reutilizados desde el store local; lockfile sin cambios por esta instalación.
- `pnpm exec tsc --noEmit`: correcto tras generar los tipos Next con build.
- `pnpm exec eslint -- 'app/(store)/page.tsx' 'app/(store)/configurador/page.tsx' components/storefront/pc-builder.tsx components/storefront/product-card.tsx`: correcto.
- `pnpm lint`: correcto, con cuatro avisos `<img>`/`eslint-disable` en `store-collections.tsx` y `store-interactions.tsx`, ambos fuera de este ownership.
- `pnpm test`: correcto, 10 pruebas Vitest y 19 pruebas Node. Hay avisos `MODULE_TYPELESS_PACKAGE_JSON` preexistentes; todas las pruebas pasan.
- `pnpm build`: correcto con Next.js 16.4.0; compilación, TypeScript y generación de 28 páginas completadas.
- `impeccable.cmd detect --json 'app/(store)/page.tsx' 'app/(store)/configurador/page.tsx' components/storefront/pc-builder.tsx components/storefront/product-card.tsx`: salida `[]`.
- No cambiaron contratos de API ni base de datos. Se conserva la clave local existente del Builder; no se añaden persistencia remota ni garantías de compra. No se creó un pedido demo ni se dejó un guardado de prueba.
