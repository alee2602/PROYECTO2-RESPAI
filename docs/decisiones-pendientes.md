# Decisiones pendientes

Entrega: **2026-10-16**. Hoy: 2026-09-30.

| Decisión | Estado | Notas |
|---|---|---|
| Confirmación por escrito del profesor sobre PWA | Pendiente | Dicho de palabra que vale; falta por escrito. No bloqueante para seguir construyendo. |
| Dónde corre el endpoint del chat / hosting | Resuelto (2026-09-30) | **Firebase solo para Auth + Firestore** (plan Spark, gratis, sin tarjeta). **Hosting del frontend y endpoint del chat en Vercel** (funciones serverless de Vercel sí pueden llamar APIs externas sin plan de pago). Se evita así el plan Blaze de Firebase, que exige tarjeta de crédito para llamadas salientes desde Cloud Functions. |
| Stack definitivo (framework del frontend: Next.js vs. otra opción) | Pendiente | El enunciado no exige ningún framework ("cada equipo decidirá su arquitectura"). Sección 5 del CLAUDE.md propone Next.js/TypeScript, razonable dado que ya se decidió Vercel como hosting (Next.js es lo más directo ahí), pero falta confirmarlo con el equipo. |
| Modelo y proveedor para el chat (el más barato que dé calidad aceptable) | Pendiente | Debe pasar por un endpoint de servidor con medidor de costo y tope, nunca una key en el cliente. |
| Origen de imágenes (libres con atribución, generación IA, o ambas) y límite de costo | Pendiente | El enunciado pide considerar costo, calidad, derechos de uso y riesgo de representación engañosa. |
| Señales de comportamiento para inferir intereses, y cómo evitar que oculten información importante | Pendiente | Debe convivir con la regla de protección anti-burbuja (cupo mínimo local/nacional/internacional). |
| Roles del equipo (tabla sección 7 del CLAUDE.md) | Pendiente | Nadie tiene rol asignado todavía (2026-09-30). |
| Modelos locales (LM Studio / Qwen / Ollama+OpenCode) | Resuelto por ahora | Es tooling de desarrollo/pruebas en local, no reemplaza el endpoint de chat en producción (que debe estar en la nube para la demo multiusuario). |
| Set de noticias de prueba (temas, alcances, países, estados de validación) | Pendiente | No hay temática obligatoria — es noticias en general. Para la demo necesitan variedad: distintos `temas`, los 3 niveles de `alcance` (local/nacional/internacional) con al menos 2 países distintos, al menos una noticia sin imagen y alguna en `no_verificada`/`en_desarrollo`. Se define al armar el contenido de prueba (Etapa 1 en adelante). |
| Estrategia de ramas (branching) | Pendiente | Opciones: rama por tarea (`feat/...`) mergeada a `main` cuando esté lista y probada, o trabajar directo en `main` dado lo corto del tiempo (2.5 semanas). Con 5 personas tocando partes distintas (app, admin, functions, shared) conviene al menos la primera opción, pero es decisión del equipo. |
