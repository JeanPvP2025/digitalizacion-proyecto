# Contrato de escritura editorial del catálogo

**Estado:** implementado y verificado en Supabase local el 2026-10-08. Este contrato habilita edición de productos existentes; no implementa una interfaz de gestión.

## Frontera de escritura

La migración `20261007221456_catalog_editorial_write_contract.sql` conserva los permisos SELECT y las policies RLS existentes. Revoca INSERT, UPDATE y DELETE directos de `authenticated` en `categories`, `products`, `product_categories`, `product_variants` y `product_specifications`.

La única operación expuesta para editar productos es `public.update_catalog_product_editorial(text, jsonb)`. Requiere una sesión con `auth.uid()` y un grant persistido `catalog_manager` o `super_admin` en `public.user_role_grants`; no lee metadata del usuario ni claims de rol para autorizar.

La allowlist es `name`, `summary`, `description`, `image_url`, `image_alt` y `badge`. Rechaza objetos vacíos, claves protegidas/desconocidas y tipos o longitudes inválidos. `image_url` acepta `null` o URL absoluta HTTP(S). El update bloquea la fila y escribe solo los campos enviados; repetir el mismo patch es seguro y no vuelve a tocar `updated_at`.

## Seguridad de funciones

La función expuesta es `SECURITY INVOKER` y solo `authenticated` tiene EXECUTE. Su ACL revoca `PUBLIC`, `anon` y `service_role`. El wrapper delega a `private.update_catalog_product_editorial_impl`, que está en un esquema no expuesto y ejecuta con `SECURITY DEFINER` para poder actualizar `products` después de retirar los grants directos. La implementación fija `search_path = ''`, califica objetos y valida identidad/grant antes del acceso a datos; su EXECUTE también está limitado a `authenticated`.

La función privada no es un endpoint PostgREST. El wrapper público no tiene privilegios de definición elevados, no admite SQL dinámico y transmite solamente los parámetros validados a la implementación. No se aceptan campos de publicación, ratings, SKU, slug, marca, timestamps, variantes, stock, categorías ni especificaciones.

## Cobertura y verificación

- `tests/database/catalog_editorial_write_contract.sql`: ACL de tabla/columna, lectura conservada, grants de funciones, campo permitido, repetición, persistencia, campos protegidos, customer con metadata mutable, grant de `super_admin`, claves/tipos/longitudes inválidos y producto inexistente.
- `tests/integration/rbac/postgres-role-action-matrix.sql`: runtime por roles PostgreSQL y grants persistidos; prueba RPC allow/deny, DML directo y lectura interna de producto no publicado.
- Reset local reproducible: `pnpm dlx supabase@latest db reset --local --yes`.
- pgTAP local: `pnpm dlx supabase@latest test db --local tests/database`.
- La matriz runtime se ejecuta contra el contenedor local `supabase_db_nodria-commerce` con `psql`; todas las escrituras de fixture se revierten.

## Límites

Este contrato no concede creación/borrado de productos ni cambios a categorías, asociaciones, variantes o especificaciones. Publicación y despublicación quedan fuera hasta definir una transición y auditoría explícitas. No hay proyecto remoto configurado; el reset y las pruebas locales no certifican despliegue de producción. La capa de aplicación puede añadir validaciones y una UI protegida, pero no sustituye la autorización de esta RPC.
