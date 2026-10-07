# Revisión de accesibilidad WCAG 2.2 AA — NODRIA

> **Actualización de implementación (2026-10-07):** la segunda ola añadió skip link, foco visible, navegación móvil, announcements de carrito/colección y errores enlazados a campos. El informe conserva los hallazgos de baseline; no se ha hecho una auditoría manual completa posterior. No afirmar conformidad AA hasta cerrar el recorrido manual indicado en `STATUS.md`.

**Fecha:** 2026-10-07
**Worktree auditado:** `C:\Users\lopez\.codex\worktrees\ec0f\digitalizacion-web`
**Alcance:** storefront, formularios públicos y centro de operaciones. Auditoría de solo lectura; no se modificó código ni documentación distinta de este informe.

## Resultado

Las superficies revisadas **no alcanzan WCAG 2.2 AA**. Encontré 3 hallazgos P1 y 6 P2. Los problemas principales son un enlace para saltar la navegación inexistente, un campo de búsqueda sin foco visible y varios textos de bajo contraste. También hay estados de interfaz que no se comunican de forma fiable a tecnologías de asistencia.

La evaluación combina inspección de código con una pasada manual en el navegador integrado de Codex sobre Chromium, a 1280 × 720. Las relaciones de contraste se calcularon a partir de los colores sRGB declarados en CSS con la fórmula WCAG. No es una certificación ni sustituye pruebas con tecnologías de asistencia reales.

## Hallazgos por severidad

### P1 — Bloqueo importante / incumplimiento de nivel A o AA

#### P1. Falta un enlace para saltar los bloques repetidos

- **Ubicación:** `components/storefront/store-header.tsx:22-50`; `app/(store)/layout.tsx:5-11`; `app/layout.tsx:22-25`.
- **Categoría:** Teclado, landmarks y navegación.
- **Estándar:** WCAG 2.2 **2.4.1 Bypass Blocks (A)**; relacionado con **2.4.3 Focus Order (A)**.
- **Evidencia e impacto:** Al empezar con Tab en `/`, el primer foco es «Descubre NODRIA Empresas». No aparece un enlace para saltar al contenido principal. La cabecera añade enlaces promocionales, navegación, búsqueda y accesos antes del contenido; las personas que navegan con teclado deben recorrerlos en cada página. El centro de operaciones también empieza con navegación lateral y no ofrece un salto a su `<main>`.
- **Reproducción:** Abrir `/`, pulsar Tab desde el inicio y recorrer la cabecera. No hay un control «Saltar al contenido» antes de los enlaces de navegación.
- **Remediación propuesta:** Añadir como primer control un enlace visible al recibir foco que apunte a un `id` estable en `<main>`; aplicar el mismo patrón al centro de operaciones y comprobar que el destino recibe foco cuando corresponda.

#### P1. El campo de búsqueda del encabezado no muestra el foco de teclado

- **Ubicación:** `app/globals.css:39,56-58`; `components/storefront/store-header.tsx:31-35`.
- **Categoría:** Teclado y foco visible.
- **Estándar:** WCAG 2.2 **2.4.7 Focus Visible (AA)**.
- **Evidencia e impacto:** Existe un estilo global `:focus-visible`, pero `.header-search input` lo anula con `outline: none` y no hay estilo de foco equivalente en el formulario. En la pasada manual, el campo «Buscar en NODRIA» recibía el foco después de recorrer el anuncio, el logotipo y los enlaces principales, pero no se veía ningún cambio en el campo ni en su contenedor. La persona puede perder la posición del teclado.
- **Reproducción:** En `/`, usar Tab hasta «Buscar en NODRIA». El árbol de accesibilidad confirma el foco; la captura no muestra un indicador visual.
- **Remediación propuesta:** Eliminar `outline: none` o dibujar un indicador persistente en `.header-search:focus-within`, con contraste suficiente y visible también sobre fondos claros.

#### P1. Varios textos pequeños no alcanzan el contraste mínimo

