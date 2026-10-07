<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Contexto del proyecto

Este repositorio construye NODRIA, un producto académico de comercio tecnológico B2C/B2B con operaciones integradas. Antes de una tarea transversal, lee `docs/PROJECT_BRIEF.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/STATUS.md`, `docs/WORKSTREAMS.md` y `docs/AGENT_HANDOFF.md`. Confirma el código, migraciones y Git antes de tratar una capacidad como terminada. El repositorio es la fuente de verdad cuando el código difiera de los documentos.

## Reglas de trabajo

- No presentes una pantalla como funcionalidad terminada: una capacidad solo es `Done` tras implementación, integración, manejo de errores, seguridad y verificación apropiada. Usa los estados definidos en `docs/STATUS.md`.
- No dejes controles visibles sin comportamiento. Implementa la acción, deshabilítala con explicación o identifícala como límite deliberado de demo.
- Conserva límites modulares dentro de una sola aplicación. No introduzcas microservicios ni infraestructura adicional sin una necesidad demostrable.
- Mantén validación y decisiones sensibles en servidor. La UI y los datos recibidos del navegador no son autorización.
- No expongas secretos, service-role keys ni credenciales de pago. Los datos de demo deben ser ficticios y nunca deben solicitar números reales de tarjeta.
- Los cambios de base de datos deben ser migraciones reproducibles y acordadas con el ownership documentado en `docs/WORKSTREAMS.md`. Antes de editar una superficie compartida o sensible, coordina el contrato y evita editar simultáneamente los mismos archivos.
- Al completar una unidad de trabajo, actualiza el estado y las decisiones afectadas; informa objetivo, archivos, cambios de contrato, verificaciones, riesgos y siguientes pasos.
