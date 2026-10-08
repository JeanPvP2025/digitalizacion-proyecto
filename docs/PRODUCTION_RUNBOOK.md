# Salida a producción de la demo NODRIA

## Alcance

NODRIA es un proyecto académico con identidades, catálogo, pedidos y pagos ficticios. El checkout es una simulación; no acepta tarjetas ni procesa dinero. El despliegue de Vercel Production está activo en `https://nodria-staging.vercel.app`, aunque el nombre del proyecto aún dice `staging`.

## Verificaciones ya hechas

- `main` incluye `4ed17f3`; Vercel informó el deployment Production como `success`.
- HTTP 200 en portada, acceso, catálogo, configurador, blog, guías, marcas, categorías, campañas y sitemap.
- TypeScript, ESLint, 288 Vitest + 39 Node, E2E 19/19, build de producción e `git diff --check` pasan.
- Esto no verifica login alojado, correo, RLS remota ni mutaciones de pedido en Supabase remoto.

## 1. Verificar/aplicar datos de catálogo en Supabase

En el proyecto `ypnhdxpejcbcyjiosrhf`, abre **SQL Editor** y ejecuta primero esta consulta de solo lectura:

```sql
select count(*) as productos_catalogo_ampliado,
       count(distinct brand) as marcas_catalogo_ampliado
from public.products
where left(id, 9) = 'pr_depth_';
```

El resultado esperado es **84 productos y 6 marcas**. El sitio ahora solo muestra NODRIA en `/marcas`, así que probablemente falte el dataset.

Si la consulta devuelve 0, abre en GitHub el archivo `supabase/migrations/20261008135808_catalog_depth_dataset.sql` de `main`, copia el archivo completo y ejecútalo en SQL Editor sobre el proyecto correcto. Es una migración de datos ficticios, aditiva e idempotente; no cambia tablas, grants ni RLS. Después repite la consulta y espera `84`/`6`.

No ejecutes `supabase/seed.sql`, `db reset`, ni las migraciones históricas otra vez en el proyecto alojado. Si el conteo ya es 84, no vuelvas a aplicar esta migración. La migración no crea datos comerciales reales ni convierte el pago demo en pago real.

## 2. Completar Auth para la URL desplegada

En Supabase **Authentication → URL Configuration**:

- Site URL: `https://nodria-staging.vercel.app`
- Redirect URL: `https://nodria-staging.vercel.app/auth/callback`
- Añade `http://localhost:3000/auth/callback` solo si vas a probar desde local.

En **Authentication → Emails → SMTP Settings**, configura un proveedor SMTP propio con remitente verificado y credenciales privadas. No pegues la contraseña SMTP en Git, en el navegador ni en una variable `NEXT_PUBLIC_*`. Después prueba una sola vez confirmación y recuperación con una cuenta ficticia.

El proveedor integrado de Supabase limita actualmente el envío de correo a 2 mensajes por hora y es solo para pruebas; al excederlo aparece `email rate limit exceeded`. Supabase documenta la configuración de SMTP y recomienda autenticar el dominio de envío con SPF/DKIM/DMARC. Fuentes: [SMTP personalizado de Supabase](https://supabase.com/docs/guides/auth/auth-smtp), [límites de Auth](https://supabase.com/docs/guides/auth/rate-limits), [URLs de redirección](https://supabase.com/docs/guides/auth/redirect-urls).

## 3. Variables de Vercel

En Production, comprueba que existen y que el último redeploy se hizo después de guardarlas:

| Variable | Valor/uso | Exposición |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL API del proyecto Supabase | Pública por diseño |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key activa del mismo proyecto | Pública por diseño; necesita el prefijo `NEXT_PUBLIC_` |
| `SUPABASE_SECRET_KEY` | Solo si el flujo server-side la necesita para el pago demo | Privada, sin `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | `https://nodria-staging.vercel.app` | Pública |
| `DEMO_MODE` | `false` en Production | No habilitar persistencia de archivos en Vercel |

La advertencia de Vercel sobre el prefijo público en URL/publishable key es esperada: esas dos variables se usan en cliente y no son credenciales privilegiadas. No las renombres a claves secretas. Nunca añadas la Secret/service-role key a variables públicas.

## 4. Prueba manual final

1. Abre `/acceso`, crea o usa una cuenta ficticia y comprueba que el enlace termina en `https://nodria-staging.vercel.app/auth/callback` y luego en la ruta interna solicitada.
2. Cierra sesión, vuelve a entrar y prueba recuperación de contraseña; confirma el correo antes de repetir peticiones para no volver a consumir el límite.
3. Verifica `/marcas` para ver las seis marcas nuevas y `/categorias/ordenadores` para ver el catálogo ampliado.
4. Recorre una compra demo aprobada y una rechazada solo con datos ficticios; confirma que se indica expresamente que no hay cobro real.
5. En Vercel, confirma que Production sigue apuntando a `main` y que el deployment aparece como `Ready`.

Un dominio propio es opcional para esta prueba pública, pero necesario si se desea dejar de presentar el enlace como staging y configurar una identidad/SEO estable.