- **Ubicación:** `app/globals.css:15,39,58-59,107,113,288,293`.
- **Categoría:** Contraste.
- **Estándar:** WCAG 2.2 **1.4.3 Contrast (Minimum) (AA)**; **1.4.11 Non-text Contrast (AA)** para el indicador de foco.
- **Evidencia e impacto:** Ejemplos calculados desde los colores CSS: placeholder `#919990` sobre `#f5f6f2`, **2.70:1**; texto `--muted` `#788078` sobre `--paper` `#f7f8f3`, **3.82:1**; `.mono-label` `#89938a` sobre blanco, **3.18:1**; `.checkout-assurance` `#8b958c` sobre blanco, **3.10:1**. Son textos normales, no grandes, y requieren 4.5:1. El contorno verde global `#77a82c` sobre blanco alcanza **2.83:1**, por debajo de 3:1 cuando es el único indicador no textual. El uso repetido afecta pistas, metadatos y texto de apoyo en distintas rutas.
- **Reproducción:** Comparar los valores de `color` y fondo de esos selectores; por ejemplo, el placeholder de búsqueda en el encabezado y el texto de apoyo del estado vacío del catálogo.
- **Remediación propuesta:** Ajustar los tokens y colores secundarios para que cada combinación real de texto/fondo llegue a 4.5:1; revisar por separado el contraste del foco y los bordes de controles. Mantener el tamaño tipográfico en la revisión, aunque WCAG no fija un mínimo general de píxeles.

### P2 — Dificultad significativa con alternativa parcial

#### P2. El contador del carrito no aparece en el nombre accesible ni anuncia cambios

- **Ubicación:** `components/storefront/store-header.tsx:40-44`; `components/storefront/store-interactions.tsx:65-75`.
- **Categoría:** Nombres accesibles y mensajes de estado.
- **Estándar:** WCAG 2.2 **4.1.2 Name, Role, Value (A)** y **4.1.3 Status Messages (AA)**.
- **Evidencia e impacto:** El contador visual es un `<span aria-label="…">` genérico, sin rol que admita ese nombre ni región de estado. En el árbol de accesibilidad de la portada, el enlace se anuncia solo como «Carrito» aunque muestra visualmente `0`. El contador cambia al modificar el carrito, pero el cambio no se expone como estado anunciado. Un usuario de lector de pantalla no obtiene el total actual ni una confirmación fiable de que cambió.
- **Reproducción:** Abrir `/` y comparar la insignia visual `0` con el enlace «Carrito» del árbol de accesibilidad: el número no forma parte de su nombre. El patrón de actualización se confirma en `CartCount`.
- **Remediación propuesta:** Incluir el total en el nombre accesible del enlace y emitir el cambio en una región `role="status"`/`aria-live="polite"`. No depender de `aria-label` en un `<span>` genérico.

#### P2. El grupo de acceso declara pestañas, pero contiene botones sin estado de pestaña

- **Ubicación:** `components/storefront/auth-form.tsx:50`.
- **Categoría:** Semántica y estado de controles.
- **Estándar:** WCAG 2.2 **4.1.2 Name, Role, Value (A)**.
- **Evidencia e impacto:** El contenedor tiene `role="tablist"`, pero sus hijos son botones sin `role="tab"`, `aria-selected`, asociación con un panel ni navegación de flechas. Solo se aplica la clase visual `active`. En `/acceso`, el árbol de Chromium muestra «tab group Acceso» seguido de dos botones y no comunica cuál está seleccionado. La semántica promete un widget distinto del que se implementó.
- **Reproducción:** Abrir `/acceso` y consultar el árbol de accesibilidad: «Iniciar sesión» y «Crear cuenta» se presentan como botones dentro de un tab group, sin estado seleccionado.
- **Remediación propuesta:** Si son pestañas, implementar el patrón completo —roles, estados, paneles y teclado con flechas—; si solo cambian el modo del formulario, quitar `tablist` y exponer el estado de selección con un patrón apropiado para botones.

#### P2. Los errores personalizados del formulario B2B no señalan el campo que debe corregirse

- **Ubicación:** `components/business/business-quote-form.tsx:46-48,133-174`.
- **Categoría:** Formularios y errores.
- **Estándar:** WCAG 2.2 **3.3.1 Error Identification (A)**; relacionado con **3.3.3 Error Suggestion (AA)**.
- **Evidencia e impacto:** El formulario sí tiene etiquetas, `required` y una alerta `role="alert"`; al probar el envío vacío, el navegador enfocó «Empresa» y mostró su validación nativa sin enviar datos. Sin embargo, la validación personalizada recorta espacios y presenta un mensaje general («Revisa los campos obligatorios…») que no identifica el campo, no establece `aria-invalid` ni vincula el mensaje mediante `aria-describedby`. Puede ocurrir con valores que pasan las restricciones HTML pero quedan vacíos tras `trim()`.
- **Reproducción del caso personalizado:** Completar los demás campos con datos ficticios válidos y usar solo espacios en «Empresa»; el manejador `handleSubmit` detecta el valor vacío después de `trim()` y muestra el mensaje antes de ejecutar `fetch`.
- **Remediación propuesta:** Asociar errores a los campos concretos, establecer `aria-invalid` y `aria-describedby`, y enfocar un resumen o el primer campo inválido tras una respuesta personalizada. Conservar la validación nativa que ya funciona.

