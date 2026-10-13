# Guion académico de demo NODRIA

**Duración:** 8–12 minutos · **Actualizado:** 2026-10-13 · **Entorno recomendado:** modo local de solo consulta.

NODRIA es una empresa ficticia. El catálogo contiene **modelos, números de fabricante, precios observados, especificaciones y fotos reales** de PcComponentes España. NODRIA no es el vendedor: no tiene estos artículos en stock ni recibe pedidos, pagos, envíos o devoluciones. Los datos de personas, organizaciones, soporte y CRM siguen siendo de demostración; no uses información real.

## Antes de presentar

1. Sigue [Instalación y modos de ejecución](./SETUP.md), apartado “Demo local de archivos”, y abre <http://localhost:3000>.
2. Comprueba que `/checkout` indica que NODRIA no realiza ventas y no presenta un formulario de pago.
3. Mantén conexión a Internet para cargar las fotos primarias del vendedor y abrir sus fichas. Los precios llevan fecha de consulta y pueden haber cambiado.
4. Usa solo nombres, correos y organizaciones `.example`/`.test` si recorres formularios B2B o soporte.

## Recorrido

### 0:00–2:00 · Portada y catálogo

1. En la portada, explica que los productos destacados son referencias comerciales verificables.
2. Abre `/catalogo`, busca por marca o número de modelo y comprueba que cada tarjeta muestra su precio de referencia, fecha, disponibilidad no verificada y enlace al vendedor.
3. Señala que las fotos corresponden al modelo enlazado y que cada ficha tiene una imagen propia.

### 2:00–5:00 · Ficha de producto

1. Abre una ficha desde la tarjeta.
2. Revisa el número de modelo, foto, especificaciones, precio y fecha.
3. Usa **Ver precio y disponibilidad actuales en PcComponentes** para abrir la fuente original. La compra, si se desea, sucede directamente con ese vendedor.
4. Muestra que no se importan reseñas externas y que NODRIA no afirma tener stock.

### 5:00–8:00 · PC Builder

1. Abre `/configurador` y muestra las ocho clases de componentes, con ocho referencias reales por clase.
2. Compara piezas y observa el precio de referencia agregado.
3. Explica que la revisión de compatibilidad se limita a los datos estructurados disponibles; no certifica el montaje completo.
4. Abre la ficha del vendedor de una pieza seleccionada. No envíes la selección a carrito ni a checkout de NODRIA.

### 8:00–10:00 · Alcance académico

Si interesa la parte de negocio, abre una consulta B2B o el formulario de soporte usando datos de prueba. La empresa, los clientes, los pedidos, las organizaciones y las operaciones de backoffice son escenarios académicos; no describen una tienda real.

## Límites que deben explicarse

- Los precios son una captura fechada del vendedor, no un precio vigente garantizado.
- NODRIA no tiene relación comercial con PcComponentes y no confirma disponibilidad ni condiciones.
- Las imágenes se cargan desde el CDN público del vendedor; el sitio no afirma ser titular de esas fotos.
- No se procesa dinero ni se solicitan números de tarjeta.
- La compatibilidad del PC Builder es parcial y no reemplaza las fichas de fabricante ni una comprobación física.
- Formularios, empresas y usuarios de soporte/CRM usan datos de demostración; no incluyas información personal real.

## Restablecer el entorno local

Para limpiar tickets y consultas locales, detén `pnpm dev` y elimina el directorio `.data/` local. Borra también los datos del sitio del navegador para retirar favoritos y comparaciones. No uses `db reset`, `seed.sql` ni operaciones de limpieza contra Supabase remoto.
