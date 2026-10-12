# Salida a producción de la demo NODRIA

## Alcance

NODRIA es un proyecto académico con identidades, catálogo, pedidos y pagos ficticios. El checkout es una simulación; no acepta tarjetas ni procesa dinero. El proyecto de Vercel se llama `nodria` y Production usa `https://nodria-academico.vercel.app`. El dominio antiguo `https://nodria-staging.vercel.app` redirige permanentemente (`308`) al nuevo conservando path y query.

## Verificaciones ya hechas

- Proyecto Vercel `nodria`; el dominio final responde HTTP 200 en portada, acceso, configurador y backoffice CRM. El alias antiguo responde `308` a la URL equivalente en el dominio final.
- El commit `4905c47` está `Ready` en Production. `robots.txt` y el sitemap responden 200 y contienen solo URLs de `nodria-academico.vercel.app` (74 entradas).
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

El mínimo esperado son **8 opciones** para cada una de las ocho clases (`case`, `cooler`, `cpu`, `gpu`, `memory`, `motherboard`, `psu`, `storage`). El SQL Editor del operador devolvió 8–9 por clase. No borres opciones adicionales. Vuelve a cargar `/marcas`, `/categorias` y `/configurador` en el dominio final y comprueba el catálogo publicado.

No ejecutes `supabase/seed.sql`, `db reset`, ni las migraciones históricas otra vez en el proyecto alojado. La migración no crea datos comerciales reales ni convierte el pago demo en pago real.

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
3. Verifica `/configurador` y confirma que cada clase ofrece al menos ocho opciones; `/marcas` y `/categorias/ordenadores` deben mostrar el catálogo ampliado.
4. Recorre una compra demo aprobada y una rechazada solo con datos ficticios; confirma que se indica expresamente que no hay cobro real.
5. En Vercel, confirma que Production sigue apuntando a `main` y que el deployment aparece como `Ready`.

El dominio Vercel final ya está configurado; no añadas el dominio antiguo como canónico. El proyecto solo puede marcarse como release remoto certificado después de verificar los conteos, el alta Auth sin correo y un recorrido autenticado real con una cuenta ficticia, además de los controles RLS pendientes.
