# Decisiones pendientes

Entrega: **2026-10-16**. Última actualización: 2026-10-09.

| Decisión | Estado | Notas |
|---|---|---|
| Confirmación por escrito del profesor sobre PWA | Pendiente | Dicho de palabra que vale; falta por escrito. No bloqueante para seguir construyendo. |
| Dónde corre el endpoint del chat / hosting | Resuelto (2026-09-30) | **Firebase solo para Auth + Firestore** (plan Spark, gratis, sin tarjeta). **Hosting del frontend y endpoint del chat en Vercel** (funciones serverless de Vercel sí pueden llamar APIs externas sin plan de pago). Se evita así el plan Blaze de Firebase, que exige tarjeta de crédito para llamadas salientes desde Cloud Functions. |
| Stack definitivo (framework del frontend: Next.js vs. otra opción) | Resuelto (2026-10-09) | Confirmado por la usuaria con el equipo: **Next.js** (App Router, TypeScript). Monorepo montado con npm workspaces (`apps/mobile` ya scaffoldeado; se llamó `apps/app` al inicio, renombrado el mismo día por la ruta confusa `apps/app/app` que genera el App Router). |
| Dónde vive el endpoint del chat dentro del monorepo | Resuelto (2026-10-09) | **API route dentro de `apps/mobile`** (`apps/mobile/app/api/chat/`), no un proyecto de Vercel aparte. Un solo proyecto que desplegar/configurar, y el chat está pegado al frontend de todos modos. La carpeta `functions/` se eliminó. Falta avisarle a quien tenga el Rol 2. |
| Modelo y proveedor para el chat (el más barato que dé calidad aceptable) | Pendiente | Debe pasar por un endpoint de servidor con medidor de costo y tope, nunca una key en el cliente. |
| Origen de imágenes (libres con atribución, generación IA, o ambas) y límite de costo | Pendiente | El enunciado pide considerar costo, calidad, derechos de uso y riesgo de representación engañosa. |
| Señales de comportamiento para inferir intereses, y cómo evitar que oculten información importante | Pendiente | Debe convivir con la regla de protección anti-burbuja (cupo mínimo local/nacional/internacional). |
| Roles del equipo (tabla sección 7 del CLAUDE.md) | Resuelto (2026-10-09) | Ver `docs/roles-equipo.md` — misión, responsabilidades, entregables por etapa y criterios de aceptación detallados por rol. (Datos y relevancia). |
| Modelos locales (LM Studio / Qwen / Ollama+OpenCode) | Resuelto por ahora | Es tooling de desarrollo/pruebas en local, no reemplaza el endpoint de chat en producción (que debe estar en la nube para la demo multiusuario). |
| Set de noticias de prueba (temas, alcances, países, estados de validación) | Pendiente — asignado a Rol 4 | `docs/roles-equipo.md` lo concreta: 10 a 15 noticias semilla, los 3 alcances, al menos 2 países, varios temas, al menos una sin imagen, varias en `en_desarrollo`/`no_verificada`. Parte del entregable "Días 1-2" de Rol 4, junto con el monorepo y Firestore. |
| Estrategia de ramas (branching) | Resuelto (2026-10-09) | `docs/roles-equipo.md`, regla 1: una tarea, una rama, un PR revisado por otra persona. Nadie hace push directo a `main`. |
