# Guion de demostración NODRIA

**Duración:** 8–12 minutos · **Actualizado:** 2026-10-13.

NODRIA es una tienda académica de demostración. Los productos, modelos, precios observados, especificaciones y fotografías corresponden a productos reales; cuentas, stock, pedidos, pago, CRM y operaciones son simulados. La pasarela aprueba automáticamente y no solicita tarjeta, cobra ni envía nada. No introduzcas datos personales reales.

## Antes de presentar

1. Inicia el sitio siguiendo [SETUP.md](./SETUP.md) o usa el despliegue de Vercel si ya tiene la migración aplicada.
2. Para compra conectada, usa una cuenta de prueba confirmada y la base Supabase con la migración `20261013120000_nodria_storefront_checkout.sql` aplicada.
3. Verifica que `/catalogo` tenga productos y que `/checkout` indique con claridad que el pago es de demostración y no solicita tarjeta.
4. Los ejemplos de reseñas deben conservar su etiqueta de ejemplo; solo los comentarios publicados después de un pedido entregado cuentan como reseñas de clientes.

## Recorrido

### 0:00–2:00 · Portada y catálogo

1. Muestra la portada y explica que NODRIA mantiene su propio catálogo dentro del sitio.
2. En `/catalogo`, busca por fabricante, modelo o SKU y prueba filtros, ordenación y disponibilidad.
3. Abre una tarjeta y comprueba que la ficha, el precio y la foto pertenecen al mismo modelo. La navegación de compra permanece dentro de NODRIA.

### 2:00–4:00 · Ficha y opiniones

1. Revisa especificaciones, disponibilidad, compatibilidad orientativa y precio.
2. Abre opiniones. Distingue los ejemplos ilustrativos de reseñas publicadas y validadas.
3. Explica que se puede escribir una reseña real solo para una línea de un pedido entregado; la publicación requiere moderación.

### 4:00–6:00 · PC Builder y carrito

1. Abre `/configurador`, selecciona piezas y comprueba compatibilidad por socket, memoria, formato, espacio y potencia cuando esos datos estén publicados.
2. Añade el montaje al carrito desde el configurador.
3. En el carrito, cambia cantidades o elimina una línea y continúa al checkout.

### 6:00–8:00 · Checkout y cuenta

1. Completa el checkout con los datos ficticios de prueba.
2. Confirma el pedido: la pasarela de demostración lo aprueba automáticamente.
3. Muestra número, total y estado confirmado. En Supabase conectado, revisa en la cuenta el pedido asociado. El servidor valida precio/stock, guarda snapshots, pago demo, reserva y eventos.
4. Recuerda que no hay cargo, tarjeta ni envío real.

### 8:00–10:00 · Operaciones internas (opcional)

Con cuentas de rol preparadas, muestra CRM, detalle del pedido, inventario y soporte. Las acciones internas dependen de Auth/RLS y solo deben recorrerse en el proyecto de pruebas con datos ficticios.

## Límites

- NODRIA no es un comercio listo para recibir pagos reales; el pago siempre se aprueba por diseño.
- Cantidades de stock, clientes, pedidos, actividad de backoffice y empresas son de demostración.
- Las fotografías se cargan desde una CDN remota; confirma derechos de uso antes de una explotación comercial.
- La compatibilidad del configurador es parcial y no certifica un equipo montado.
- No uses emails, teléfonos, direcciones ni tarjetas reales durante la presentación.

## Limpiar el modo local

Detén `pnpm dev`, elimina `.data/` local y borra los datos del sitio del navegador para retirar pedidos de prueba, favoritos y comparaciones. No uses `db reset`, `seed.sql` ni scripts de limpieza contra Supabase remoto.
