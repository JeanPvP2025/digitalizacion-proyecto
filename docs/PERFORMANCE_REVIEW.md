# Revisión de rendimiento web — NODRIA

**Fecha:** 2026-10-07
**Alcance:** línea base local de build, rutas, recursos y Core Web Vitals de laboratorio. No se modificó código de producto.

## Resumen

El build de producción termina correctamente. El modo desktop de Lighthouse puntúa la portada con **100/100**, pero las pruebas móviles simuladas muestran trabajo prioritario: portada **LCP 3,71 s**, ficha de producto **3,34 s** y catálogo **2,51 s**. La portada y la ficha superan el objetivo de 2,5 s; el catálogo queda justo por encima. El catálogo también transfiere **521 KiB de imágenes** y **825 KiB en total** en la muestra. CLS queda entre **0 y 0,04** en las seis rutas móviles medidas.

Los resultados son una única pasada de laboratorio contra `next start` en localhost. No son datos de usuarios reales ni permiten atribuir un INP. La aplicación no tiene una URL pública desplegada para consultar CrUX/PageSpeed Insights.

## Entorno y método

- Árbol medido: worktree `C:\Users\lopez\.codex\worktrees\89b7\digitalizacion-web`, `HEAD` separado en `707b97bf83b597940b75a740e034a98ee638343b`. Ya contenía cambios sin commit del storefront; se midió ese estado y no se asumió un checkout limpio.
- Sistema: Windows 11 Home, Node `v24.14.0`, pnpm `10.32.1`, Next.js `16.4.0`, Chrome/Lighthouse `154.0.8037.98` / `13.5.0`.
- Lighthouse móvil: perfil emulado Moto G Power (2022), Android 11, CPU ralentizada 4×, 150 ms RTT y aproximadamente 1,6 Mbps de descarga. Desktop: preset de Lighthouse para escritorio, CPU 1×, 40 ms RTT y 10 Mbps.
- Servidor: build de producción servido por `pnpm start` en `http://localhost:3000`; sin credenciales Supabase ni conexión a PostgreSQL. Los datos visibles son los fixtures locales.
- Alcance de Lighthouse: una pasada móvil en `/`, `/catalogo`, `/producto/fluxbook-14-pro`, `/configurador`, `/empresas` y `/soporte`; una pasada desktop en `/`.
- Lighthouse entrega TBT como señal de laboratorio. **TBT no es INP**. CLS solo refleja la carga inicial observada. La evaluación de campo suele usar el percentil 75 separado por dispositivo; esta ejecución no alcanza esa cobertura. [Umbrales CWV](https://web.dev/articles/vitals?hl=es) · [Medición de laboratorio y TBT](https://web.dev/articles/vitals-measurement-getting-started?hl=en).

## Build y rutas

`pnpm install --frozen-lockfile` y `pnpm build` finalizaron correctamente. Next compiló en **22,2 s**, completó TypeScript en **15,5 s** y terminó la fase `Generating static pages` en **20/20**. No se ejecutó el conjunto de tests.

Rutas marcadas estáticas (`○`) por el build: `/`, `/acceso`, `/carrito`, `/checkout`, `/comparar`, `/configurador`, `/empresas`, `/envios`, `/favoritos`, `/garantia`, `/servicios` y `/soporte` (además de `/_not-found`). Rutas dinámicas (`ƒ`): `/catalogo`, `/producto/[slug]`, `/legal/[slug]`, `/mi-cuenta`, `/backoffice` y los tres Route Handlers `/api/checkout`, `/api/quotes` y `/api/support`.

Las 13 peticiones GET revisadas devolvieron `200`: `/`, `/catalogo`, `/catalogo?categoria=componentes`, `/producto/fluxbook-14-pro`, `/empresas`, `/servicios`, `/envios`, `/garantia`, `/soporte`, `/legal/privacidad`, `/carrito`, `/checkout` y `/acceso`. Las llamadas se hicieron contra producción local; los tiempos no representan un despliegue remoto.

## Resultados Lighthouse

Transferencia total y de imágenes en KiB, calculada desde `resource-summary` de Lighthouse. TBT está en milisegundos.

| Ruta / dispositivo | Score | FCP | LCP | TBT | CLS | Transferencia | Imágenes |
|---|---:|---:|---:|---:|---:|---:|---:|
| Portada · móvil | 73 | 2,20 s | 3,71 s | 460 ms | 0,00 | 436 KiB | 132 KiB |
| Catálogo · móvil | 80 | 1,44 s | 2,51 s | 654 ms | 0,02 | 825 KiB | 521 KiB |
| Ficha FluxBook · móvil | 80 | 1,46 s | 3,34 s | 473 ms | 0,01 | 432 KiB | 132 KiB |
| Configurador · móvil | 90 | 1,55 s | 2,73 s | 264 ms | 0,04 | 434 KiB | 132 KiB |
| Empresas · móvil | 92 | 1,18 s | 2,00 s | 336 ms | 0,01 | 433 KiB | 132 KiB |
| Soporte · móvil | 89 | 1,54 s | 2,90 s | 270 ms | 0,03 | 433 KiB | 132 KiB |
| Portada · desktop | 100 | 0,42 s | 0,66 s | 0 ms | 0,00 | 453 KiB | — |

La prueba móvil de portada contabilizó **446.122 B** en total: 148.796 B de scripts, 135.591 B de imágenes, 86.192 B de fuentes, 16.341 B de CSS, 15.834 B de documento y el resto de recursos. El navegador descargó tres fuentes WOFF2 latinas (DM Sans, Sora e IBM Plex Mono). El insight de `font-display` no detectó un problema. El CSS principal transfirió 11.730 B y Lighthouse estimó **187 ms** de ahorro potencial en bloqueo de renderizado. El insight de JavaScript estimó **29 KiB** de código sin usar en el chunk compartido; la transferencia total de scripts fue 145 KiB. Son estimaciones de esa ejecución, no ahorros garantizados.

El LCP móvil de portada quedó identificado como el texto del ribbon de demostración, con **2,19 s de retraso de render del elemento** en el insight LCP. En la ficha de producto el LCP sí fue la imagen del producto; el navegador la descubrió en el HTML inicial y recibió `fetchpriority="high"`. Esta diferencia importa: los números señalan rutas a investigar, no una única causa común.

## Cache y respuestas HTTP

En `next start`, la portada y las rutas estáticas revisadas devolvieron `x-nextjs-cache: HIT` y `Cache-Control: s-maxage=31536000`. `/catalogo`, `/catalogo?categoria=componentes`, `/producto/fluxbook-14-pro` y `/legal/privacidad` devolvieron `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, coherente con las rutas que el build marcó dinámicas.

Las primeras peticiones locales tuvieron TTFB entre 18 y 281 ms; las pasadas repetidas y calientes estuvieron entre 5 y 126 ms. La prueba móvil de Lighthouse midió 869 ms de TTFB para catálogo, frente a 38 ms en la petición local caliente de la categoría. La variación confirma que este host no proporciona un TTFB estable para atribuir a producción. La decisión D-009 de `docs/DECISIONS.md` mantiene Cache Components desactivado; esta revisión no aporta evidencia para añadir infraestructura de caché.

## Hallazgos priorizados

### P1 — Reducir la carga de imágenes en el catálogo móvil

**Medido:** catálogo móvil transfirió 521 KiB de imágenes y 825 KiB en total; su LCP fue 2,51 s.
**Código:** [product-card.tsx](../components/storefront/product-card.tsx#L13) renderiza `<img>` con carga eager para las tres primeras tarjetas y lazy después; las seis URLs del catálogo usan `w=1200&q=85` en [catalog.ts](../lib/catalog.ts#L42). La ficha de producto usa la imagen directa con prioridad alta en la [ruta de producto](../app/%28store%29/producto/%5Bslug%5D/page.tsx#L28). `next.config.ts` ya permite el host de Unsplash, pero estas rutas no usan `next/image` ni `srcset`/`sizes`.

**Acción:** servir variantes adaptadas al ancho real de las tarjetas y de la ficha (por ejemplo con `next/image` o `srcset`), mantener prioridad alta solo en el LCP y reservar dimensiones/aspect ratio. Medir de nuevo los bytes de imagen y LCP; la puntuación de `image-delivery-insight` por sí sola no identificó ahorro en esta pasada.

### P1 — Investigar LCP móvil en portada y fichas

**Medido:** portada 3,71 s y ficha 3,34 s; ambas superan el objetivo de 2,5 s. El LCP de portada es texto del ribbon y muestra 2,19 s de retraso de render; el de producto es la imagen principal, descubierta inmediatamente y con prioridad alta.
**Inferencia para validar:** el contenido principal de portada usa animación de entrada desde `opacity: 0` en [globals.css](../app/globals.css#L119) y el arte inicia con retraso en [globals.css](../app/globals.css#L132). Eso puede retrasar el pintado bajo CPU móvil ralentizada, pero la traza no demuestra causalidad.

**Acción:** capturar una traza de Performance centrada en LCP y comparar la portada con la animación inicial desactivada o acortada. Cambiarla solo si la comparación mejora el pintado sin perjudicar la experiencia. Conservar la prioridad `fetchpriority="high"` del recurso LCP de la ficha y comprobar sus dimensiones/respuesta móvil.

### P2 — Reducir JS compartido y tareas largas de hidratación

**Medido:** primera carga móvil transfirió 145 KiB de JavaScript; Lighthouse estimó 29 KiB sin usar en un chunk compartido. TBT llegó a 460 ms en portada y 654 ms en catálogo. Estos TBT no predicen INP y la ejecución puede estar afectada por carga del host.
**Código:** [store-interactions.tsx](../components/storefront/store-interactions.tsx#L65) concentra `CartCount`, `ProductActions` y `CartPage` en un módulo cliente compartido por la tienda.

**Acción:** con una traza de CPU, identificar las tareas largas y separar las islas cliente por ruta/función si se confirma que módulos no necesarios se hidratan o descargan juntos. Mantener Server Components como base y evitar trasladar páginas enteras al cliente.

### P2 — Prerenderizar las rutas con datos estáticos conocidos

**Medido:** el build clasifica `/producto/[slug]` y `/legal/[slug]` como dinámicas, aunque el catálogo actual procede de seis fixtures locales y las tres páginas legales están definidas en un objeto constante. Sus respuestas no obtuvieron el tratamiento cacheado de las páginas estáticas.
**Acción:** cuando esas fuentes sigan siendo conocidas en build, valorar `generateStaticParams` para producto y legal; al integrar datos Supabase, decidir la generación/revalidación según el contrato de catálogo. Mantener `/mi-cuenta` y mutaciones personalizadas fuera de caché compartida.

### P3 — Tratar el CSS global después de imágenes y JS

**Medido:** Lighthouse estimó 187 ms de bloqueo del stylesheet principal en móvil; ese recurso son 11,7 KiB transferidos. La familia de fuentes suma 84,2 KiB transferidos, está autoalojada y el insight de `font-display` pasó.

**Acción:** dejar esta oportunidad por debajo de imágenes y JS; si una nueva pasada conserva el bloqueo, revisar cuánto CSS global es necesario en la primera vista y separar estilos de rutas solo si reduce CSS crítico medido.

## Limitaciones

- No existe origen público desplegado ni datos CrUX/RUM disponibles; no se midieron LCP/INP/CLS de campo ni interacción real para INP.
- Una pasada por ruta y perfiles simulados; no hay mediana ni intervalo de confianza. La actividad concurrente del equipo puede contaminar TBT y tiempos de servidor. Repetir en host o CI limpio antes de usar diferencias pequeñas como criterio.
- Imágenes de Unsplash dependen de red/CDN externos y su respuesta puede cambiar. La medición solo representa los recursos entregados durante esta ejecución.
- Sin base Supabase configurada: rutas y tiempos describen los fixtures locales, no consultas o infraestructura de producción.
- Los informes JSON completos quedaron fuera del repo, bajo `%TEMP%\nodria-performance-audit\` (`*-mobile.json`, `home-desktop.json`); no se versionaron.

## Reproducción y resultados ejecutados

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm start
pnpm dlx lighthouse --version
```

Resultado: instalación congelada correcta; build de producción correcto; servidor listo en `http://localhost:3000` en 741 ms; Lighthouse `13.5.0`.

Comando usado para repetir las seis rutas móviles (salidas JSON fuera del repo):

```powershell
$auditDir = Join-Path $env:TEMP 'nodria-performance-audit'
New-Item -ItemType Directory -Force -Path $auditDir | Out-Null
$routes = @(
  @{Name='home-mobile'; Path='/'},
  @{Name='catalog-mobile'; Path='/catalogo'},
  @{Name='product-mobile'; Path='/producto/fluxbook-14-pro'},
  @{Name='builder-mobile'; Path='/configurador'},
  @{Name='business-mobile'; Path='/empresas'},
  @{Name='support-mobile'; Path='/soporte'}
)
foreach ($route in $routes) {
  $outputPath = Join-Path $auditDir ($route.Name + '.json')
  pnpm dlx lighthouse ("http://localhost:3000" + $route.Path) `
    --chrome-path='C:\Program Files\Google\Chrome\Application\chrome.exe' `
    --chrome-flags='--headless=new --no-sandbox --disable-gpu' `
    --only-categories=performance --output=json "--output-path=$outputPath" --quiet
}
```

Para repetir desktop se añadió `--preset=desktop` y se escribió `home-desktop.json`. Las peticiones HTTP se tomaron con `curl.exe -sS -D - -o NUL -w` para registrar status, cabeceras, TTFB y tamaño de documento. El árbol de trabajo solo recibió este informe; no se editaron código, `STATUS.md`, `DECISIONS.md` ni otros documentos.
