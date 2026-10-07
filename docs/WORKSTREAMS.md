# Workstreams and ownership

Tablero central de conversaciones independientes. La conversación coordinadora posee contratos globales e integración; cada conversación activa mantiene ownership exclusivo y entrega handoff.

## Ola 3 — lista para asignar

| Conversation | Role | Task | Ownership | Dependencies | State |
|---|---|---|---|---|---|
| Tech Lead (current) | Integration Lead | Integrate ola 2, run gates, maintain backlog and contracts | Shared docs, integration, merge decisions | Completed ola 2 | 🚧 Coordinating |
| NODRIA — Checkout conectado e integridad de pedidos | Commerce Agent | Wire connected checkout to demo-payment RPC; fingerprint idempotency, order/payment/reservation error recovery | `app/api/checkout/**`, checkout UI, `lib/commerce/**`, checkout-only migration/tests | Existing `place_order` and `resolve_demo_payment` RPC contracts | 🚧 Queued — `client-new-thread:937a74f0-776b-4bdf-8eb2-ff9fc9a2b490` |
| NODRIA — Límites de datos del storefront | Storefront Agent | Audit/fix fixture fallback in catalog, search, PDP, favorites and compare for connected/prod mode | `lib/catalog*`, `lib/search/**`, catalog/storefront read routes | `lib/server/data-mode.ts` | 🚧 Queued — `client-new-thread:ce1c38a8-f6a8-46b9-9c44-5752d35ec180` |
| NODRIA — Completar CRM y B2B | CRM/B2B Agent | Complete company membership onboarding, quote workflow, CRM activity history and role-aware data operations | `app/backoffice/crm/**`, `app/(store)/empresas/**`, `lib/crm/**`, `lib/quotes/**`, CRM/B2B-only migrations | Current schema/RLS | 🚧 Queued — `client-new-thread:988de7b3-8ba9-4123-aa7b-447d514c45da` |
| NODRIA — Soporte y devoluciones RMA | Support Agent | Make ticket plus initial message atomic; implement return/support intake contract | `app/api/support/**`, `app/(store)/soporte/**`, `lib/support/**`, support/RMA-only migration/tests | Existing ticket/message tables and `request_return` RPC | 🚧 Queued — `client-new-thread:09d903b8-13f2-4bd6-b01e-90d39e807d26` |
| NODRIA — Auditoría independiente de seguridad | Security Agent | Expand independent RLS/API audit to remaining sensitive tables and role/action matrix; report concrete regressions | Read-only product review + `docs/SECURITY_FOLLOWUP.md`, `tests/integration/security/**` | Current migrations and local Supabase | 🚧 Queued — `client-new-thread:a855f9c6-4ee8-41af-aa81-2cbd00b75974` |

## Ola 2 — finalizada e reconciliada

| Conversation | Role / task | Observed worktree output | Integration / status |
|---|---|---|---|
| `client-new-thread:52026060-e46b-4bd2-bd4a-04dbafa32b71` | Database / RLS invariants | Migration `20261007085225_database_security_invariants.sql`, pgTAP invariants, `docs/database.md` | Integrated; 60 pgTAP, reset, DB lint passed; no commit in worker worktree |
| `client-new-thread:ed61b81c-d2c9-4e4f-9332-28b3e6c516cb` | Auth / data mode | Server data-mode and policy helpers, guarded demo IO, auth callback/signout and backoffice boundaries, unit tests | Integrated; typecheck/unit/build passed; no worker commit |
| `client-new-thread:680a5362-a60c-4e48-b534-deb343e40366` | QA integration | Route/staff tests, PostgreSQL RLS script, 7 catalog E2E, test config | Integrated; 42 Vitest + 18 Node, 7 E2E, custom SQL gate passed; no worker commit |
| `client-new-thread:4b07067f-14d8-4d48-b20c-df4b84d170dc` | Accessibility | Skip/focus/nav/live regions and business form errors | Integrated; lint/build/E2E pass; manual full WCAG audit remains; no worker commit |
| `client-new-thread:a974956c-14f4-4a7f-87e7-c2c45f3d0ea8` | Storefront UX | Home truthfulness, saved PC build recovery, cards/configurator and `UX_REVIEW.md` | Integrated; 7 E2E/build; checkout/cart gaps remain; no worker commit |
| `client-new-thread:db786e62-0102-42e3-938b-389d5d4b3eb2` | Backoffice review | `docs/BACKOFFICE_REVIEW.md` static role/data findings | Integrated as review; sales order-data issue fixed and covered by runtime test; corrupt demo JSON error remains; no worker commit |

## Backlog priorizado

### P0

- [ ] Cerrar de extremo a extremo checkout conectado → pago aprobado/rechazado → pedido → reservas/liberación desde rutas/API, no solo desde SQL tests.
- [ ] Validar fingerprint de idempotencia y dirección completa; garantizar recovery ante timeout/retry.
- [ ] Revisar fixture fallback en catálogo/búsqueda y comprobar separación en runtime de producción.
- [ ] Ampliar RLS a CRUD exhaustivo por rol en todas las tablas/endpoints sensibles; las pruebas actuales son parciales.

### P1

- [ ] Conectar Operations Center a orders/pagos reales y conciliar estados.
- [ ] Atomicidad de ticket+mensaje; completar devoluciones/RMA.
- [ ] UI de movimientos y recepción que invoque las RPCs; reconciliación de stock.
- [ ] Completar onboarding B2B, lifecycle quote y actividades CRM.
- [ ] Resolver purchase/conversión de PC Builder a variantes vendibles.

### P2

- [ ] Auditoría de teclado, dialogs, contraste y responsive de toda la app.
- [ ] Expandir E2E por dominios; probar navegador con Auth/RLS.
- [ ] Métricas de rendimiento reales y optimización responsive de imágenes/JS.
- [ ] Revisar botones/enlaces, estados vacíos/errores y lecturas JSON corruptas.

### P3

- [ ] Gestión de catálogo, proveedores/compras, analítica y CMS.
- [ ] Moderación de reseñas, monedas adicionales y refinamiento de PC compatibility.
