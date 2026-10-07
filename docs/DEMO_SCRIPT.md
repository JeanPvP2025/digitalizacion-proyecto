# Guion académico de demo NODRIA

**Duración:** 10–15 minutos · **Corte del estado:** 2026-10-07 · **Entorno recomendado:** demo local de archivos.

Este guion enseña tres recorridos reales de la aplicación: pedido con pago ficticio, solicitud de propuesta B2B y ticket de soporte. Los nombres, productos, empresa, correo, dirección y pagos son inventados. No uses información de personas reales ni datos bancarios.

## Antes de presentar

1. Sigue [Instalación y modos de ejecución](./SETUP.md), apartado “Demo local de archivos”. Ejecuta `pnpm dev` y abre <http://localhost:3000>.
2. Confirma en `/checkout` el aviso **FINALIZAR PEDIDO · DEMO LOCAL**. Si aparece “SUPABASE”, estás en otro modo; no presentes datos `.data` como datos conectados.
3. Prepara una ventana de navegador limpia para carrito y formularios. Los productos salen de fixtures ficticios; las transacciones del guion se guardan en `.data/` y en el almacenamiento local del navegador.
4. Recuerda el límite: el rechazo de pago en modo archivos no reserva ni libera stock de una base de datos. Muestra el resultado simulado, no una operación comercial real.

### Datos ficticios para el relato

| Uso | Valores de demostración |
|---|---|
| Cliente de checkout | Alex García Demo · `alex.garcia@demo.nodria.test` · `+34 000 000 000` |
| Dirección | Calle Demo 1 · 28000 · Madrid · Madrid |
| Empresa solicitante | Estudio Prisma Demo · Ana Demo · `ana@estudioprisma.example` · `+34 000 000 001` |
| Producto | FluxBook 14 Pro · precio ficticio mostrado en catálogo: 1.499 € |
| Soporte | El formulario precompleta `alex.garcia@demo.nodria.test`; el pedido es opcional y se deja vacío |

El seed local de Supabase contiene catálogo/stock y algunos ejemplos CRM, pero no incluye usuarios Auth ni organizaciones con membresía. Estos datos de presentación no son cuentas de acceso.

## Recorrido de 10–15 minutos

### 0:00–1:00 · Contexto

Explica que NODRIA es un retailer tecnológico ficticio, en español y EUR, implementado como una aplicación modular. Distingue modo de archivos de Supabase local: el guion principal usa archivos locales para no depender de cuentas ni servicio externo.

### 1:00–5:00 · Pedido aprobado

1. Abre `/producto/fluxbook-14-pro` o encuéntralo desde `/catalogo`; pulsa **Añadir al carrito**.
2. Abre `/checkout`. Completa el formulario con los datos de “Cliente de checkout” y “Dirección” de la tabla.
3. Elige **DEMO-APROBADO** y pulsa **Confirmar compra demo**.
4. Señala la confirmación de pedido aprobada, su referencia `NDR-...` y el total en EUR. En modo de archivos el pedido se añade a `.data/orders.json` y el carrito aprobado se limpia.

**Resultado esperado:** respuesta de demostración persistida en este equipo; no se crea una sesión de cliente, cargo, factura ni envío real.

### 5:00–8:00 · Pedido rechazado

1. Vuelve al catálogo y añade otra vez el mismo producto.
2. Completa la dirección ficticia y elige **DEMO-RECHAZADO**.
3. Envía y muestra la confirmación de pago rechazado y otra referencia de pedido.

**Resultado esperado:** el estado visible indica rechazo y queda un registro ficticio en `.data/orders.json`. El carrito se conserva para permitir cambiar de resultado o corregir datos. En el modo de archivos no existe una reserva de stock que liberar. En Supabase local, la misma selección sí recorre `resolve_demo_payment`: el pedido rechazado se cancela y su reserva transaccional se libera.

### 8:00–11:00 · Consulta B2B pública (Demo Mode)

1. Abre `/empresas#solicitar` y completa el formulario con “Empresa solicitante”.
2. En volumen elige **1–5 equipos**. Describe una necesidad ficticia, por ejemplo: “Solicitamos una propuesta para cuatro puestos de edición con portátiles y monitores para un estudio creativo en Madrid.”
3. Acepta el consentimiento del formulario y pulsa **Enviar solicitud**.

**Resultado esperado:** confirmación **SOLICITUD REGISTRADA** y una referencia `DEMO-QIN-...`; la consulta queda en `.data/quotes.json` en modo archivos.

**Límite para explicar:** esta pantalla pública guarda una consulta para ventas; no es el presupuesto estructurado del portal empresarial, no calcula una oferta definitiva y no envía correo. La gestión de solicitudes y la respuesta de ventas no tienen un recorrido público de demostración en modo archivos. Si la evaluación requiere un presupuesto estructurado, usa la variante conectada de abajo en lugar de este paso.

### 11:00–13:00 · Soporte público

1. Abre `/soporte` y usa el correo ficticio precompletado.
2. Elige **Configuración o compatibilidad**. Deja vacío el número de pedido; escribe, por ejemplo, “La configuración de prueba muestra un aviso ficticio al conectar un monitor. Necesitamos orientación para revisar los pasos.”
3. Marca el consentimiento y pulsa **Abrir ticket de soporte**.

**Resultado esperado:** confirmación **SOLICITUD REGISTRADA**, referencia `TCK-2026-...` y registro ficticio en `.data/tickets.json`. No se envía correo ni se abre una conversación con un agente.

### 13:00–15:00 · Cierre y límites

