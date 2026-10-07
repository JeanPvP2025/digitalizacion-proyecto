# Auditoría UX y accesibilidad de NODRIA

**Fecha:** 7 de octubre de 2026
**Entorno:** Next.js local, `DEMO_MODE=true`, sin credenciales Supabase ni sesión Auth
**Alcance:** home, catálogo y búsqueda, PDP, carrito/checkout demo, acceso/cuenta, B2B, soporte/RMA y rutas de backoffice.
**Límite:** es una revisión funcional y visual parcial; no es una auditoría WCAG ni una declaración de conformidad.

## Estado por flujo

| Flujo | Estado observado | Evidencia y límite |
|---|---|---|
| Home | Revisado en desktop y móvil | Un `h1`, navegación por teclado y acciones con nombre; no se detectó overflow a 390 px. Las fichas y precios se identifican como demo. |
| Catálogo y búsqueda | Parcial | La búsqueda de cabecera funciona con `Ctrl+K`, flechas y `Enter`; enlaces internos responden. `Componentes` abre una categoría con 0 resultados y un mensaje genérico. |
| PDP | Parcial | La ficha y sus acciones están presentes. El valor 4,8/126 aparece junto al título sin “demo”; la explicación ficticia está más abajo, en la sección de reseñas. |
| Carrito | Parcial | El vacío tiene CTA para explorar catálogo. Las pruebas existentes cubren cantidad y eliminación con datos locales. |
| Checkout demo | Parcial | Avisa que no recoge tarjeta y muestra escenarios ficticios. Sin artículos conserva el formulario, total `0,00 €` y CTA activo. |
| Acceso y cuenta | Demo local, comunicado | `/acceso` indica que Auth no está configurado y pide no introducir contraseñas. `/mi-cuenta` muestra el correo fijo de demo y explica la persistencia local. |
| B2B | Parcial | Los errores del formulario se anuncian, se enlazan a sus campos y enfocan el primer campo inválido. `/empresas` y el estado de `/empresas/portal` no cargan las clases CSS Module; el flujo de organización requiere Auth conectado. |
| Soporte y RMA | Parcial | El intake muestra campos etiquetados y avisa que guarda datos ficticios localmente. El formulario de devolución comunica que necesita pedidos conectados; no hay pedidos reales en este entorno. |
| CRM, inventario y centro de operaciones | No accesibles en demo | `/backoffice`, `/backoffice/crm` y `/backoffice/inventory` muestran “Portal de equipo desactivado” y no cargan datos sin Supabase/Auth. La guardia observada es clara y evita presentar fixtures internos como una sesión autorizada. |

## Hallazgos priorizados

| ID / prioridad | Ruta y reproducción | Resultado | Estado y siguiente paso |
|---|---|---|---|
| **A11Y-01 · P1** B2B sin estilos de módulo | Abrir `/empresas` o `/empresas/portal` con el modo demo local. En ambos casos `main` llega sin atributo `class`; el primer viewport de `/empresas` aparece como flujo de texto y la tarjeta de acceso del portal pierde su composición. El check E2E de CSS Module reproduce la ausencia en ambas rutas. | Jerarquía visual, separación de secciones y legibilidad del formulario quedan degradadas tanto en desktop como en móvil. | **Abierto, fuera de este ownership.** Revisar la exportación/compilación de `business-page.module.css` y `business-portal.module.css`; volver a comprobar el DOM y ambos viewports. |
| **A11Y-02 · P2** Checkout permite intentar un pedido vacío | Abrir `/checkout` sin artículos. El resumen marca productos `0,00 €` y total `0,00 €`; “Confirmar compra demo” está habilitado. El E2E esperado-fallido verifica que debería estar deshabilitado. | El usuario puede iniciar un flujo sin artículos y descubrir el rechazo solo después del envío. | **Abierto, fuera de este ownership.** Mostrar un regreso al catálogo y desactivar el envío mientras el carrito esté vacío. |
| **A11Y-03 · P2** “Volver arriba” no es interactivo | En cualquier página pública, bajar al pie. `components/storefront/store-footer.tsx` renderiza `VOLVER ARRIBA ↗` como `<span>`; no aparece como enlace/botón ni recibe foco. El check E2E esperado-fallido lo detecta. | La etiqueta y flecha prometen una acción que no existe. | **Abierto, fuera de este ownership.** Convertirlo en enlace a un ancla superior o retirar su presentación de acción. |
| **A11Y-04 · P2** Contraste bajo en una etiqueta pequeña | En el subnav público, la etiqueta “EXPLORA” usa `#9ba39c` sobre blanco con tamaño de 8 px (`app/globals.css`). La relación de contraste calculada para ese par es aproximadamente **2,59:1**. | Es una etiqueta secundaria, pero su lectura depende de una vista fina y queda por debajo del umbral habitual de 4,5:1 para texto normal. | **Abierto.** Aumentar contraste/tamaño. Este muestreo de color no sustituye una medición completa de toda la interfaz. |
| **A11Y-05 · P2** Categoría Componentes vacía | Seguir “Componentes” desde la navegación o abrir `/catalogo?categoria=componentes`. El catálogo marca 0 resultados y muestra “No encontramos lo que buscas”, sin explicar que el fixture no tiene piezas sueltas. | El destino parece una categoría disponible y termina en un estado genérico vacío. La tarjeta equivalente de Home sí explica el límite y lleva al PC Builder. | **Parcial; sigue abierto en navegación/catálogo.** Añadir contexto en el estado vacío o evitar el enlace hasta que haya productos. |
| **A11Y-06 · P2** Señales de producto ficticias sin rótulo cercano | En `/producto/fluxbook-14-pro`, la valoración 4,8/126, “Entrega en 24–48 h”, garantía y devolución aparecen antes del disclaimer situado más abajo en reseñas. En `/catalogo` también se lee “Cada producto pasa por las manos de un especialista”. | El contenido ficticio puede interpretarse como una promesa o experiencia real. La nota global de demo solo aclara el pago; el PDP explica las reseñas más adelante. | **Parcial.** Mantener “demo” junto a valoración, stock, entrega y condiciones, o reemplazar afirmaciones comerciales sin soporte. |

