# Estado del proyecto

Estado observado el **2026-10-07**, tras integrar la segunda ola. El código y los gates locales son la fuente de este resumen; el proyecto no está listo para producción.

## Resumen

- ✅ Base integrada: `pnpm install --frozen-lockfile`, TypeScript, 42 pruebas Vitest, 18 pruebas Node, 7 E2E, build, `supabase db reset`, 60 pgTAP, prueba transaccional RLS/checkout y `db lint` pasan.
- ✅ Seguridad DB mejorada: escrituras directas en pedidos, pagos e inventario revocadas a usuarios autenticados; cambios operativos por RPCs acotadas. El gate PostgreSQL corrige y prueba que ventas no lea pedidos, líneas, eventos ni transacciones de pago de clientes.
- 🚧 RLS y RBAC: pruebas reales por `anon`, customer A/B, sales, fulfillment, support, business buyer/admin y superadmin cubren aislamiento y algunas mutaciones. No cubren CRUD exhaustivo para cada rol/tabla ni auditoría de todos los endpoints.
- 🚧 Auth y demo: resolución de modo en servidor, lectores/escritores `.data` restringidos y backoffice demo bloqueado sin Auth de personal en modo Supabase. Algunas rutas catálogo/búsqueda y fixtures aún requieren auditoría de fallback en producción.
- 🚧 Storefront: catálogo, PDP, búsqueda, favoritos, comparación, carrito y PC Builder visual funcionan con fixtures; el UX eliminó afirmaciones sociales inventadas y permite recuperar/borrar configuraciones guardadas. Favoritos/comparador y catálogo aún dependen de fixtures/client storage en varias superficies.
- 🚧 Checkout: checkout conectado valida carrito/precio/stock y `place_order` reserva stock con idempotencia básica. RPCs SQL de pago simulado aprobado/rechazado, liberación y fulfillment pasan pgTAP. La API/UI conectada todavía no invoca esas RPCs; pedidos quedan `pending_payment`. Clave repetida con otro payload no valida fingerprint.
- 🚧 Backoffice: CRM e inventario conectados, protegidos por rol; inventario sigue en lectura. Centro de operaciones no consume pedidos conectados. Reseña identificó manejo incompleto de archivos JSON corruptos en demo.
- 🚧 B2B/CRM: intake de solicitudes y pipeline básico; onboarding/membresías UI, cotización completa e historial de actividades no existen.
- 🚧 Soporte/RMA: intake conectado inserta ticket y mensaje por separado; atomicidad, conversación y devoluciones en UI pendientes.
- 🚧 Accesibilidad: skip link, foco, navegación móvil, estados anunciados y errores enlazados al formulario integrados; auditoría manual completa de diálogos/teclado/contraste pendiente.
- ⚠️ Confianza operativa: no hay credenciales Supabase remotas ni despliegue de producción. No se ha probado flujo de navegador contra usuarios Auth y servicios conectados.

## Estado por prioridad

### P0

- [ ] Conectar el resultado del pago demo a las RPCs SQL desde una operación de servidor autenticada, y probar el recorrido UI/API completo y reintentos.
- [ ] Validar fingerprint de idempotencia, campos mínimos de dirección y recuperación de fallos parciales en pedidos.
- [ ] Revisar todos los lectores de fixtures/datos en rutas conectadas/producción y demostrar separación de datos.
- [ ] Expandir la matriz RLS a CRUD por rol y tabla sensible, incluyendo endpoints y tokens reales de Auth local.

### P1

- [ ] Consultar pedidos conectados en Operations Center y reconciliar sus estados con CRM, inventario y pagos.
- [ ] Hacer atómico el alta de ticket/mensaje y completar flujo de devoluciones/RMA.
- [ ] Implementar movimientos/recepción de inventario con la RPC y ledger existentes.
- [ ] Completar B2B: onboarding, miembros, presupuesto con snapshots y actividades CRM.
- [ ] Conectar datos del PC Builder a variantes vendibles o bloquear claramente el checkout de configuraciones fixture.

### P2

- [ ] Cerrar auditorías manuales de accesibilidad, responsive, rendimiento y acciones/enlaces sin comportamiento.
- [ ] Corregir estados de error al leer/escribir archivos demo y completar empty/loading states.
- [ ] Ampliar E2E de checkout conectado, cuenta, CRM, inventario y soporte; añadir prueba de navegador con teclado.
- [ ] Medir LCP e imágenes con métricas, no solo revisión estática; revisar fallbacks catálogo/búsqueda.

### P3

- [ ] Gestión de producto, compras/proveedores, analítica derivada de eventos y CMS.
- [ ] Moderación de reseñas, monedas/locales adicionales y compatibilidad avanzada de configurador.

## Gates de integración

| Check | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | ✅ lockfile vigente |
| `pnpm exec tsc --noEmit` | ✅ |
| `pnpm lint` | ✅ sin warnings tras migrar imágenes a `next/image` |
| `pnpm test` | ✅ 42 Vitest + 18 Node |
| `pnpm test:e2e` | ✅ 7 Playwright |
| `pnpm build` | ✅ Next.js producción |
| `pnpm dlx supabase@latest db reset` | ✅ migraciones y seed local |
| `pnpm dlx supabase@latest test db --local tests/database` | ✅ 60 pgTAP |
| `pnpm dlx supabase@latest db lint --local` | ✅ sin errores de esquema |
| `tests/integration/postgres-rls.sql` | ✅ gate runtime local, transacción revertida |
| `git diff --check` | ✅; Git informa conversiones CRLF habituales de Windows |

## Criterio de cierre

Una feature solo se marca completa con contrato integrado, autorización del lado servidor/base, persistencia correcta, estados vacíos/errores y pruebas relevantes. Un RPC o una pantalla sin recorrido integrado no cuenta como funcionalidad completa.
