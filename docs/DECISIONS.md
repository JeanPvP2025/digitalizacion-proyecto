# Registro de decisiones

Las decisiones de alcance heredadas de la misión se marcan **Confirmada**. Las decisiones técnicas que aún dependen de migraciones o implementación se marcan **Propuesta** hasta que el código, los contratos o una revisión del tech lead las materialicen. Fecha del registro inicial: **2026-10-07**.

## D-001 — Identidad de producto: NODRIA

- **Fecha:** 2026-10-07
- **Estado:** Confirmada para la misión; identidad visual pendiente.
- **Contexto:** El proyecto necesita una empresa tecnológica ficticia y una marca propia.
- **Decisión:** Usar NODRIA como nombre del retailer tecnológico académico.
- **Alternativas:** Cambiar el nombre más adelante o conservar el nombre genérico del scaffold.
- **Motivo:** NODRIA es la identidad asignada para este proyecto; el scaffold `digitalizacion-web` es el nombre técnico del repositorio, no el nombre comercial.
- **Consecuencias:** Copy, wordmark, catálogo y datos de demo deben ser coherentes con NODRIA. No implica que el sistema visual o los assets estén implementados.

## D-002 — Mercado inicial: España, español y EUR

- **Fecha:** 2026-10-07
- **Estado:** Confirmada.
- **Contexto:** El producto requiere un mercado concreto, manteniendo orientación internacional.
- **Decisión:** Iniciar con España, idioma español y moneda EUR; preparar contratos explícitos para ampliar países/monedas más adelante.
- **Alternativas:** Diseñar primero un mercado global o implementar varios idiomas/monedas al inicio.
- **Motivo:** Coincide con el alcance solicitado y limita la complejidad inicial sin cerrar extensiones futuras.
- **Consecuencias:** El formato local de presentación no debe reemplazar códigos ISO/moneda en datos. No se declara internacionalización implementada.

## D-003 — Mantener el scaffold Next.js existente

- **Fecha:** 2026-10-07
- **Estado:** Confirmada.
- **Contexto:** El repositorio ya trae Next.js 16.4, React 19.3, TypeScript 5, Tailwind CSS 4, App Router y pnpm 10.32.1.
- **Decisión:** Construir sobre ese scaffold, sin migrarlo ni sustituir el framework.
- **Alternativas:** Re-inicializar, cambiar stack o comenzar otro proyecto.
- **Motivo:** La plataforma solicitada define Next.js/React/TypeScript y un scaffold compatible ya existe.
- **Consecuencias:** Antes de modificar código, leer los documentos instalados de Next.js 16 y confirmar las APIs vigentes. La app ya tiene marca NODRIA, grupos de ruta y componentes propios.

## D-004 — Monolito modular como arquitectura inicial

- **Fecha:** 2026-10-07
- **Estado:** Confirmada como arquitectura de esta entrega.
- **Contexto:** Storefront, comercio, B2B, CRM, inventario y soporte comparten entidades y flujos; separar servicios elevaría el coste de consistencia y despliegue.
- **Decisión:** Mantener una aplicación Next.js y separar módulos por dominio, con casos de uso en servidor y límites de propiedad claros.
- **Alternativas:** Microservicios, aplicaciones separadas por superficie o un conjunto de pantallas sin límites de dominio.
- **Motivo:** Equilibra complejidad académica útil, transacciones compartidas y facilidad de despliegue.
- **Consecuencias:** Los módulos comparten PostgreSQL, pero no deben duplicar reglas ni depender circularmente. No introducir infraestructura distribuida sin evidencia.

## D-005 — Supabase/PostgreSQL como fuente de verdad prevista

