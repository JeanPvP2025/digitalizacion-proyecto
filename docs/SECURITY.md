# Seguridad y RLS

Estado del **2026-10-07**. Validación realizada contra Supabase/PostgreSQL local con datos ficticios; no se han probado credenciales, Auth ni políticas de un proyecto remoto.

## Controles integrados

- `supabase/migrations/20261007085225_database_security_invariants.sql` revoca DML directo en orders, payments, inventory, reservas y eventos; usa RPCs restringidas para transiciones. Catálogo, CRM, soporte y membresías conservan grants/policies por propósito.
- `lib/server/data-mode.ts` resuelve el origen de datos en servidor. El modo de archivo demo requiere desarrollo local y `DEMO_MODE`; la configuración conectada exige URL/clave pública de Supabase. Backoffice en modo conectado requiere sesión y rol reconocido.
- No existe un cliente service-role en cliente. Búsqueda de nombres de variables/secretos (`SERVICE_ROLE`, `SUPABASE_SECRET`, `sb_secret`, `JWT_SECRET`, `NEXT_PUBLIC_*SECRET`) sin coincidencias en el código versionable revisado.
- Los fixtures de prueba son ficticios y el gate SQL ejecuta dentro de transacción revertida.

## Evidencia runtime

`pnpm dlx supabase@latest db reset`, `pnpm dlx supabase@latest test db --local tests/database` (60 pgTAP), `pnpm dlx supabase@latest db lint --local` y `tests/integration/postgres-rls.sql` pasan localmente.

La matriz runtime seleccionada comprueba anon sin acceso a membresías/lectura CRM, consentimiento B2B, customer A/B con privacidad de pedidos y tickets, sales sin lectura de pedido/línea/evento/transacción de otro cliente ni inventario/soporte, fulfillment con inventario y sin CRM, support con cola de tickets y sin inventario, y miembros empresariales buyer/admin separados por organización. Admin empresarial no puede asignar `owner` ni cambiar otro tenant; superadmin puede leer organizaciones/membresías. También prueba que escritura directa de stock/pedido/pago carece de grants y que RPC checkout no acepta carrito ajeno o sobreventa.

Esta es cobertura de escenarios seleccionados, no una prueba exhaustiva SELECT/INSERT/UPDATE/DELETE de cada tabla sensible con cada rol. Roles B2B se representan mediante `organization_memberships.role` (`buyer`/`admin`); los nombres de aplicación “business_user” y “business_manager” no son valores del enum de organización.

## Riesgos abiertos

- Checkout de navegador/API conectado aún no orquesta el RPC `resolve_demo_payment`; existe el RPC y está probado en pgTAP, pero la UI no cierra el ciclo pago-pedido-reserva.
- `place_order` devuelve el pedido existente ante clave idempotente repetida sin comprobar que coincida carrito/dirección; la dirección requiere validación más profunda.
- No se ha auditado exhaustivamente fixture fallback y acceso por API en producción, ni la matriz de endpoints por JWT real.
- CRM/organizaciones permite que `sales_manager` lea organizaciones y membresías para su tarea comercial; revisar si ese acceso global contiene solo los campos necesarios.
- Soporte aún realiza inserts separados; falta atomicidad y enlace seguro de email/pedido para RMA.
- No hay despliegue, configuración remota, rotación de secretos ni revisión del runtime de producción.

## Release guard

No habilitar uso con datos reales hasta cerrar los P0 de `STATUS.md`, verificar Auth/RLS con proyecto del entorno, establecer secretos solo servidor cuando sean necesarios y ejecutar gates de producción. Nunca agregar service-role a variables `NEXT_PUBLIC_*`.
