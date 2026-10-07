# Gestión interna de catálogo: bloqueo y contrato propuesto

**Estado:** bloqueado para implementación de UI conectada. Auditoría del código y migraciones realizada el 2026-10-08. No hay pantalla, endpoint ni mock de gestión de catálogo.

## Contrato existente verificado

- `public.app_role` incluye `catalog_manager`; la identidad autorizada se obtiene de `user_role_grants`, consultados mediante `private.has_any_staff_role`. Los claims de metadata no conceden el rol.
- La migración `20261007073027_nodria_commerce_foundation.sql` aplica policies de lectura interna y policies `FOR ALL` a `categories`, `products`, `product_categories`, `product_variants` y `product_specifications` para `catalog_manager` y `super_admin`.
- La misma migración concede a `authenticated` `INSERT`, `UPDATE` y `DELETE` de tabla completa sobre esas cinco tablas. La matriz runtime `tests/integration/rbac/postgres-role-action-matrix.sql` comprueba que `catalog_manager` puede leer un producto no publicado y publicarlo directamente; también comprueba los grants de escritura de `products`.
- Por tanto, RLS comprueba el rol para las filas, pero no restringe las columnas que el rol puede cambiar. Entre los campos modificables directamente se encuentran `rating_average`, `rating_count`, `published_at`, `created_at` y `updated_at`, además de los campos editoriales. El DML amplio también alcanza precios, atributos y estados de variantes, asociaciones de categoría y especificaciones.
- En el repositorio no existe una ruta de catálogo interno ni un endpoint de API que limite esos cambios. Una allowlist en un nuevo Route Handler no arreglaría el acceso: el usuario autenticado puede saltarse la aplicación y llamar directamente a PostgREST con su JWT y los grants actuales.

## Bloqueo exacto

La UI solicitada exige persistir una edición con una lista permitida de campos y autorización tanto en servidor como en base de datos. El contrato actual habilita autorización por rol/fila, pero no una frontera de escritura por campo. Implementar una UI o API de edición sobre los grants actuales dejaría otras columnas modificables fuera de la validación server-side. No existe un contrato seguro ya instalado para realizar la tarea sin cambiar permisos o migraciones.

## Diseño implementable sujeto a revisión del Tech Lead

Mantener el primer corte en edición de metadatos editoriales de productos existentes; excluir creación/borrado, categorías, variantes, precios, stock y especificaciones.

1. En una migración dedicada, revocar el DML de tabla completa sobre las tablas de catálogo para `authenticated`. Conservar `SELECT` y RLS existentes para la lectura pública y de personal.
2. Añadir una RPC estrecha, por ejemplo `update_catalog_product(p_product_id text, p_changes jsonb)`, con `EXECUTE` solo para `authenticated`. La función debe validar el grant persistido `catalog_manager` o `super_admin`, rechazar claves desconocidas y validar longitudes/tipos/formato en PostgreSQL. Debe actualizar solo `name`, `summary`, `description`, `image_url`, `image_alt` y `badge`; no debe aceptar identidad, rating, timestamps, publicación ni campos de variantes. Si la publicación se incluye más adelante, requiere una transición y auditoría explícitas.
3. Probar en PostgreSQL tanto escritura permitida como denegaciones directas de DML, claves protegidas/desconocidas, ausencia de grant y roles no autorizados. Actualizar `tests/integration/rbac/postgres-role-action-matrix.sql` y el gate Auth/PostgREST para comprobar los ACL y la RPC.
4. Tras aprobar/integrar el contrato, implementar `/backoffice/catalog` como Server Component protegido por sesión Auth y grant comprobado en servidor, más Route Handler autenticado que valide con Zod y llame exclusivamente a la RPC usando el cliente Supabase de sesión. Nunca enviar service-role al navegador ni usarlo para eludir RLS.
5. Añadir búsqueda/filtros por texto/publicación, lista real, estados vacío/error, edición de los seis campos permitidos, errores de validación legibles y confirmación de persistencia. Añadir pruebas allow/deny de ruta y un E2E con Supabase local que edite un campo y vuelva a leer el valor persistido.

La migración y la ampliación/restricción de permisos quedan pendientes de revisión del Tech Lead. Hasta entonces, el rol conserva sus permisos actuales de base de datos, pero no se proporciona una interfaz de gestión.

## Verificación de esta auditoría

Se contrastaron `supabase/migrations/20261007073027_nodria_commerce_foundation.sql`, `tests/integration/rbac/postgres-role-action-matrix.sql`, `docs/RBAC_MATRIX.md`, `docs/DATA_MODEL.md` y las rutas/módulos existentes. No se ejecutaron pruebas de producto porque no se modificó código ni se añadió una feature. `node_modules/next/dist/docs/` no está presente en este checkout; no se escribió código Next.js.
