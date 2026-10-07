# Instalación y modos de ejecución

Guía contrastada con el repositorio al **2026-10-07**. NODRIA es una aplicación académica ficticia; no conectes datos personales ni medios de pago reales.

## Requisitos

- Node.js compatible con Next.js 16. El repositorio se verificó con Node `v24.14.0`.
- Corepack y pnpm `10.32.1` (declarado en `package.json`).
- Docker Desktop solo para ejecutar Supabase local.

## Opción A: demo local de archivos

Es la opción prevista para presentar catálogo, checkout simulado, solicitud B2B pública y soporte público. No necesita Docker, proyecto Supabase ni cuenta de usuario.

Desde la raíz del repositorio, en PowerShell:

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

Abre `.env.local` y confirma que ambas variables Supabase están vacías y `DEMO_MODE=true`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DEMO_MODE=true
```

Arranca la aplicación:

```powershell
pnpm dev
```

Visita <http://localhost:3000>. Confirma que el checkout muestra **FINALIZAR PEDIDO · DEMO LOCAL** antes de introducir los datos ficticios del guion de [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).

En este modo, los pedidos y formularios enviados se guardan en archivos ignorados de Git bajo `.data/`. El carrito, favoritos y comparación viven en el almacenamiento del navegador. No se crea sesión Auth. No conectes simultáneamente estas variables a un proyecto remoto: las dos credenciales públicas Supabase, si están presentes, cambian el modo de datos y no se activa un fallback a archivos ante errores conectados.

## Opción B: Supabase local con Auth

Usa esta opción para el catálogo persistido en PostgreSQL, las mutaciones autenticadas, el portal empresarial y el checkout conectado. Requiere Docker Desktop en ejecución y más recursos que la demo de archivos. La configuración de este repositorio usa puertos alternativos; utiliza las direcciones impresas por el CLI.

Desde la raíz del repositorio:

```powershell
pnpm dlx supabase@latest start
pnpm dlx supabase@latest status
```

`start` aplica las migraciones y el seed configurado. Copia del resultado local la URL API, la clave **publishable** y la clave **secret**. Crea `.env.local` a partir de `.env.example` y configúralo así, reemplazando los marcadores por los valores que imprimió el CLI:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56201
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key-local>
SUPABASE_SECRET_KEY=<secret-key-local>
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
DEMO_MODE=false
```

La URL del ejemplo coincide con `api.port` en `supabase/config.toml`; si el CLI informa otra URL, prevalece su salida. `SUPABASE_SECRET_KEY` es solo para el servidor y permite resolver el resultado de pago demo mediante la RPC restringida. No la renombres a `NEXT_PUBLIC_*`, no la pegues en el navegador y no la guardes en Git. La aplicación también admite `SUPABASE_SERVICE_ROLE_KEY` como nombre legado server-only.

