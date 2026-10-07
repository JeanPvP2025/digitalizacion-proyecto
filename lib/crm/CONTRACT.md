# Contrato CRM y portal B2B

## Alta y membresías

El portal autenticado vive en `/empresas/portal`. Una sesión sin organización puede crear una mediante el RPC existente `create_organization`; PostgreSQL crea la organización y asigna al creador como único propietario inicial. Las acciones de servidor validan tipos y longitudes antes de invocar RPCs.

`add_organization_member`, `set_organization_member_role`, `remove_organization_member` y `list_organization_members` comprueban la organización y el rol en la base de datos. Solo owner/admin gestionan miembros. Admin gestiona buyers/viewers; solo owner puede conceder admin. El owner no puede ser sustituido, eliminado ni asignado por estas acciones. La invitación del portal solo encuentra cuentas que ya existen en Auth; no crea ni envía invitaciones. La lectura del directorio requiere ser miembro de la organización.

## Cotización estructurada

El comprador selecciona variantes publicadas y activas en el catálogo. El navegador envía únicamente `variant_id` y cantidad a `create_business_quote`; la base vuelve a consultar el catálogo y guarda en `quote_items` el producto, SKU, variante, atributos, precio de referencia, IVA y moneda como snapshot. Cambios posteriores del catálogo no alteran la propuesta. Se rechazan variantes repetidas, cantidades inválidas y monedas mezcladas.

Los precios de catálogo y oferta se interpretan como importes con IVA incluido. PostgreSQL calcula en cada línea subtotal neto, IVA e importe total, redondeando a dos decimales por línea. Los totales de cabecera se recalculan desde esas líneas. El equipo comercial asigna cada solicitud con `claim_business_quote`; solo la persona asignada puede enviar `send_business_quote`, salvo super_admin. La oferta debe incluir un precio para cada línea y una fecha de validez entre ahora y un año. La UI permite de 1 a 90 días.

Las transiciones de cotización son `requested → in_review → sent → accepted | rejected | expired`. `sent` publica la oferta en el portal de la organización; esta entrega no envía correo. Owner/admin aceptan o rechazan una propuesta enviada; la base devuelve `expired` cuando la validez ya pasó. Las funciones públicas son wrappers `SECURITY INVOKER` y el cambio sensible se realiza en funciones privadas con comprobación de actor, rol, tenant y estado.

## CRM e historial

El CRM mantiene la bandeja de `quote_inquiries` y `crm_leads` para sales_manager/super_admin. La etapa de solicitudes públicas cambia mediante `update_quote_inquiry_status`, que valida transiciones y escribe actividad. Sales_manager ve las solicitudes B2B sin asignar y sus propias cotizaciones; la asignación las retira de la cola global. El acceso a organizaciones y membresías sigue siendo tenant-scoped; ventas no obtiene un directorio global de clientes.

`crm_activities` es append-only para los roles de aplicación. Triggers y RPCs guardan altas, cambios de etapa, asignaciones, ofertas, decisiones y cambios de equipo. El tenant ve solo eventos marcados como `organization`; ventas ve leads, consultas públicas y solicitudes B2B visibles por su asignación; super_admin conserva acceso de auditoría. La UI lee este historial persistido y no sintetiza actividad a partir de fechas.

Los nombres y correos que forman parte de una cotización son snapshots de la solicitud. No se guardan datos de tarjeta ni credenciales de pago.