#### P2. Los estados de carga de favoritos y comparador no se anuncian al cambiar

- **Ubicación:** `components/storefront/store-collections.tsx:20-27,30-56`.
- **Categoría:** Carga asistida y mensajes de estado.
- **Estándar:** WCAG 2.2 **4.1.3 Status Messages (AA)**.
- **Evidencia e impacto:** Las rutas muestran «Cargando tu selección…» o «Cargando comparativa…» mientras leen `localStorage`; después sustituyen ese texto por resultados o un estado vacío, sin `role="status"` ni `aria-live`. La persona que espera el contenido con un lector de pantalla puede no recibir el cambio si el foco permanece en otro sitio.
- **Reproducción:** Abrir `/favoritos` o `/comparar` con almacenamiento del navegador; observar el texto de carga y su sustitución tras la hidratación. La región no está marcada como estado en el código.
- **Remediación propuesta:** Comunicar el estado de carga y el resultado de la lectura en una región de estado cortés, evitando anunciar repetidamente toda la lista de productos.

#### P2. La tabla comparativa se desborda horizontalmente sin un destino de foco para desplazarse

- **Ubicación:** `app/globals.css:290-292`; `components/storefront/store-collections.tsx:58`.
- **Categoría:** Tablas y teclado.
- **Estándar:** WCAG 2.2 **2.1.1 Keyboard (A)** y **1.3.1 Info and Relationships (A)**.
- **Evidencia e impacto:** La tabla tiene semántica útil —`<table>` y encabezados `scope="col"`/`scope="row"`—, pero en móvil su contenedor usa `overflow-x: auto` sin `tabIndex`, rol ni nombre accesible. Las celdas con datos no son controles enfocables, por lo que no hay un destino de teclado explícito para desplazar la región a las columnas que quedan fuera del viewport. El centro de operaciones ya aplica `role="region"`, etiqueta y `tabIndex={0}` a su tabla, patrón que falta aquí.
- **Reproducción:** Añadir productos al comparador, reducir el viewport hasta que aparezca el desbordamiento y tratar de alcanzar las columnas fuera de vista usando solo teclado. Este estado no se ejercitó en el navegador durante esta auditoría; la conclusión se basa en el CSS y el marcado.
- **Remediación propuesta:** Hacer enfocable la región desplazable y darle un nombre accesible; conservar el marcado de tabla y permitir desplazamiento horizontal mediante teclado.

#### P2. En móvil desaparecen accesos del encabezado sin un menú equivalente

- **Ubicación:** `app/globals.css:395,407-418`; `components/storefront/store-header.tsx:25-45`.
- **Categoría:** Responsive y acceso a funciones.
- **Estándar:** No he confirmado un incumplimiento WCAG directo con esta evidencia; es una pérdida de navegación en la interfaz móvil.
- **Evidencia e impacto:** En anchos de hasta 760 px se oculta `.primary-nav` y el enlace de favoritos (`.header-icon-button`); el enlace de cuenta ya se oculta hasta 1100 px. `StoreHeader` no ofrece un botón de menú móvil, y la lista de favoritos no tiene otro enlace en el footer. El submenú conserva categorías, pero no reemplaza esos destinos. La interfaz móvil pierde la ruta normal para abrir favoritos y deja accesos principales dependiendo de enlaces contextuales o del footer.
- **Reproducción:** Inspeccionar el encabezado con un viewport de 760 px o menor: las reglas ocultan la navegación y el acceso de favoritos; no existe un control alternativo de menú en `StoreHeader`.
- **Remediación propuesta:** Mantener los destinos necesarios en una navegación móvil operable por teclado y táctil, incluido un acceso directo a favoritos.

## Prácticas correctas que conviene conservar

