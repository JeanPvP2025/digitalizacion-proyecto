# Estado del proyecto

Estado observado el **2026-10-07** tras integrar la quinta ola. Se contrastaron commits, diffs, cambios sin commit y el comportamiento local; el repositorio y las migraciones son la fuente de verdad. No hay proyecto Supabase remoto ni despliegue de producción probado.

## Resumen funcional

- ✅ **Checkout conectado:** sesión GoTrue, `variantId`, precio/stock desde servidor, pedido con snapshots y reserva transaccional, pago demo autorizado solo en servidor, rechazo/retry/concurrencia. El lookup idempotente valida clave y fingerprint antes de crear o mutar un carrito. E2E local conectado cubre aprobado, rechazado, refresh/retry y dos compras concurrentes.
- ✅ **Auth/RLS boundary local:** 78 probes HTTP GoTrue/PostgREST pasan, incluidos anon, perfiles/pedidos/tickets, aislamiento de cliente y organización, roles persistidos, RPCs privilegiadas, prioridad Supabase sobre `DEMO_MODE`, fallo conectado sin fallback y scan de secretos cliente. La matriz CRUD completa de cada tabla/columna/rol sigue abierta.
- ✅ **Inventario operativo básico:** almacén puede recibir stock y ajustar cantidades por RPC, con actor, motivo/proveedor/albarán, ledger append-only, idempotencia de payload y protección de reservas. Los movimientos no suplantan el ledger de checkout/fulfillment.
- ✅ **PC Builder comprable:** seis componentes ficticios vendibles con atributos tipados; compatibility selection y carrito preservan los `variantId` exactos. Checkout vuelve a validar producto, variante, precio y stock.
- ✅ **Reviews en PDP:** enlace a opiniones y conteo exacto solo cuando los datos conectados están disponibles; el workflow verificado/moderado mantiene estados de carga, vacío y error.
- ✅ **CRM/B2B — conversión auditada:** una oferta aceptada puede registrarse una sola vez con snapshots tenant-scoped e historial. 🚧 No emite todavía un `orders` formal ni reserva stock.
- 🚧 **Operations Center:** cola y métricas consultan datos operativos; picking/packing, expedición y escaneo siguen incompletos.
- 🚧 **Support/RMA:** tickets, mensajes, estados y revisión/límite de unidades funcionan; falta ejecutar los efectos aprobados de devolución sobre reembolso/stock.
- 🚧 **Analytics:** consultas operativas conectadas, pendiente demostrar consistencia de cada KPI contra una fuente de negocio y cerrar rangos/filtros.
- 🚧 **Demo Mode:** aislamiento de datos y límites de seguridad verificados localmente; falta una demo completa por roles con reset determinista.
- 🚧 **Contenido, SEO, responsive y performance:** bases y polish parcial; no hay auditoría integral de rendimiento, blog/CMS ni revisión visual completa de todas las rutas.

## Integración de la quinta ola

- Se rescataron cuatro commits limpios: B2B conversion (`473bff1`), PC Builder (`6011f77`), PDP reviews (`bb20ce8`) y checkout E2E (`2f8d264`). Las revisiones se integraron como commits separados; las ediciones de documentos worker basadas en el snapshot antiguo se reconciliaron aquí.
- Se rescataron sin commit los cambios de inventario del worktree `c27b` y el runner Auth/PostgREST y su handoff desde `29a6`.
- La prueba conectada detectó que el retry podía crear otro carrito con líneas antes de que el RPC encontrase el pedido. Se añadió `find_checkout_order`, que compara el fingerprint registrado antes de reservar/crear carrito; misma clave/payload reusa el pedido y payload diferente devuelve conflicto.
- Se separó el E2E conectado del gate demo general: `pnpm test:e2e` no requiere credenciales locales; `tests/e2e/checkout-connected/run.ps1` ejecuta el recorrido GoTrue/PostgREST aislado.
- Los dos scripts SQL runtime tenían conteos literales de seed antiguos. Se sustituyeron por conteos basales capturados en la transacción y se volvieron a ejecutar sin ampliar policies.
- El primer reset local de esta integración dejó Docker en reinicio incompleto; un segundo reset con el stack sano aplicó migraciones y seed completos. Las pruebas posteriores usaron esa base recién reiniciada.

## Backlog priorizado

### P0

- [ ] Ningún bloqueo P0 confirmado por los gates locales de esta ola. Mantener no-go de producción hasta configurar un proyecto remoto, secretos/redirects y ejecutar pruebas de despliegue.

### P1

- [ ] Completar pedido B2B formal desde oferta aceptada: dirección/facturación, condiciones de pago, precio negociado como snapshot e integración de stock/reservas sin eludir checkout.
- [ ] Extender inventario a proveedores maestros y órdenes de compra; la ola actual cubre recepciones directas y ajustes, no procurement completo.
- [ ] Cerrar fulfillment con picking/packing/expedición y timeline conectado a la cola operacional.
- [ ] Definir y ejecutar efectos de RMA aprobado sobre devolución, reembolso simulado y stock de forma idempotente.
- [ ] Validar origen de cada KPI y sus filtros con casos de negocio reproducibles; completar escenarios operativos restantes de analytics.
- [ ] Matriz Auth/RLS más amplia para manager/marketing y CRUD de tablas/columnas/acciones, con tokens HTTP y pruebas de IDOR por dominio.

### P2

- [ ] E2E conectado de pedido en cuenta, cotización/portal B2B, reseña elegible, ticket/mensajes y permisos de backoffice.
- [ ] Demo Mode por perfiles con fixture/reset estable y guion repetible de extremo a extremo.
- [ ] Revisión manual de accesibilidad y responsive en cada módulo, incluidos diálogos, tablas y feedback de mutaciones.
- [ ] Medición Lighthouse/CWV y bundle/imágenes; resolver la discrepancia de hidratación `caret-color: transparent` en navegador limpio si persiste.
- [ ] Auditoría de navegación y acciones para módulos con páginas conectadas; añadir contenido/blog y metadatos donde existan rutas públicas.

### P3

- [ ] CMS/blog editorial, recomendaciones, mercados/monedas adicionales y refinamientos de compras no requeridos para la demo académica.

## Gates de la integración

| Check | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ |
| `pnpm exec tsc --noEmit` | ✅ |
| `pnpm lint` | ✅ sin diagnósticos |
| `pnpm test` | ✅ 160 Vitest + 18 Node |
| `pnpm test:e2e` | ✅ 17/17 demo y UX |
| `pwsh -File tests/e2e/checkout-connected/run.ps1` | ✅ 4/4 con GoTrue, PostgREST y RPCs locales; incluye retry, payload distinto, refresh y concurrencia |
| `pnpm build` | ✅ Next.js producción; 33 rutas enumeradas |
| `supabase db reset --local --yes` | ✅ segundo intento; migraciones y seed, incluida conversión B2B, movimientos e idempotency lookup |
| pgTAP database/checkout/reviews | ✅ 189 aserciones |
| RLS/security/RBAC/Auth escalation/support/inventory SQL | ✅ todos los scripts runtime pasaron y revirtieron fixtures |
| Auth/PostgREST boundary runner | ✅ 78 probes HTTP; 0 fallos; cleanup verificado |
| `supabase db lint --local --fail-on error` | ✅ sin errores de esquema |
| `git diff --check` | ✅ sin errores; Git puede mostrar LF/CRLF de Windows |

## Criterio de cierre

Una feature se marca ✅ solo con contrato integrado, autorización server/database, persistencia, estados de error/vacío, UX navegable y pruebas del recorrido principal. Los gates locales no prueban producción ni sustituyen configuración remota.
