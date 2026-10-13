# Salida a producción de la demo NODRIA

## Alcance

NODRIA es una empresa académica ficticia. El catálogo está preparado para mostrar referencias reales de PcComponentes con modelo, precio fechado y foto original, pero NODRIA no vende esos artículos ni cobra/envía pedidos. El proyecto de Vercel se llama `nodria` y Production usa `https://nodria-academico.vercel.app`; el host antiguo redirige con `308`.

## Estado de esta actualización — 2026-10-13

- Verificación local 2026-10-13: instalación congelada, TypeScript, ESLint, `pnpm test` (289 Vitest + 26 Node), E2E (17/17), build y `git diff --check` pasan; las 64 URL de imagen responden `200 image/jpeg`. No se aplicó la migración al Supabase remoto ni se publicó este árbol.
- Los cambios de código no se han desplegado y la migración nueva no se ha aplicado a Supabase remoto.
- Esta sesión no tuvo permisos de lectura ni escritura del proyecto Supabase. No se debe interpretar este documento como certificación de Auth/RLS o datos alojados.

## 1. Aplicar las referencias reales en Supabase

La migración de esta versión es `supabase/migrations/20261013070617_verified_product_reference_catalog.sql`. Requiere que ya estén aplicadas las migraciones previas que crean categorías como `procesadores`, `placas-base`, `memoria-ram`, `cajas`, `fuentes-alimentacion`, `tarjetas-graficas`, `refrigeracion` y `ssd-internos`.

En el proyecto Supabase `ypnhdxpejcbcyjiosrhf`, abre **SQL Editor**, pega el contenido completo de ese archivo del repositorio y ejecútalo una vez. No necesitas consultar `supabase_migrations.schema_migrations`; si esa relación no existe en el SQL Editor, no es el historial que debes usar.

La migración revisa el conjunto antes de modificarlo, publica 64 referencias con 8 productos por clase, desactiva las fichas sintéticas previas y retira su stock libre conservando las reservas. Conserva pedidos e historial, no elimina tablas ni pedidos y no cambia RLS o grants. Si muestra un error, detente y comparte el texto exacto; no vuelvas a ejecutar migraciones antiguas ni `seed.sql`.

Tras `Success`, ejecuta estas consultas de solo lectura:

```sql
select count(distinct p.id) as modelos_publicados,
       count(distinct p.image_url) as fotos_unicas
from public.products p
join public.product_variants v on v.product_id = p.id
where p.is_published
  and v.is_active
  and v.attributes #>> '{reference_price,source}' = 'PcComponentes';
```

El resultado esperado para ambas columnas es **64**. Después verifica 8 opciones reales por clase:

```sql
select v.attributes->'pc_builder'->>'category' as clase,
       count(distinct p.id) as opciones
from public.product_variants v
join public.products p on p.id = v.product_id
where p.is_published
  and v.is_active
  and v.currency = 'EUR'
  and v.attributes #>> '{reference_price,source}' = 'PcComponentes'
group by 1
order by 1;
```

Cada una de las ocho clases (`case`, `cooler`, `cpu`, `gpu`, `memory`, `motherboard`, `psu`, `storage`) debe dar **8**. No borres registros adicionales.

No ejecutes `supabase/seed.sql`, `db reset`, ni las migraciones sintéticas históricas otra vez en el proyecto alojado.

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
4. Abre `/checkout` y confirma que en modo demo no aparecen campos de pago ni botones para crear una compra NODRIA.
5. En Vercel, confirma que Production sigue apuntando a `main` y que el deployment aparece como `Ready`.

El dominio Vercel final ya está configurado; no añadas el dominio antiguo como canónico. El proyecto solo puede marcarse como release remoto certificado después de verificar los conteos, el alta Auth sin correo y un recorrido autenticado real con una cuenta ficticia, además de los controles RLS pendientes.
