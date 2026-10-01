# Log de ciclos de ingeniería

Formato por ciclo: qué se esperaba, qué pasó, qué se cambió y por qué.

## 2026-09-30 — Arranque de Etapa 0

**Se esperaba:** definir desde cero la estructura del repo y el esquema de noticia antes de escribir código de producto.

**Qué pasó:**
- Se leyó el CLAUDE.md del repo y se comparó contra el enunciado oficial del proyecto (PDF). No se encontraron contradicciones; el CLAUDE.md es una interpretación fiel, con decisiones de diseño propias del equipo (esquema de noticia, estados de validación, cupo anti-burbuja) que el enunciado deja abiertas a cada equipo.
- Surgió una instrucción externa (recibida en clase/reunión, no del enunciado) de instalar LM Studio con modelos locales (Qwen, posible "Gemma"/otro ~27B mal transcrito) y usar Ollama/OpenCode. Se confirmó con la usuaria que es solo para pruebas/desarrollo local, no para el endpoint de chat de producción — evita el conflicto con el requisito de backend en la nube (sección 2.5 del CLAUDE.md).
- Se creó la estructura de carpetas sugerida (`/apps/app`, `/apps/admin`, `/packages/shared`, `/functions`, `/docs`) con un README por carpeta.
- Se confirmó el esquema de `Noticia` (sección 6 del CLAUDE.md) y se guardó en `/packages/shared/noticia.ts`, sin cambios respecto al borrador.

**Qué se cambió y por qué:** nada del esquema ni del enunciado se modificó; se documentó el estado de las decisiones pendientes en `/docs/decisiones-pendientes.md` para no perderlas de vista, dado que el equipo todavía no asigna roles ni cierra el stack.

**Pendiente para el próximo ciclo:** asignar roles, decidir stack, crear proyecto de Firebase y probar login de Google en un iPhone real (riesgo conocido de `signInWithPopup`/`signInWithRedirect` en PWA instalada en iOS).