No se encontraron enlaces visibles vacíos (`href="#"`, `javascript:` o sin `href`) ni destinos internos con HTTP 4xx en las páginas inspeccionadas. El formulario B2B conserva nombres accesibles, `aria-invalid`, `aria-describedby` y foco dirigido al primer error. La incompatibilidad antigua entre volumen B2B y API figura **corregida** en el contrato actual y sus pruebas; esta auditoría no envió una solicitud válida.

## Teclado, semántica, responsive y contraste

- El primer `Tab` llega al enlace “Saltar al contenido principal”; `Enter` enfoca `#main-content`. El foco visible usa contorno y halo.
- `Ctrl+K` enfoca la búsqueda; `ArrowDown` selecciona una sugerencia y `Enter` abre el PDP. La lista usa `combobox`/`listbox`/`option` y expone el resultado seleccionado.
- En las 14 rutas principales, Playwright encontró un solo `h1` dentro de `main`, sin saltos de nivel de encabezado, controles visibles con nombre y anclas internas válidas.
- A 1280×720 y 390×844 no se detectó overflow horizontal de página en las rutas probadas. El subnav móvil conserva desplazamiento horizontal interno.
- El formulario B2B tiene un estado de error con `role="alert"`; `aria-invalid` y `aria-describedby` se actualizan y el foco pasa a Empresa. El caso usa valores ficticios inválidos y confirma que no se llama a `/api/quotes`.
- No se encontraron diálogos HTML/ARIA en los flujos recorridos; por tanto no se probó gestión de foco de diálogo.
- Contraste: se calculó el par de “EXPLORA” indicado arriba. Texto del cuerpo y controles principales se ven legibles en las capturas inspeccionadas; no se verificó contraste de todos los estados, imágenes, hover, zoom al 200 % ni combinaciones de lector de pantalla.

## Verificación automatizada

Nuevo archivo: `tests/e2e/ux-audit/ux-audit.spec.ts`.

Incluye comprobaciones de rutas, encabezados, nombres de controles, destinos internos, overflow desktop/móvil, salto de contenido, foco, búsqueda por teclado y errores B2B. Tres pruebas están marcadas como **fallos esperados** para los hallazgos abiertos de CSS Modules B2B, checkout vacío y pie no interactivo; Playwright debe seguir mostrándolas como esperadas hasta que las superficies propietarias las corrijan.

La suite E2E previa cubre catálogo, cantidades de carrito, disclosures de checkout demo, campos requeridos de B2B/soporte y bloqueo de backoffice. Los cambios de esta auditoría no modifican componentes compartidos, APIs ni contratos.

Checks ejecutados en esta iteración:

| Comando | Resultado |
|---|---|
| `corepack pnpm test:e2e` | 15 aprobadas; incluye 3 hallazgos esperados (`test.fail`) |
| `corepack pnpm test` | 71 Vitest + 18 Node aprobados |
| `corepack pnpm lint` | Aprobado, sin diagnósticos |
| `corepack pnpm exec tsc --noEmit` | Aprobado |

## Límites y handoff

- La falta de credenciales y sesión Auth impide recorrer el portal B2B conectado, CRM, inventario y backoffice con roles reales. Se observó y probó el estado de acceso que presenta el modo demo.
- Los envíos válidos de ticket, presupuesto y checkout no se ejecutaron desde el navegador para no dejar registros locales persistentes. No se introdujeron credenciales ni datos reales.
- No se auditó con axe u otro motor completo; no hay afirmación de conformidad WCAG.
- **Handoff a Tech Lead/propietarios:** A11Y-01 requiere investigar CSS Modules en las dos rutas B2B; A11Y-02 va a Checkout; A11Y-03 al propietario del footer; A11Y-04 al propietario del estilo global; A11Y-05 a Storefront; A11Y-06 a catálogo/PDP y copy. Este informe y los tests quedan en el ownership de auditoría.
