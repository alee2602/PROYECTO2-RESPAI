# packages/shared — Esquema de noticia, tipos, reglas de ranking

Contrato entre el portal, el feed y el chat. Cualquier cambio al esquema de `noticia.ts` se avisa al equipo antes de hacerse (ver sección 11 del CLAUDE.md raíz).

Dueño: Rol 4 (Datos y relevancia), usado por todos los demás roles.

Contenido actual:
- `noticia.ts`: tipo `Noticia`, tomado tal cual de la sección 6 del CLAUDE.md raíz (borrador cerrado el 2026-09-30, sin cambios respecto al enunciado del proyecto).

Pendiente (Etapa 3): reglas de ranking y protección anti-burbuja vivirán aquí también, para que el feed las use sin depender de un LLM.
