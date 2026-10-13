# Checkout conectado: E2E local

Esta suite recorre un Chromium real, GoTrue, las cookies de sesión SSR, `POST /api/checkout`, PostgREST y los RPC de checkout/pago contra el proyecto Supabase local. No usa mocks ni el modo demo de archivos.

## Ejecución

Requisitos: Docker Desktop en marcha, dependencias del repositorio instaladas y Supabase local iniciado/migrado. Desde PowerShell, en la raíz del repositorio:

```powershell
pnpm dlx supabase@latest start
pnpm dlx supabase@latest db reset --local --yes
./tests/e2e/checkout-connected/run.ps1
```

El runner obtiene valores desde `supabase status --output env` sin imprimirlos ni guardarlos. Rechaza destinos que no sean loopback en el puerto local configurado `56201`. La publishable key llega al cliente; las claves `SECRET_KEY`/`SERVICE_ROLE_KEY` se usan únicamente por Next.js en servidor y por helpers Node de setup/inspección/cleanup. No se inyectan en el contexto Chromium.

El setup crea usuarios ficticios confirmados por Admin Auth, productos/variantes publicados con stock propio y un almacén existente. Al terminar, elimina pedidos y sus hijos, carritos, usuarios, catálogo y entradas de auditoría de la suite. El esquema protege las reservas contra borrado; por eso el cleanup ejecuta el SQL local como `postgres`, desactiva los triggers de usuario en una transacción mientras borra exclusivamente IDs de fixtures y los vuelve a activar antes del commit. Si falla, PostgreSQL revierte tanto el borrado como la desactivación. Las credenciales fake y resultados Playwright viven bajo `.data/`, ignorado por Git.

## Cobertura y límites

- Pago automáticamente aprobado desde una sesión de navegador autenticada, comprobando pedido, pago, reserva, stock y eventos de timeline mediante lectura de PostgREST privilegiado desde Node.
- `variantId`, repetición de la misma clave/payload, rechazo de payload distinto y ausencia de pedidos/pagos/reservas/eventos duplicados.
- Refresh real después de perder la respuesta: el formulario conserva clave/fingerprint de `sessionStorage` y el reintento devuelve el mismo pedido ya aprobado.
- Dos sesiones GoTrue y dos POST simultáneos contra una unidad: un ganador confirmado y una respuesta 409 sin oversell ni segundo pedido.
- El formulario del storefront envía `variantId`; el servidor vuelve a leer el precio, estado de publicación y stock. Los reintentos consultan `find_checkout_order` antes de crear o modificar un carrito, así la misma compra no genera un carrito convertido adicional.

La suite usa fixture de una unidad para concurrencia y elimina todos sus datos. No ejecuta pagos rechazados: el cliente no puede elegir el resultado y el servidor siempre fija aprobación. No ejecutar simultáneamente contra otra suite que modifique el mismo proyecto local. No apunta a proyectos remotos ni es una certificación de producción.

La clave de idempotencia se valida con el fingerprint de productos/direcciones. El mismo payload devuelve el pedido existente sin duplicar carrito, pago, reserva ni eventos; un payload distinto se rechaza con conflicto. La suite usa Supabase local aislado y no certifica el entorno remoto.