Repite que las tres persistencias son locales, usa las referencias generadas como evidencia de ejecución y no como identificadores válidos fuera de la sesión. Si el tiempo es limitado, omite la segunda dirección del checkout, pero conserva ambos resultados de pago.

## Variante conectada: presupuesto estructurado B2B

Esta variante también cabe en 10–15 minutos si se completa la cuenta y se crea la organización **antes de empezar el cronómetro**, siguiendo [`SETUP.md`](./SETUP.md). Mantén Supabase local activo y la sesión iniciada en `http://127.0.0.1:3000`. Usa una ventana de navegador aparte del Demo Mode de archivos.

1. En el paso de checkout aprobado, selecciona FluxBook 14 Pro, completa los datos ficticios y elige **DEMO-APROBADO**. El pedido conectado conserva el estado aprobado en la base local.
2. Vuelve a añadir el producto y repite con **DEMO-RECHAZADO**. La respuesta conectada indica cancelación y liberación de reserva.
3. En vez de enviar el formulario público de `/empresas`, abre `/empresas/portal`. En “¿Qué necesita tu equipo?”, selecciona la variante FluxBook 14 Pro, indica `4` unidades y añade un contexto ficticio como “Cuatro puestos de edición para Estudio Prisma Demo”. Pulsa **Enviar a ventas**.
4. Comprueba que la nueva cotización aparece en la lista con número y estado **Recibida**. Es una solicitud estructurada y persistida en Supabase local; ventas todavía debe preparar y enviar una oferta.
5. Abre `/soporte`, deja vacío el pedido (no es requisito) y envía un ticket ficticio con consentimiento. Espera confirmación con referencia `TCK-...`; la ruta conectada requiere sesión Auth y guarda ticket + primer mensaje en PostgreSQL.

No se necesita ni se debe inventar una cuenta del equipo comercial para completar estos pasos. El recorrido termina cuando la organización ve su solicitud como recibida; la oferta comercial y la respuesta de un agente de soporte quedan fuera del demo. No es una prueba de entorno remoto ni E2E automatizado.

## Qué usa cada modo

| Parte | Demo Mode de archivos (`DEMO_MODE=true`, sin claves Supabase) | Supabase local + Auth |
|---|---|---|
| Catálogo y carrito | Fixtures de catálogo y almacenamiento de navegador | Catálogo/variantes/stock del seed local; carrito conectado requiere sesión para persistencia por cuenta |
| Checkout aprobado/rechazado | POST de demo; pedidos ficticios en `.data/orders.json`; no hay reserva SQL | Requiere cuenta Auth y `SUPABASE_SECRET_KEY` local server-only; el servidor valida precio/stock y resuelve resultado con RPC y transacción |
| Formulario B2B de `/empresas` | Consulta ficticia en `.data/quotes.json` | Inserta consulta pública en `quote_inquiries` con clave publicable y grants/policies locales |
| Presupuesto estructurado `/empresas/portal` | No disponible: no existe sesión ni organización demo | Requiere cuenta Auth y organización con membresía; el seed no provee usuarios/organizaciones Auth. La solicitud queda estructurada, asociada a la organización y aparece como **Recibida** |
| Ticket de `/soporte` | Solicitud pública ficticia en `.data/tickets.json` | Requiere sesión Auth; ticket y primer mensaje se escriben juntos en Supabase |
| Backoffice / acciones por rol | No disponible: el modo de archivos no crea sesión ni roles | Registra cuentas Auth locales ficticias desde `/acceso` y ejecuta `scripts/demo/assign-staff-roles.ps1` para asignar grants persistidos. Usa cuentas separadas para `super_admin`, catálogo, soporte, ventas y almacén; RLS y las rutas vuelven a validar roles. El reset local borra usuarios/grants |

Para el modo conectado, sigue la sección Supabase local de [`SETUP.md`](./SETUP.md). El checkout conectado en pantalla muestra resultados demo; no procesa dinero. Los E2E autenticados de checkout, dominios conectados y B2B usan Supabase local; no hay entorno remoto validado.

## Fallback seguro

- Si una ruta muestra que necesita credenciales, no cambies a claves remotas durante la presentación. Para la historia principal, vuelve al `.env.local` de Demo Mode con las dos variables Supabase vacías y `DEMO_MODE=true`, reinicia Next.js y comprueba el rótulo del checkout.
- Si el formulario informa de error, conserva la pantalla y referencia, revisa la terminal del servidor y no repitas el envío en bucle. Los endpoints aplican límites por minuto.
- Si los recursos externos de imagen no cargan, continúa con el título, las especificaciones y el precio del producto.
- Si la aplicación no responde, usa capturas preparadas de una ejecución anterior solo si las identificas como capturas; no las describas como una transacción recién ejecutada.
- No introduzcas datos personales reales, NIF/CIF real, contraseñas existentes ni tarjeta. No uses herramientas de reset remoto.

## Reset entre ensayos

1. Detén `pnpm dev`.
2. Desde la raíz del proyecto, borra los pedidos, tickets y consultas persistidos en modo de archivos:

   ```powershell
   if (Test-Path .data) { Remove-Item .data -Recurse -Force }
   ```

3. Borra los datos de `localhost:3000` en el navegador o abre un perfil limpio para retirar carrito, favoritos, comparación y claves de reintento.
4. Arranca `pnpm dev` y verifica que el rótulo indica **DEMO LOCAL**.

Para restablecer el Supabase **local** al estado de migraciones y seed (elimina también las cuentas Auth creadas localmente), usa desde la raíz `pnpm dlx supabase@latest db reset --local --yes` y vuelve a crear la cuenta desde `/acceso`. Nunca sustituyas `--local` por una operación vinculada a remoto.
