# Auditoría UX final local

**Fecha:** 2026-10-07  
**Alcance:** storefront y backoffice local, estados visibles sin autenticación, teclado, etiquetas, enlaces, encabezados y overflow responsive.  
**Conclusión:** no se encontró un defecto Critical/High reproducible en los recorridos ejecutados. Se revisaron cinco roles internos; cliente y membresías B2B siguen pendientes y se detallan los límites de la medición visual.

## Entorno y método

- Rama aislada: `codex/ux-final-audit`; dependencias instaladas con `pnpm install --frozen-lockfile`.
- E2E demo con Chromium/Playwright, `DEMO_MODE=true`, sin claves Supabase. Viewport base Desktop Chrome: 1280 × 720; barrido responsive: 390 × 844 y 768 × 1024.
- Se bloquearon solicitudes HTTPS externas durante la suite para que el resultado dependiera del entorno local.
- Las rutas internas se recorrieron también con cinco cuentas/grants ficticios en un proyecto Supabase local efímero (`nodria-ux-audit`, puertos loopback 568xx), migraciones y seed del repositorio. El runner detuvo su instancia al cerrar; no se modificaron usuarios, grants ni contenedores compartidos.
- `docs/PERFORMANCE_AUDIT.md` se conserva como baseline: portada móvil 92 de rendimiento/100 accesibilidad y catálogo desktop 100/100. No se repitió Lighthouse ni se extrapoló ese resultado al backoffice.

## Cobertura por ruta

La suite `tests/e2e/ux-audit/ux-audit.spec.ts` y los casos existentes de `tests/e2e/catalog.spec.ts` cubren las siguientes rutas en estado anónimo/demo:

| Grupo | Rutas | Viewports y evidencia |
|---|---|---|
| Storefront | `/`, `/catalogo`, `/catalogo?q=nvme`, `/producto/fluxbook-14-pro`, `/producto/fluxbook-14-pro/opiniones`, `/carrito`, `/checkout`, `/acceso`, `/mi-cuenta`, `/favoritos`, `/comparar`, `/configurador` | HTTP < 400, un `h1` visible, controles con nombre, enlaces internos válidos y sin saltos de encabezado en 1280 × 720; sin overflow a 390 × 844 y 768 × 1024. Catálogo, PDP/opiniones, carrito y checkout tienen además casos funcionales específicos.
| Empresa, contenido y soporte | `/empresas`, `/empresas/portal`, `/envios`, `/garantia`, `/legal/privacidad`, `/servicios`, `/soporte`, `/soporte/agente` | Mismas comprobaciones de ruta y responsive en estado anónimo/demo. El formulario B2B comprueba asociación de errores, anuncio `role=alert`, `aria-invalid` y foco en el primer campo inválido.
| Backoffice | `/backoffice`, `/backoffice/crm`, `/backoffice/inventory`, `/backoffice/procurement`, `/backoffice/returns`, `/backoffice/reviews`, `/backoffice/analytics` | En Demo Mode, las rutas responden con estados de límite/acceso sin mostrar datos operativos. La comprobación de layout/heading/overflow se ejecuta a 1280 × 720, 390 × 844 y 768 × 1024; no es una captura autenticada de los tableros.

## Cobertura por rol y estado

| Rol/estado | Resultado y evidencia |
|---|---|
| Anónimo en Demo Mode | Ejercitado por E2E en las 27 rutas. El test `backoffice route guard prevents demo users from seeing CRM and inventory data` comprueba explícitamente la denegación en CRM e inventario. El layout documenta que Demo Mode no comprueba sesión ni permisos y no muestra operaciones. |
| Sesión ausente con Supabase configurado | Auth E2E confirma que `/backoffice` redirige a `/acceso?next=%2Fbackoffice` antes de mostrar datos operativos. |
| `customer`, buyer/viewer y owner/admin de empresa | Contratos y vistas revisados en [`docs/RBAC_MATRIX.md`](./RBAC_MATRIX.md) y portal B2B. No se crearon sesiones de cliente ni membresías empresariales en esta ronda.
| `support_agent` | Inicio de sesión real en Auth local efímero. `/soporte/agente` se revisó a 1280, 390 y 768 px; `/backoffice` muestra la denegación esperada. Controles visibles con nombre y sin overflow de página.
| `sales_manager` | CRM accesible a 1280, 390 y 768 px; operación, inventario y moderación muestran sus estados de permiso restringido. Sin controles sin nombre ni overflow de página.
| `fulfillment_manager` | Operaciones, inventario, procurement y devoluciones visibles a 1280, 390 y 768 px; CRM denegado. Sin controles sin nombre ni overflow de página.
| `catalog_manager` | Acceso al portal general denegado como indica `STAFF_SURFACE_ROLES`. No existe una ruta de gestión de catálogo bajo `app/backoffice` en el código actual; la interfaz CRUD de catálogo para este rol sigue fuera de cobertura.
| `super_admin` | Operaciones, CRM, inventario, procurement, devoluciones, analítica y moderación se recorrieron a 1280, 390 y 768 px. Sin controles sin nombre ni overflow de página.

