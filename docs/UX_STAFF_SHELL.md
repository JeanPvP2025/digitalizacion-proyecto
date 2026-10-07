# Cierre UX: bandeja del equipo de soporte

**Fecha:** 2026-10-08
**Ruta:** `/soporte/agente`
**Estado:** cerrado en local para el alcance de esta ruta; el código y el control de acceso del servidor siguen siendo la autoridad.

## Objetivo

Dar a la bandeja de soporte una identidad y navegación de equipo, y revisar sus colas y controles en teclado y en anchos móvil, tablet y escritorio. El rol `support_agent` mantiene el acceso actual; los demás usuarios no reciben navegación interna y siguen sujetos a la comprobación server-side existente.

## Implementación

- La ruta usa `SupportAgentShell`, con marca de operaciones, salto al contenido, navegación por anclas a tickets y devoluciones y un enlace explícito a la tienda pública.
- Las rutas sin sesión, sin rol, con error de permisos o sin configuración muestran el mismo contexto de acceso, sin los enlaces a colas internas.
- La sesión y el rol se verifican en el Server Component antes de montar `SupportAgentWorkspace`. No se relajaron guards ni contratos de API.
- El shell enmascara el chrome de `StoreLayout` mediante CSS Module condicionado a que exista el shell en el DOM. Es un adaptador local a esta ruta, no una modificación del layout compartido.
- La página llama `connection()` antes de leer configuración, sesión y rol. El build confirma `/soporte/agente` como ruta dinámica, para no congelar la pantalla de “no disponible” si Supabase solo se configura durante runtime.
- La cola de tickets y las devoluciones son listas/tarjetas, no tablas HTML. En escritorio, la lista de tickets puede desplazarse en su propio panel; en móvil se reduce su alto para preservar el scroll de página. El texto largo se ajusta dentro de las tarjetas.
- Las etiquetas de formularios, nombres de estados, alertas, estados ocupados, botones nativos y anillos visibles de foco se conservan o se hicieron explícitos.

## Accesibilidad y evidencia

- La navegación de shell tiene nombre accesible y destinos a los encabezados de cada cola. El acceso por teclado se verifica con foco y Enter en la suite Auth.
- La suite Auth recorre agente autorizado y manager sin permiso, y evalúa controles sin nombre y overflow horizontal a 390, 768 y 1280 px.
- Capturas Auth revisadas en Chrome a 390, 768 y 1280 px: shell interno visible, listas en una columna estrecha y sin desbordamiento horizontal. La captura de estado vacío confirma una explicación cuando todavía no hay tickets.
- El detector mecánico Impeccable devolvió `[]` sobre los archivos de interfaz modificados.
- **No se declara contraste medido.** No se ejecutó axe ni una herramienta de medición de contraste en esta tarea.
- El módulo no presenta tablas de datos; el trabajo de scroll aplica a las listas de tickets y a la página.

## Decisión y siguiente paso técnico

Para respetar el ownership se dejaron intactos `app/(store)/layout.tsx`, `components/storefront/store-header.tsx` y `app/globals.css`. El CSS local usa `:has()` para retirar el chrome público mientras esta ruta está renderizada. En una refactorización de rutas aprobada por Tech Lead, conviene mover `/soporte/agente` a una route group de staff con layout propio y retirar este adaptador CSS. El acceso al centro de operaciones no se ofrece como enlace porque `support_agent` no tiene ese permiso.

## Verificaciones

Verificado el 2026-10-08:

- `corepack pnpm exec tsc --noEmit`: pasa.
- `corepack pnpm lint`: pasa.
- `corepack pnpm test`: 179 Vitest + 18 Node, pasa.
- `corepack pnpm build`: pasa; 38 rutas y `/soporte/agente` dinámica.
- `pwsh -File tests/e2e/ux-audit/run-roles.ps1`: 1/1, incluye soporte autorizado, manager denegado y viewports 390/768/1280. El runner limpió su proyecto Supabase efímero.
- `git diff --check`: pasa; Git informa solo la normalización LF→CRLF habitual de este checkout Windows.

La suite Auth volvió a emitir `The destination stream errored while writing data`; el caso pasó y el runner limpió el entorno aislado. No se atribuye el aviso a la aplicación.
