# packages/shared — Esquema de noticia, tipos, reglas de ranking

Contrato entre el portal, el feed y el chat. Cualquier cambio al esquema de `news.ts` se avisa al equipo antes de hacerse (ver docs/roles-equipo.md, regla 2).

Dueño: Rol 4 (Datos y relevancia), usado por todos los demás roles.

Contenido actual:
- `news.ts`: tipo `News`. Mismo contenido que el borrador de la sección 6 del CLAUDE.md, con los nombres de campos en inglés (decisión del 2026-10-09, antes de que el resto del equipo empezara a construir sobre el esquema — ver el mapeo de nombres en los comentarios de `news.ts` y el ciclo en `docs/ciclos.md`).

Pendiente (Etapa 3): reglas de ranking y protección anti-burbuja vivirán aquí también, para que el feed las use sin depender de un LLM.
