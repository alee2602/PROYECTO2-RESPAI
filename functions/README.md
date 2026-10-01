# functions — Endpoint del chat y medidor de costos

Función serverless que habla con el modelo de IA para el chat. Nunca se expone la API key al cliente.

Responsabilidades:
- Recuperar noticias publicadas relevantes a la pregunta (sin usar un modelo para recuperar).
- Llamar al modelo con contexto corto y respuestas cortas.
- Registrar por llamada: tokens, costo estimado y gasto acumulado.
- Apagarse antes de agotar el saldo (tope de gasto).

Dueño: Rol 2 (Chat), con el tope de gasto definido junto a Rol 5.

Plataforma todavía sin confirmar (Cloud Functions, Vercel Functions u otra) — ver `/docs/decisiones-pendientes.md`.
