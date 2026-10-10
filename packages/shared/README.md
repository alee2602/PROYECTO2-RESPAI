# packages/shared — Esquema de noticia, tipos, reglas de ranking

Contrato entre el portal, el feed y el chat. Cualquier cambio al esquema de `news.ts` se avisa al equipo antes de hacerse (ver docs/roles-equipo.md, regla 2).

Dueño: Rol 4 (Datos y relevancia), usado por todos los demás roles.

Contenido actual:
- `news.ts`: tipo `News`. Mismo contenido que el borrador de la sección 6 del CLAUDE.md, con los nombres de campos en inglés (decisión del 2026-10-09, antes de que el resto del equipo empezara a construir sobre el esquema — ver el mapeo de nombres en los comentarios de `news.ts` y el ciclo en `docs/ciclos.md`).

**Actualización 2026-10-10:** las reglas de ranking y la protección anti-burbuja **no** terminaron viviendo aquí — quedaron en `apps/mobile/lib/ranking.ts`. Razón: dependen de `UserLocation` (tipo propio de `apps/mobile`, ligado a cómo esa app guarda la ubicación simulada), y meterlas en `packages/shared` hubiera obligado a ese paquete a depender de tipos de una sola app, rompiendo la idea de que `shared` es lo común entre las 3 partes. Si el portal (`apps/admin`) llega a necesitar el mismo ranking (por ejemplo, para una vista previa), se evalúa mover la lógica entonces.

Pendiente (Etapa 3): afinidad por tema a partir de señales de comportamiento — ver `docs/senales.md` y `apps/mobile/lib/ranking.ts`.
