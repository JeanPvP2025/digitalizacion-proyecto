# Auditoría UX autenticada de cliente y empresas

## Alcance

La suite usa un proyecto Supabase local desechable para comprobar `/mi-cuenta` y `/empresas/portal` con una cuenta customer y membresías B2B `owner`, `admin`, `buyer` y `viewer`. Provisiona también un tenant ajeno para comprobar que cambiar el parámetro `organization` no cambia el tenant visible. Las cuentas, organización y contraseñas son ficticias y se crean únicamente dentro del proyecto efímero.

El navegador inicia sesión mediante la UI de Supabase Auth. La suite comprueba el estado autenticado y anónimo, navegación y acciones visibles por rol, aislamiento de tenant confirmado además con consultas RLS autenticadas, y overflow del documento, `<main>` y controles en 390, 768 y 1280 px. Guarda capturas Playwright en `.data/customer-b2b-results/`.

No realiza mutaciones del producto (solicitudes de cotización, pedidos ni cambios de membresía). Esta es cobertura de recorrido y autorización visible/tenant; no sustituye la verificación de Server Actions, RLS por tabla/columna ni la matriz completa de permisos.

## Ejecución reproducible (Windows / PowerShell 7)

Requiere Docker activo, Corepack/pnpm, dependencias instaladas y Chromium de Playwright disponible.

```powershell
corepack pnpm install --frozen-lockfile
pwsh -File tests/e2e/ux-audit/run-customer-b2b.ps1
```

El runner copia las migraciones y seed al workdir temporal, crea el proyecto `nodria-customer-b2b` con API `127.0.0.1:56901` y arranca Next.js en `127.0.0.1:4331`. Comprueba que puertos/containers del proyecto aislado estén libres y rechaza cualquier URL Supabase que no sea la loopback esperada. La clave de servicio solo se lee del estado de ese stack y se usa en memoria para emitir usuarios Auth de prueba; nunca se muestra ni se guarda en el reporte. El navegador y las consultas de ownership usan sesiones Auth reales con la clave publicable.

El `finally` del runner detiene el proyecto Supabase efímero incluso si falla la preparación, Playwright o una aserción, restaura variables de entorno y retira su workdir temporal cuando la detención termina correctamente. Si la detención falla, informa el project ID y workdir necesarios para completar la limpieza manual. No ejecutar simultáneamente con otra suite que use el mismo project ID/puertos.

## Evidencia de esta ejecución

`pwsh -File tests/e2e/ux-audit/run-customer-b2b.ps1`: **1/1** pasa en el proyecto aislado `nodria-customer-b2b`. La suite inicia sesión con Auth real, recorre customer y membresías owner/admin/buyer/viewer y verifica aislamiento de tenant y overflow a 390/768/1280 px. El runner detuvo el stack y retiró su directorio temporal. TypeScript y lint pasan en el gate de integración. La suite es solo de observación y no demuestra CRUD de oportunidades o miembros.

## Límites

- El test recorre `customer` en la cuenta y el portal sin membresía únicamente mediante el redirect de autenticación; los cuatro roles de membresía se recorren después de iniciar sesión.
- La suite no modifica acciones del producto ni cubre operabilidad CRUD de cotizaciones o miembros.
- Se necesita acceso local a Docker. Ningún proyecto Supabase remoto ni cuenta externa se utiliza.
