# Portal B2B conectado

```powershell
pwsh -File tests/integration/b2b-connected/run.ps1
```

Requiere Docker, pnpm y Chromium instalado por Playwright. El runner copia las migraciones y el seed de este checkout a un directorio temporal y arranca el proyecto local `nodria-b2b-e2e`, con API en `127.0.0.1:56401` y PostgreSQL en `56402`. La aplicación Next usa el puerto `4323`. Si ya existe el contenedor de este proyecto, el runner falla antes de modificarlo.

Las claves locales se leen en memoria, sin imprimirse ni guardarse. Los usuarios y productos son ficticios. El runner elimina al terminar únicamente la instancia que creó, incluidos sus volúmenes y fixtures; restaura las variables de entorno anteriores. No cambia el proyecto compartido `nodria-commerce`.

La prueba usa GoTrue, PostgREST, los RPCs de negocio, el login de navegador y la Server Action del portal. Comprueba:

- Creación y envío de oferta por RPCs, aceptación en el portal y emisión del pedido con direcciones y condiciones.
- Precio negociado, pago pendiente y reserva persistida, independientes del precio de catálogo.
- Refresh y retry sin duplicar el pedido ni las reservas; dirección distinta devuelve conflicto.
- Miembros buyer/viewer pueden leer el pedido y no emitirlo; viewer ve la confirmación en el portal.
- Un usuario ajeno a la organización no puede leer ni emitir el pedido.
- Stock insuficiente devuelve un error visible y revierte la emisión sin aumentar las reservas.

Los resultados y trazas de fallo se guardan en `.data/b2b-connected-results`. Esta suite está fuera del árbol del gate E2E demo y usa archivos `.spec.ts`, por lo que tampoco entra en el gate Vitest.

El settlement del anticipo y la expiración/liberación de reservas pendientes quedan fuera del contrato de emisión.
