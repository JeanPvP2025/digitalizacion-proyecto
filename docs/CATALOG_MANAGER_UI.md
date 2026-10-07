# UI de gestión de catálogo

**Estado:** Integrado en `/backoffice/catalog`; lectura conectada y edición limitada probadas con la migración editorial. E2E autenticado por rol: pasa, incluida la edición y restauración de un producto semilla. Revisión: 2026-10-08.

## Alcance implementado

- `/backoffice/catalog` obtiene identidad con `getServerAuthState`, comprueba el grant persistido en `user_role_grants` y permite solo `catalog_manager` o `super_admin`.
- La lista es un Server Component. Lee `products` con el cliente Supabase ligado a cookies/JWT de sesión; el `SELECT` contiene solo los campos que la vista necesita y RLS controla las filas. No utiliza service role ni datos locales de demo.
- Búsqueda por nombre, marca, SKU, slug e ID; filtro por publicado/borrador, ambos derivados de columnas existentes. La lista tiene un tope explícito de 500 productos.
- El editor limita la forma a `name`, `summary`, `description`, `image_url`, `image_alt` y `badge`. No ofrece controles de publicación, precio, rating, identidad, stock o variantes. Los formularios son nativos y operables con teclado.
- `PATCH /api/backoffice/catalog` resuelve de nuevo usuario y grants, valida un objeto Zod estricto, comprueba origen cuando el navegador lo envía y llama exclusivamente a la RPC de sesión.
- Estados de carga, lista vacía/sin coincidencias, fallo de lectura, guardado, guardado pendiente y rechazo de escritura están contemplados.

## Contrato de dependencia

La llamada conserva exactamente el nombre y argumentos solicitados:

```ts
supabase.rpc("update_catalog_product_editorial", {
  p_product_id: productId,
  p_changes: changes,
});
```

`p_product_id` es `text`; `p_changes` solo puede contener las seis claves editoriales permitidas. No se presupone forma de retorno: la UI necesita que la RPC informe éxito/error de PostgREST, pero ignora el valor retornado. La base de datos debe validar el grant `catalog_manager`/`super_admin`, rechazar claves desconocidas y proteger las columnas fuera de la allowlist. Ante `PGRST202` la API responde 503 con dependencia pendiente. No existe un plan alternativo de DML.

El validador TypeScript limita nombre (2–180), resumen (0–500), descripción (0–10.000), texto alternativo (0–300), distintivo (0–80) e imagen (HTTP(S) o ruta local, hasta 2048); normaliza URL y distintivo vacíos como `null` y rechaza claves adicionales. La migración/RPC debe validar de nuevo en PostgreSQL; estas comprobaciones de servidor no son la frontera final.

## Límites de alcance

- No incluye CRUD de productos, variantes, publicación, precio, stock ni moderación.
- No promete catálogo conectado cuando Supabase no está configurado; el módulo falla cerrado y no sustituye los datos conectados por fixtures locales.

## Verificación del slice

- Tests unitarios de los seis campos, claves protegidas/desconocidas, longitudes y formato de imagen.
- Tests del Route Handler: no autenticado, rol denegado, origen cruzado, validación estricta, llamada RPC exacta y RPC ausente.
- La comprobación conectada usa `pwsh -File tests/e2e/ux-audit/run-roles.ps1`, contra Supabase local efímero. No usar mocks ni DML directo para simular persistencia.