- **Fecha:** 2026-10-07
- **Estado:** Confirmada; schema/seed y checkout conectado implementados contra los RPCs existentes. Auth E2E remota y recorrido browser conectado pendientes.
- **Contexto:** La misión requiere Supabase para Postgres, Auth, Storage y RLS. La migración y el seed inicial ya existen, pero no hay credenciales ni ejecución local verificada.
- **Decisión:** Diseñar persistencia alrededor de PostgreSQL gestionado por Supabase, con migraciones reproducibles y RLS. Las migraciones y objetos de base pertenecen a `supabase/**`.
- **Alternativas:** Datos solo locales/mock, cambios manuales en dashboard o un backend separado.
- **Motivo:** Cumple el requisito del producto y permite integridad relacional, políticas y despliegue reproducible.
- **Consecuencias:** Migraciones definen tablas, roles, policies y RPCs; reset/seed, 156 pgTAP y pruebas PostgreSQL locales pasan. Storefront conectado, checkout, CRM y soporte consumen contratos conectados en partes; Operations, PC Builder, compras y analytics siguen demo/parciales. No presentar `.data/` como PostgreSQL. El arranque local usa puertos alternativos en `supabase/config.toml` por exclusiones de Windows.

## D-010 — Modo de datos demo resuelto en servidor

- **Fecha:** 2026-10-07
- **Estado:** Confirmada e integrada.
- **Contexto:** Conviven fixtures, archivos `.data/` y Supabase; una elección basada en UI permitiría cruces accidentales de datos.
- **Decisión:** `lib/server/data-mode.ts` determina modo en servidor. El modo de archivo demo requiere `NODE_ENV=development`, `DEMO_MODE=true` y no tener credenciales Supabase; cuando hay configuración Supabase no se usa fallback local ante errores conectados.
- **Consecuencias:** Backoffice demo no se habilita sin sesión/rol real en modo conectado. Las lecturas de catálogo/búsqueda y fixtures siguen bajo auditoría para asegurar la misma regla en todas las superficies.

## D-011 — Mutaciones operativas por RPC y RLS probado localmente

- **Fecha:** 2026-10-07
- **Estado:** Confirmada parcialmente; gates locales pasan.
- **Contexto:** La escritura directa en orders, payments, inventory y memberships podía romper estado o cruzar tenants.
- **Decisión:** Revocar DML directo sobre transiciones operativas protegidas y exponer operaciones PostgreSQL acotadas como `place_order`, `resolve_demo_payment`, `fulfill_order`, `mark_order_delivered` y `adjust_inventory`; controlar cambios mediante transacción/RLS y grants mínimos.
- **Consecuencias:** Reset/seed, 60 pgTAP, DB lint y un gate RLS/checkout seleccionado pasan localmente. La aplicación conectada aún no consume outcome de pago/fulfillment; el gate no es auditoría exhaustiva ni prueba remota.

## D-006 — Pago únicamente simulado

- **Fecha:** 2026-10-07
- **Estado:** Confirmada como límite del producto académico; outcomes de prueba se resuelven desde servidor conectado y nunca procesan dinero.
- **Contexto:** La demo debe mostrar un checkout defendible sin procesar dinero.
- **Decisión:** Mantener simulador server-side con resultados de prueba, intentos persistidos, pedido relacionado e historial ficticio. No usar pasarela real y no solicitar números bancarios reales.
- **Alternativas:** Stripe/pasarela bancaria real, o checkout que solo aparenta confirmar pedidos.
- **Motivo:** Evita dinero real y permite enseñar estados de aprobación, rechazo y reintento con trazabilidad.
- **Consecuencias:** UI y documentación advierten no introducir datos bancarios. Route Handler autenticado crea/recupera el pedido; `payment-admin.ts` llama RPC de resultado con clave secreta solo servidor; RPC vincula outcome/evento, pago, pedido, timeline y reserva atómicamente. pgTAP y pruebas de ruta cubren retry/rollback; falta E2E con Auth/PostgREST conectado.

## D-007 — Inventario derivado y checkout transaccional

