# Salida a producción de la demo NODRIA

## Alcance

NODRIA es un proyecto académico con identidades, catálogo, pedidos y pagos ficticios. El checkout es una simulación; no acepta tarjetas ni procesa dinero. El proyecto de Vercel se llama `nodria` y Production usa `https://nodria-academico.vercel.app`. El dominio antiguo `https://nodria-staging.vercel.app` redirige permanentemente (`308`) al nuevo conservando path y query.

## Verificaciones ya hechas

- Proyecto Vercel `nodria`; el dominio final responde HTTP 200 en portada, acceso, configurador y backoffice CRM. El alias antiguo responde `308` a la URL equivalente en el dominio final.
- TypeScript, ESLint, 288 Vitest + 39 Node, Playwright demo/UX 19/19, build de producción y `git diff --check` pasan.
- Supabase local: reset/migraciones/seed, 183 pgTAP, DB lint y 78 probes HTTP Auth/RLS pasan. Suites aisladas: checkout 4/4, dominios 6/6, B2B 1/1, customer/B2B 1/1 y roles 1/1.
- El CLI de Supabase de esta sesión lista una organización distinta y no tiene acceso al proyecto `ypnhdxpejcbcyjiosrhf`. No se consideran certificados el catálogo, Auth/SMTP, RLS ni escrituras alojadas solo porque las rutas respondan 200.

## 1. Verificar/aplicar datos de catálogo en Supabase

La comprobación del sitio publicado el 2026-10-12 encontró 3 marcas y 44 fichas visibles; el PC Builder muestra 4–5 opciones por clase en vez de 8. Esto prueba que el catálogo desplegado no cumple el dataset esperado. No deduzcas por ello qué migración falta: ejecuta primero la consulta siguiente y revisa el historial de migraciones.

En el proyecto `ypnhdxpejcbcyjiosrhf`, abre **SQL Editor** y ejecuta primero esta consulta de solo lectura:

```sql
select count(*) as productos_catalogo_ampliado,
       count(distinct brand) as marcas_catalogo_ampliado
from public.products
where left(id, 9) = 'pr_depth_';
```

La migración inicial agrega 84 productos; la expansión agrega 32 piezas PC. El resultado final esperado en `pr_depth_` es **116 productos y 6 marcas** (más los 12 productos del seed base).

Aplica solo lo que falte, después de comparar con `supabase_migrations.schema_migrations` en el proyecto correcto:

- Si devuelve **0**, ejecuta primero `supabase/migrations/20261008135808_catalog_depth_dataset.sql` y después la migración PC Builder indicada abajo.
- Si devuelve **32**, es probable que solo esté la expansión PC. Ejecuta la migración base `20261008135808_catalog_depth_dataset.sql`, comprueba el resultado y aplica la expansión únicamente si aún no está registrada.
- Si devuelve **84**, la migración inicial ya está; ejecuta únicamente `supabase/migrations/20261009113024_pc_builder_catalog_expansion.sql`.
- Si devuelve **116**, no repitas ninguna de esas dos migraciones.
- Para cualquier otro conteo, detente y revisa filas parciales/colisiones con el historial antes de hacer cambios.

La migración base añade 84 fichas sintéticas y la expansión PC añade otras 32 con inventario inicial demo; no cambian tablas, grants ni RLS. La secuencia prevista es base y luego expansión. En GitHub abre el SQL correspondiente de `main`, cópialo y ejecútalo solo en el SQL Editor del proyecto `ypnhdxpejcbcyjiosrhf`, una migración por vez. No ejecutes una migración si el historial ya la marca aplicada.

Después verifica que haya ocho variantes válidas por clase:

```sql
select v.attributes->'pc_builder'->>'category' as clase,
       count(*) as opciones
from public.product_variants v
join public.products p on p.id = v.product_id
where p.is_published
  and v.is_active
  and v.currency = 'EUR'
  and v.attributes ? 'pc_builder'
group by 1
order by 1;
```

El resultado esperado son **8 opciones** para cada una de las ocho clases (`case`, `cooler`, `cpu`, `gpu`, `memory`, `motherboard`, `psu`, `storage`). Vuelve a cargar `/marcas`, `/categorias` y `/configurador` en el dominio final y comprueba que las ocho clases muestren ocho opciones.

No ejecutes `supabase/seed.sql`, `db reset`, ni las migraciones históricas otra vez en el proyecto alojado. La migración no crea datos comerciales reales ni convierte el pago demo en pago real.

## 2. Completar Auth para la URL desplegada

En Supabase **Authentication → URL Configuration**:

- Site URL: `https://nodria-academico.vercel.app`
- Redirect URL: `https://nodria-academico.vercel.app/auth/callback`
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
| `NEXT_PUBLIC_SITE_URL` | `https://nodria-academico.vercel.app` | Pública |
| `DEMO_MODE` | `false` en Production | No habilitar persistencia de archivos en Vercel |

La advertencia de Vercel sobre el prefijo público en URL/publishable key es esperada: esas dos variables se usan en cliente y no son credenciales privilegiadas. No las renombres a claves secretas. Nunca añadas la Secret/service-role key a variables públicas.

## 4. Prueba manual final

1. Abre `/acceso`, crea o usa una cuenta ficticia y comprueba que el enlace termina en `https://nodria-academico.vercel.app/auth/callback` y luego en la ruta interna solicitada.
2. Cierra sesión, vuelve a entrar y prueba recuperación de contraseña; confirma el correo antes de repetir peticiones para no volver a consumir el límite.
3. Verifica `/configurador` y confirma que cada paso ofrece ocho opciones; `/marcas` y `/categorias/ordenadores` deben mostrar el catálogo ampliado.
4. Recorre una compra demo aprobada y una rechazada solo con datos ficticios; confirma que se indica expresamente que no hay cobro real.
5. En Vercel, confirma que Production sigue apuntando a `main` y que el deployment aparece como `Ready`.

El dominio Vercel final ya está configurado; no añadas el dominio antiguo como canónico. El proyecto solo puede marcarse como release remoto certificado después de verificar las migraciones/conteos, Auth por email y un recorrido autenticado real con una cuenta ficticia.