Referencias oficiales para instalar/arrancar el stack y distinguir claves publicables de secretas: [desarrollo local con Supabase](https://supabase.com/docs/guides/local-development) y [claves API](https://supabase.com/docs/guides/getting-started/api-keys). El CLI actual muestra la clave publishable y la secret al iniciar el stack local.

Arranca Next.js en otra terminal:

```powershell
pnpm dev
```

Para crear una cuenta local, abre <http://127.0.0.1:3000/acceso>, selecciona crear cuenta e introduce un correo `.example` y una contraseña ficticios de al menos ocho caracteres. Auth local tiene la confirmación de correo desactivada en `supabase/config.toml`; el correo no debe ser real. El seed crea catálogo e inventario ficticios, además de ejemplos de entrada comercial, pero no crea usuarios Auth ni membresías de empresa. Para explorar el presupuesto estructurado, inicia sesión, abre `/empresas/portal`, crea una organización ficticia y solicita una cotización desde esa organización.

Para dejar listo ese presupuesto antes de presentar, abre el portal con esa cuenta y crea `Estudio Prisma Demo` (razón social ficticia `Estudio Prisma Demo SL`, sin NIF/CIF, correo de facturación `compras@estudioprisma.example`). El formulario del portal crea la membresía `owner` junto a la organización. No hay contraseña ni usuario de demostración precreados; guarda la contraseña inventada solo en tu entorno local y no la reutilices.

Esta opción sigue siendo una instalación local de desarrollo. Las pruebas de base y de rutas no son un E2E de navegador conectado ni certifican un despliegue remoto.

## Reiniciar la demo

### Borrar pedidos y formularios del modo de archivos

Detén `pnpm dev` con `Ctrl+C`. Desde la raíz del repositorio, elimina los registros locales ficticios:

```powershell
if (Test-Path .data) { Remove-Item .data -Recurse -Force }
```

Luego, en el navegador, borra los datos del sitio de `localhost:3000` o usa una ventana privada nueva. Esto limpia carrito, favoritos, comparación y la clave de idempotencia guardados en el navegador. Vuelve a ejecutar `pnpm dev`.

### Restaurar Supabase local al seed

Este comando destruye y recrea **la base Supabase local de este proyecto**, incluidos los usuarios Auth creados localmente, y vuelve a aplicar migraciones y seed:

```powershell
pnpm dlx supabase@latest db reset --local --yes
```

No uses `--linked` ni `db push` para restablecer la demo; no ejecutes el reset contra un proyecto remoto. Tras el reset, vuelve a crear la cuenta Auth local desde `/acceso` y limpia el almacenamiento del navegador si necesitas una sesión o carrito nuevos.

## Comprobaciones y comandos útiles

```powershell
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm test:e2e
pnpm build
```

La suite Playwright levanta Next.js en `127.0.0.1:4317` con `DEMO_MODE=true`, credenciales Supabase vacías y resultados de navegador bajo `.data/playwright-results`. Sus ocho casos actuales comprueban catálogo, estados vacíos y campos requeridos; no recorren checkout enviado, Supabase Auth, presupuestos conectados ni tickets conectados.

## Solución de problemas

| Síntoma | Comprobación segura |
|---|---|
| Checkout dice que requiere credenciales Supabase o devuelve `503` | Para el recorrido de archivos, confirma `NODE_ENV=development`, `DEMO_MODE=true` y que las dos variables Supabase están vacías. Si quieres Supabase local, configura las dos claves públicas desde el CLI. No dejes solo una: credenciales incompletas deshabilitan el modo de archivos. |
| `/acceso` no puede iniciar sesión o el portal pide acceso | Auth no existe en Demo Mode. En modo conectado, confirma que Docker y Supabase local siguen activos, que `.env.local` apunta a las claves del proyecto local y que la cuenta se registró después del último reset. |
| Checkout conectado crea el pedido pero no confirma el resultado simulado | Confirma que `.env.local` contiene `SUPABASE_SECRET_KEY` local, sin prefijo `NEXT_PUBLIC_`, y reinicia `pnpm dev` tras editar variables. No sustituyas la clave por una de producción. |
| Catálogo conectado aparece vacío o falla | Consulta la terminal de Supabase y la de Next.js. No se usa el catálogo de fixtures como fallback en modo conectado. En Supabase local, aplica `pnpm dlx supabase@latest db reset --local --yes` y revisa que las migraciones/seed terminen correctamente. |
| Playwright dice que `127.0.0.1:4317` está en uso | Cierra únicamente el servidor Next.js o Playwright que tú hayas iniciado en ese puerto y repite el comando. No termines procesos que no reconozcas. |
| No cargan imágenes remotas | Puede faltar acceso a Internet para las imágenes de muestra. Continúa con nombres y precios; no afecta a los formularios ni a los datos de la demo. |
| La confirmación de un formulario no aparece | Revisa el error mostrado y la terminal de `pnpm dev`. No repitas envíos en bucle: los endpoints aplican límites por minuto. Comprueba el modo activo y, si es una demo de archivos, revisa que `.data` pueda escribirse. |

Para el alcance funcional, las limitaciones y el recorrido cronometrado, consulta [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md), [`STATUS.md`](./STATUS.md), [`SECURITY.md`](./SECURITY.md) y [`TESTING.md`](./TESTING.md).
