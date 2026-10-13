# Runbook de la tienda de demostración NODRIA

## Alcance

NODRIA es una tienda académica ficticia con catálogo, carrito y pedidos internos. Los precios/modelos/fotos corresponden a productos reales; stock, cuentas, pedidos y reseñas son datos de demostración. El checkout aprueba automáticamente una pasarela ficticia, sin cargos, tarjetas ni envíos. Vercel Production usa `https://nodria-academico.vercel.app`.

## Estado de esta actualización — 2026-10-13

- El operador confirmó el 2026-10-13 que `20261013120000_nodria_storefront_checkout.sql` terminó en Supabase con `Success. No rows returned`.
- Los commits `4e30e52` y `3cbc5f5` se publicaron en `origin/main`; inicio, catálogo, configurador, checkout y una ficha de producto respondieron HTTP 200 en `https://nodria-academico.vercel.app`. La comprobación encontró cero enlaces externos de compra y el copy actual de NODRIA.
- Esta sesión no pudo leer Supabase por falta de permiso en el conector. Deben comprobarse los conteos, funciones/grants y disponibilidad con las consultas de abajo, y falta una compra autenticada de extremo a extremo. Un HTTP 200 solo confirma que la ruta responde.

## 1. Verificar el catálogo y el stock de demostración

La persona propietaria ya informó que ejecutó la migración completa [`supabase/migrations/20261013120000_nodria_storefront_checkout.sql`](../supabase/migrations/20261013120000_nodria_storefront_checkout.sql) en Supabase SQL Editor. Si esa confirmación corresponde al proyecto `ypnhdxpejcbcyjiosrhf`, no la repitas: ejecuta las consultas de comprobación siguientes. La migración agrega funciones públicas de lectura agregada, crea/activa el almacén NODRIA-DEMO, asigna stock ficticio y marca las variantes de tienda.

La migración usa una transacción y es idempotente respecto a las variantes marcadas. No ejecuta `db reset` ni `seed.sql`, no borra pedidos y no requiere que exista `supabase_migrations.schema_migrations` en el SQL Editor. Ejecuta primero una copia de seguridad normal del proyecto antes de hacer cualquier cambio de base de datos.

Comprueba la preparación del catálogo y disponibilidad:

```sql
select count(distinct p.id) as productos_publicados,
       count(distinct p.image_url) as fotos_unicas,
       count(*) filter (where v.attributes #>> '{nodria_store,mode}' = 'academic_demo') as variantes_nodria
from public.products p
join public.product_variants v on v.product_id = p.id and v.is_active
where p.is_published;

select count(*) as variantes_con_stock,
       min(disponible) as stock_minimo,
       max(disponible) as stock_maximo
from (
  select i.variant_id, sum(i.on_hand - i.reserved)::int as disponible
  from public.inventory i
  join public.warehouses w on w.id = i.warehouse_id and w.is_active and w.code = 'NODRIA-DEMO'
  join public.product_variants v on v.id = i.variant_id and v.is_active
  where v.attributes #>> '{nodria_store,mode}' = 'academic_demo'
  group by i.variant_id
) stock;

select has_function_privilege('anon', 'public.get_public_catalog_availability()', 'EXECUTE') as stock_publico,
       has_function_privilege('anon', 'public.get_public_product_review_summary()', 'EXECUTE') as resumen_resenas_publico;
```

El primer resultado debería mostrar 64 productos, 64 fotos únicas y 64 variantes marcadas para la tienda; el segundo debe mostrar stock positivo en las variantes habilitadas. La tercera consulta debe devolver `true` en las dos columnas. No ejecutes `supabase/seed.sql`, `db reset` ni migraciones sintéticas históricas en el proyecto alojado.

## 2. Auth sin correo de confirmación

En Supabase **Authentication → URL Configuration**:

- Site URL: `https://nodria-academico.vercel.app`
- Conserva `https://nodria-academico.vercel.app/auth/callback` en Redirect URLs para compatibilidad con enlaces antiguos.
- Añade `http://localhost:3000/auth/callback` solo si vas a probar desde local.

En **Authentication → Providers (Sign In / Providers) → Email**, deja habilitado el registro de usuarios y desactiva **Confirm Email**. No configures SMTP para el flujo actual: el usuario pidió que no se envíen confirmaciones ni recuperaciones. Al registrarse, la app debe recibir una sesión e iniciar sesión de inmediato; si Supabase devuelve `session: null`, revisa ese ajuste antes de repetir el registro.

La dirección del usuario no queda verificada. La UI no ofrece reenvío ni recuperación por correo; una contraseña olvidada requiere intervención administrativa. No invites personas al equipo del proyecto Supabase para sortear el envío restringido. Referencia: [configuración de Auth](https://supabase.com/docs/guides/auth/general-configuration).

## 3. Variables de Vercel

En Production, comprueba que existen y que el último redeploy se hizo después de guardarlas:

| Variable | Valor/uso | Exposición |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL API del proyecto Supabase | Pública por diseño |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key activa del mismo proyecto | Pública por diseño; necesita el prefijo `NEXT_PUBLIC_` |
| `SUPABASE_SECRET_KEY` | Solo si el flujo server-side la necesita para el pago demo | Privada, sin `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | `https://nodria-academico.vercel.app` | Pública |
| `DEMO_MODE` | `false` en Production | No habilitar persistencia de archivos en Vercel |

La advertencia de Vercel sobre el prefijo público en URL/publishable key es esperada: esas dos variables se usan en cliente y no son credenciales privilegiadas. No las renombres a claves secretas. Nunca añadas la Secret/service-role key a variables públicas.

## 4. Prueba manual final

1. Abre `/acceso`, crea una cuenta ficticia y comprueba que inicia sesión y redirige al destino sin enviar correo.
2. Cierra sesión e inicia sesión con la misma cuenta. La recuperación de contraseña por email no está disponible.
3. Verifica `/configurador` y confirma que cada clase ofrece ocho opciones; `/marcas` y `/categorias/componentes` deben mostrar el catálogo ampliado.
4. En `/catalogo`, añade un modelo al carrito; en `/checkout`, usa los datos ficticios ya precargados y confirma el pedido. Debe aparecer una referencia interna y el pago aprobado por la pasarela ficticia.
5. Comprueba que no aparecen campos de tarjeta. No uses datos personales reales: no se cobra ni se envía nada. El pedido y el stock son datos de demostración.
6. En `/producto/<slug>/opiniones`, comprueba que las reseñas de muestra se identifican como ejemplos y que no alteran la valoración ni el contador real.
7. En Vercel, confirma que Production sigue apuntando a `main` y que el deployment aparece como `Ready`.

El dominio Vercel final ya está configurado; no añadas el dominio antiguo como canónico. El proyecto solo puede marcarse como release remoto certificado después de verificar los conteos, el alta Auth sin correo y un recorrido autenticado real con una cuenta ficticia, además de los controles RLS pendientes.
