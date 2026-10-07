# Contrato de solicitudes B2B

## Escritura pública

`POST /api/quotes` valida en servidor el formulario y escribe en `public.quote_inquiries` cuando están configurados `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. La ruta crea un cliente Supabase sin cookies ni sesión y usa únicamente la clave publicable. El `INSERT` envía estas columnas, que coinciden con el grant de `anon` de la migración:

| Formulario | `quote_inquiries` |
|---|---|
| `contactName` | `contact_name` |
| `email` | `email` (normalizado a minúsculas) |
| `phone` | `phone` (cadena vacía convertida en `null`) |
| `companyName` | `company` |
| `volume` + `message` | `message` |
| `privacyAccepted: true` | `consent_to_contact: true` |

`volume` no existe como columna en la migración. Para que CRM conserve ese dato, `message` comienza con `Volumen aproximado: {opción}` y una línea en blanco antes del texto escrito por la empresa. CRM debe mostrar y conservar el mensaje completo; no debe tratar el prefijo como una columna ni asumir que todas las solicitudes antiguas lo incluyen.

La base genera `id`, `created_at`, `updated_at`, `status` (`new`), `source` (`website`) y `created_by` (nulo para el rol anónimo). La policy exige consentimiento y estado `new`. La ruta no solicita la fila de vuelta: el rol anónimo carece de `SELECT`. La respuesta `{ persisted: true, persistence: "supabase" }` se envía solo tras el `INSERT` confirmado por PostgREST; no contiene un identificador CRM que la ruta no puede leer.

CRM lee y gestiona la bandeja como personal autenticado con los roles permitidos por RLS (`sales_manager` o `super_admin`). La ruta pública no concede lectura, actualización, borrado ni `SELECT` sobre `quote_inquiries`.

## Modo local

La ruta comparte la política server-side de persistencia con checkout y soporte: usa Supabase si están presentes ambas credenciales publicables; usa `.data/quotes.json` únicamente cuando `NODE_ENV=development`, no hay credenciales Supabase y `DEMO_MODE=true`; cualquier otro caso sin fuente disponible responde `503`. Las credenciales parciales nunca activan el fallback. La respuesta local usa `persistence: "local-demo"`, una referencia con prefijo `DEMO-QIN-` y solo confirma persistencia tras completar la escritura del archivo.

## Validación y abuso

El endpoint limita el cuerpo a 16 KiB, valida tipos, longitudes, opciones del formulario y consentimiento con Zod, rechaza campos extra y conserva el honeypot `website`. Aplica cuatro intentos por minuto y por IP antes de procesar el cuerpo. El limitador existente guarda contadores en memoria del proceso; en despliegues con varias instancias es solo un control de mejor esfuerzo, no una cuota global.

El endpoint conserva el contrato del honeypot `website`, aunque el formulario público actual no renderiza ese campo.

## Cotización estructurada del portal

`POST /api/quotes` sigue siendo la entrada pública de consultas de proyecto y continúa creando `quote_inquiries`. El portal autenticado de empresa crea una cotización con líneas de catálogo mediante `public.create_business_quote`; este flujo no confía en precios, identidad, organización, impuestos ni moneda enviados por el navegador. PostgreSQL comprueba membresía y rol, vuelve a consultar cada variante activa y publicada, y conserva snapshots en `quotes` y `quote_items`. El flujo completo de membresías, estados, permisos, importes y actividad se documenta en [`lib/crm/CONTRACT.md`](../crm/CONTRACT.md).