- **Fecha:** 2026-10-07
- **Estado:** Materializada por `place_order_from_checkout`, `resolve_demo_payment` y RPCs de fulfillment; validada en base local. Pruebas de concurrencia separada pendientes.
- **Contexto:** Pedidos simultáneos, cancelaciones y devoluciones pueden dejar stock incoherente.
- **Decisión:** Modelar disponibilidad como físico menos reservado y coordinar reserva/liberación y cambios de pedido de manera atómica en base de datos. El servidor confirma precios y stock al checkout.
- **Alternativas:** Tratar el stock enviado por el cliente como autoridad o mantener contadores duplicados sin reconciliación.
- **Motivo:** Protege invariantes de negocio bajo concurrencia y deja el histórico auditable.
- **Consecuencias:** `docs/DATA_MODEL.md` documenta snapshots y relaciones; SQL verifica sobreventa, retry, liberación, rollback y reconciliación. Checkout API conectado está integrado; Operations/fulfillment UI e inventario continúan parciales.

## D-008 — Datos de demostración siempre ficticios

- **Fecha:** 2026-10-07
- **Estado:** Confirmada; seed ficticio inicial añadido.
- **Contexto:** La aplicación necesita datos creíbles para la presentación, pero no tiene credenciales/seed configurados.
- **Decisión:** Usar productos, personas, empresas, VAT/NIF, pagos, facturas y envíos inventados; separar seed de demo de datos productivos.
- **Alternativas:** Datos personales/empresariales reales o fixtures presentados como datos reales.
- **Motivo:** La demostración puede ser rica sin introducir información real ni confundir una simulación con producción.
- **Consecuencias:** La procedencia y carácter ficticio deben quedar claros en las rutas y materiales de demo. El seed no crea usuarios Auth ni permite login de contactos ficticios.

## D-009 — No activar Cache Components hasta adoptar sus patrones

- **Fecha:** 2026-10-07
- **Estado:** Confirmada para la base actual.
- **Contexto:** El scaffold habilitaba Cache Components y Partial Prefetching por defecto, mientras que la aplicación depende de rutas dinámicas con sesión y Route Handlers configurados para runtime Node.
- **Decisión:** Mantener el comportamiento dinámico estándar de Next.js hasta que exista una necesidad concreta de caché y se adopten sus patrones de sesión/streaming.
- **Alternativas:** Forzar la migración de todas las rutas al modelo de Cache Components en esta entrega.
- **Motivo:** La aplicación todavía no tiene caché de datos que aproveche esa opción; mantener el patrón estándar reduce configuración sin uso y permite compilar los flujos actuales.
- **Consecuencias:** `next.config.ts` no habilita `cacheComponents` ni `partialPrefetching`. Revisar esta decisión si se incorpora caché de dominio.

## D-011 — Ventana comercial B2B y privacidad de actividad

- **Fecha:** 2026-10-07
- **Estado:** Confirmada para la cola actual; requiere revisión si se amplía el equipo.
- **Contexto:** ventas necesita reclamar solicitudes empresariales no asignadas para que el presupuesto pueda avanzar a oferta; una cuenta de ventas no requiere un directorio global de organizaciones, rosters ni datos de pago.
- **Decisión:** `sales_manager` puede leer la cola de presupuestos formales `requested` sin propietario y los presupuestos asignados a su usuario. No puede enumerar organizaciones/membresías, pedidos o pagos. Antes del claim, puede ver actividad `internal`; las notas `organization` solo las ven miembros de la organización. Después de reclamar, la actividad de trabajo pertenece a la superficie asignada.
- **Alternativas:** negar toda cola y exigir asignación previa manual; o permitir lectura global de todas las tablas CRM/B2B.
- **Motivo:** conserva el flujo comercial de claim/oferta sin mantener el hallazgo de enumeración de organizaciones y notas privadas.
- **Consecuencias:** políticas se prueban en `tests/integration/security/postgres-object-isolation.sql`; si se requieren vistas/campos distintos en producción, crear un contrato dedicado y pruebas antes de ampliar acceso.
