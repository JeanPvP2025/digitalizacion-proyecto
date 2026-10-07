# Auditoría local de rendimiento y accesibilidad

**Fecha:** 2026-10-07

**Entorno:** build de producción servido desde `localhost:3000`; Lighthouse 13.5.0; Chromium de Playwright. Son mediciones de laboratorio, no datos de usuarios reales.

## Resultados

| Ruta y perfil | Rendimiento | Accesibilidad | Mejores prácticas | SEO | LCP Lighthouse | LCP observado en la traza | CLS | TBT | INP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `/` · móvil 412 × 823, red y CPU simuladas | 92 | 100 | 100 | 66 | 3,2 s | 557 ms | 0,003 | 50 ms | No disponible |
| `/catalogo` · desktop 1350 × 940, red simulada | 100 | 100 | 100 | 63 | 0,6 s | 239 ms | 0,011 | 0 ms | No disponible |

El LCP Lighthouse utiliza la estimación con throttling móvil; `observed` procede de la traza del navegador ejecutada en esta máquina y no es CWV de campo. No se dispone de CrUX ni se infiere INP desde TBT. Repetir en el dominio y hosting reales antes de cualquier decisión de producción.

## Cambios aplicados

- Imágenes ficticias del catálogo y hero se sirven con `next/image`, `sizes` adecuados y carga eager/prioridad alta en el hero. Las imágenes conectadas conservan `<img>` porque sus URL pueden venir de orígenes que no están permitidos por `remotePatterns`.
- La entrada animada que mantenía transparente la imagen LCP del hero se retiró; la tarjeta flotante conserva su movimiento decorativo.
- Textos secundarios medidos ahora cumplen el contraste auditado.
- Los enlaces de imagen conservan el `alt` como nombre accesible; el test E2E reconoce la alternativa textual de una imagen como nombre válido.
- Los enlaces pequeños del pie alcanzan 24 px de alto y el texto visible del carrito forma parte de su nombre accesible.

Las auditorías Lighthouse de contraste, `label-content-name-mismatch`, `target-size` y entrega de imágenes pasan en ambas rutas medidas. Lighthouse no detecta bloqueos de mejores prácticas en estas páginas.

## Límites observados

- El perfil móvil simulado mantiene LCP 3,2 s aunque la traza local observada muestra 557 ms; queda por comprobar con red/CDN y datos reales del dominio público.
- SEO puntúa 66/63 porque la instancia local no tiene `NEXT_PUBLIC_SITE_URL` y `robots.txt` bloquea el rastreo cuando el dominio no está configurado. Es deliberado para evitar indexar la demo en local, no una configuración válida para producción.
- Solo se midieron portada y catálogo. No certifica todos los estados, breakpoints ni el backoffice.
- Los JSON completos usados para reproducir estas conclusiones están en `.seo-cache/pages/homepage/performance.json` y `.seo-cache/pages/catalogo/performance.json`; esa caché se ignora en Git.
