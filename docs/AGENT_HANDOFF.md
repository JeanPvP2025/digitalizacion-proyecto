# Registro de handoffs

## Ola 2 recibida e integrada — 2026-10-07

Las seis conversaciones indicadas por el usuario se consideran finalizadas. Se inspeccionaron sus worktrees bajo `C:\Users\lopez\.codex\worktrees\{17c4,bfa1,2696,0cc1,fcd7,a2ad}\digitalizacion-web`: todos estaban en `68bb12a`, sin commits adicionales; se conservaron sus cambios útiles y reportes. Los IDs `client-new-thread:*` no fueron resolubles con el endpoint de lectura como hilos ordinarios, por lo que los entregables se contrastaron directamente con Git/worktree y los informes presentes. No se esperaron respuestas.

| Conversación | Handoff / archivos | Commit en worker | Checks declarados/observados | Límites abiertos |
|---|---|---|---|---|
| Database / `52026060…` | `20261007085225_database_security_invariants.sql`, `tests/database/security_invariants.sql`, `docs/database.md` | Ninguno | Reset/seed, DB lint y 60 pgTAP confirmados por integración | `place_order` no valida fingerprint si una clave se reutiliza con otro payload; dirección solo valida objeto; UI no consume RPCs de outcomes/fulfillment |
| Auth / `ed61b81c…` | `lib/server/data-mode.ts`, `lib/supabase/policies.ts`, guards y callback/signout, `.env.example`, tests Auth | Ninguno | 16 Vitest + 18 Node en worktree; integración actual 42 Vitest + 18 Node, typecheck/build | Fallback fixture en algunas lecturas catálogo/búsqueda requiere revisión; operación conectada no usa service-role client ni las RPCs restringidas |
| QA / `680a5362…` | `tests/integration/**`, `tests/e2e/catalog.spec.ts`, test config | Ninguno | 7 E2E actuales; 42 Vitest + 18 Node; custom PostgreSQL gate | La matriz cubre roles/acciones sensibles seleccionadas, no CRUD exhaustivo en cada tabla |
| Accessibility / `4b07067f…` | CSS global, storefront header/interactions/collections, business quote form | Ninguno | Lint/build/E2E integrados | Revisión manual completa de dialogs, teclado y contraste aún pendiente |
| Storefront UX / `a974956c…` | home, configurador, PC builder, ProductCard, `docs/UX_REVIEW.md` | Ninguno | typecheck, lint focal, tests, build y revisión desktop/mobile declarados; E2E actual pasa | carrito y checkout siguen siendo demo local/fundamentalmente client-side; catálogo conectado continúa con límites documentados |
| Backoffice review / `db786e62…` | `docs/BACKOFFICE_REVIEW.md` | Ninguno | Static review; después se añadieron pruebas SQL runtime | Ventas no puede leer pedido/líneas/eventos/pagos; error de archivo demo corrupto queda como deuda P3; identidad de variantes ocultas para fulfillment puede verse como UUID |

## Resultado de integración y gates

- Se corrigió la política de lectura de `orders`, `order_items` y `order_events` para retirar `sales_manager`; prueba SQL verifica también `payment_transactions`.
- Se añadieron casos runtime de separación empresarial buyer/admin, creación acotada de miembros, rechazo de cross-tenant y de escalada a `owner`, y lectura de superadmin.
- `supabase db reset`, `db lint`, 60 pgTAP y `tests/integration/postgres-rls.sql` pasan en PostgreSQL local. El script revierte las fixtures al final.
- `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (42+18), `pnpm test:e2e` (7) y `pnpm build` pasan.
- Se cambió `<img>` a `next/image` en comparación/carrito y se quitaron disables no usados. `git diff --check` solo reporta avisos de conversión LF/CRLF de Windows.
- No hay credenciales remotas ni cambios sobre Supabase remoto. La búsqueda del repositorio no encontró claves/service-role o secretos `NEXT_PUBLIC`.

## Dependencias desbloqueadas

- DB define `resolve_demo_payment`, `fulfill_order`, `mark_order_delivered` y `adjust_inventory`; ahora puede implementarse su consumidor de servidor con ownership separado.
- El contrato de RLS/grants para datos operativos está probado localmente; continúan revisiones por endpoint y matriz completa.
- La ola 3 puede comenzar desde este estado para checkout, boundaries storefront, CRM/B2B, Support/RMA y auditoría de seguridad.

## Regla de entrega para la siguiente ola

Cada conversación debe reportar trabajo, archivos, commit/worktree, decisiones y contratos, comandos/resultados, bugs/riesgos, dependencias desbloqueadas y siguientes pasos. El tech lead valida cada cambio contra Git y ejecuta los gates relevantes antes de actualizar este documento y el tablero.