- El documento declara `lang="es"`; las páginas principales usan `<main>` y encabezados `<h1>`.
- La navegación principal, las migas de pan y el buscador tienen nombres; el buscador dispone de etiqueta oculta asociada. Los iconos de favoritos tienen nombre y estado de alternancia.
- Los formularios B2B, soporte, acceso y checkout usan etiquetas conectadas a campos, atributos nativos como `required`, tipos de entrada y autocompletado. Los avisos de error usan `role="alert"` y los éxitos o mensajes algunos `role="status"`.
- El envío B2B vacío se detuvo en el primer campo obligatorio y enfocó «Empresa»; no se envió ninguna solicitud.
- Las imágenes de producto revisadas tienen texto alternativo. Las tablas del comparador y operaciones declaran encabezados y `scope`.
- Hay estilos globales de foco visibles para la mayoría de los controles y una regla `prefers-reduced-motion`; el buscador es una excepción al foco global. La regla de movimiento reducido elimina animación y desplazamiento suave; no observé en CSS una animación continua o parpadeante.

## Verificaciones ejecutadas y límites

| Comprobación | Resultado |
|---|---|
| Lectura de `PROJECT_BRIEF.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `STATUS.md`, `WORKSTREAMS.md` y `AGENT_HANDOFF.md`; Git y rutas revisados | Completado antes de auditar. El worktree ya tenía cambios ajenos a este informe; no se revirtieron ni editaron. |
| `pnpm install --frozen-lockfile` y `pnpm install --force --frozen-lockfile --offline` | Necesarios para disponer de los enlaces ejecutables de Next en este worktree; no se modificaron archivos de código por la instalación. |
| `pnpm dev` | App disponible en `http://localhost:3001` porque el puerto 3000 ya estaba ocupado; `/`, `/empresas`, `/catalogo`, `/backoffice` y `/acceso` respondieron en navegador. El servidor local se detuvo al terminar. |
| Navegador integrado de Codex / Chromium, 1280 × 720 | Se inspeccionaron árbol accesible de portada, catálogo, empresas, operaciones y acceso. Se probó Tab hasta el buscador y se vio que el foco carece de indicador; en el formulario B2B vacío se observó la validación nativa sin petición. |
| `impeccable.cmd detect --json app components app/globals.css app/layout.tsx` | Salida con 3 advertencias/advisories ajenas a accesibilidad: transiciones de altura y fondos decorativos. No reportó hallazgos de accesibilidad. El comando terminó con código 1 por esas advertencias. |
| `impeccable.cmd audit 'app/(store)/layout.tsx'` | No disponible en esta versión del ejecutable: respondió `Unknown command: "audit"`. La evaluación se completó con revisión manual y estática. |

No pude realizar estas comprobaciones y no deben considerarse aprobadas:

1. Pruebas con NVDA, JAWS, VoiceOver o TalkBack ni anuncios con lectores de pantalla reales.
2. Reflow a 320 CSS px, zoom real del navegador al 200 %/400 %, ni inspección táctil en un dispositivo físico. La API del navegador de esta sesión no ofreció un override de viewport; las teclas de zoom no produjeron un cambio observable. Los breakpoints se revisaron en CSS solamente.
3. Preferencia del sistema «reducir movimiento» activada, ni interacción cronometrada para validar la experiencia de movimiento.
4. Envíos válidos, errores de servidor y estados de éxito de formularios, checkout o soporte; algunos caminos escriben registros demo en `.data/`. Tampoco se probó el caso personalizado de B2B descrito arriba.
5. La tabla comparativa con productos añadidos y columnas fuera del viewport. Operaciones estaba en estado vacío, así que la tabla de pedidos no apareció en el navegador; su marcado se revisó estáticamente.
6. Axe, Lighthouse Accessibility, contraste con herramienta visual automatizada y revisión exhaustiva de cada secuencia de Tab o lector de pantalla en todas las rutas.

## Próximas acciones recomendadas

1. Corregir el bypass de bloques, el indicador de foco del buscador y el contraste de tokens antes de considerar la revisión AA aprobada.
2. Corregir el nombre/estado del carrito y los avisos de carga, y elegir una semántica coherente para los controles del formulario de acceso.
3. Hacer accesible por teclado el comparador en overflow y restituir los accesos móviles a favoritos y navegación.
4. Tras las correcciones, repetir las comprobaciones pendientes con una viewport móvil real, lector de pantalla y escaneo automatizado; probar formularios con datos ficticios en un entorno demo controlado.