El ownership de cada estado de permiso sigue en servidor y base de datos; esta revisión de copy/UI no reemplaza RBAC, RLS ni los 78 probes Auth/PostgREST existentes.

## Resultados

- `pnpm test:e2e`: **17/17 passed** (1.1 min). La auditoría UX ahora barre 27 rutas, busca controles visibles sin nombre, enlaces inválidos, saltos de heading, destinos internos con error y overflow de página en tablet/móvil.
- Teclado: el primer Tab enfoca el enlace de salto con indicador visible; Enter lleva al contenido principal; `Ctrl+K` abre búsqueda; sugerencias se recorren con flechas y Enter.
- Formularios: el caso B2B inválido comprueba resumen anunciado, errores vinculados por `aria-describedby`, `aria-invalid` y foco inicial. El checkout vacío mantiene deshabilitado el botón de compra. El pie conserva un control de volver arriba enfocable por teclado.
- Catálogo/carrito: filtros y búsqueda, favorito/comparación con datos demo, ordenación, resultado vacío, cantidades, opiniones de solo lectura y disclosure de demo/pago sin tarjeta tienen pruebas E2E específicas.
- `pnpm exec tsc --noEmit`: pasó. `pnpm lint`: pasó.
- `pwsh -File tests/e2e/ux-audit/run-roles.ps1`: **1/1 passed** en un Supabase local efímero; login real por Auth para `support_agent`, `sales_manager`, `fulfillment_manager`, `catalog_manager` y `super_admin`. Se verificaron accesos permitidos/denegados, controles con nombre y overflow en desktop, móvil y tablet. Las capturas quedan en `.data/ux-role-results/` (ignorado por Git).
- Capturas de la pasada móvil se guardan en `.data/playwright-results/` (directorio ignorado), incluida la portada a 390 px y la landing B2B a pantalla completa.

## Hallazgos, bugs y riesgos

### Critical/High

No se observó un defecto Critical/High reproducible dentro del alcance anónimo/demo. Esto no afirma ausencia de defectos en estados autenticados.

### P2

1. **Corregido: moderación de opiniones era un callejón sin salida.** La vista de `/backoffice/reviews` no ofrecía navegación de retorno. Se añadió “Volver a operaciones” en los estados demo, error, permiso denegado y contenido. Auth E2E confirma el enlace en super_admin y sales_manager, y navega por teclado con Enter.

### Validación y límites pendientes

1. **Cliente y organización no recorridos con Auth.** Las vistas de `customer`, buyer/viewer y owner/admin de organización no se probaron con sesión; hace falta añadir fixtures Auth/membership solo si se amplía el cierre a esos roles.
2. **No hay interfaz de gestión de catálogo para `catalog_manager`.** El rol queda correctamente fuera del backoffice transversal, pero este checkout no ofrece un destino alternativo para su capacidad CRUD de catálogo documentada. No se debe presentar el rol como una UI operativa.
3. **Soporte interno conserva la cabecera y el pie del storefront.** `/soporte/agente` muestra el chrome público alrededor de la bandeja en vez de una navegación interna; no hay overflow, pero el cambio de contexto es visualmente confuso y no ofrece navegación entre herramientas internas.
4. **Contraste del backoffice no medido con Lighthouse/axe.** La prueba estructural revisa nombres y overflow; no sustituye revisión de contraste, tamaño táctil, lector de pantalla ni tablas con scroll en un dispositivo real.
5. **Aviso de hidratación del caret.** Playwright vuelve a reportar `style="caret-color: transparent"` en inputs, ausente de las props de React mostradas y sin causa atribuida al producto. También aparece el warning ambiental `NO_COLOR`/`FORCE_COLOR`. No se alteró CSS global ni se ocultó el warning.
6. **Abortos de stream del servidor de desarrollo.** Durante navegación de la suite autenticada, Next.js registró `The destination stream errored while writing data` (digest `3656405009`); el caso terminó pasando y las pantallas cargaron. Confirmar en un build de producción local para separar cancelación de navegación y defecto de render.
7. **Validez de despliegue y CWV de campo.** No hay dominio público, CrUX ni entorno de producción comprobado; SEO/CWV remotos siguen pendientes según `docs/PERFORMANCE_AUDIT.md`.

## Siguientes pasos

- Añadir cobertura Auth visual de `customer`, buyer/viewer y owner/admin si el cierre incluye todos los roles de `RBAC_MATRIX.md`.
- Implementar o retirar explícitamente del demo la expectativa de UI de gestión de catálogo para `catalog_manager`.
- Unificar la navegación de soporte interno con un shell de staff para no mezclar la bandeja con el chrome del storefront.
- Medir las pantallas autenticadas del backoffice (contraste, objetivos táctiles, lector de pantalla y scroll de tablas) con axe/Lighthouse y un lector de pantalla.
- Identificar el origen del estilo de caret en un navegador Playwright limpio y separar ese aviso de la aplicación.
- Repetir CWV y revisar indexación únicamente cuando exista un dominio de despliegue configurado; no se afirma validación de producción.
