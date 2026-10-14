# Costos (Rol 5)

Última actualización: 2026-10-13. Estado: **diseño aprobado, sin implementar**.

Este documento reúne lo que se presenta en la sección 9 de la demo: gasto, saldo, costo por función, medidas de ahorro y crédito reservado. El detalle está en:

- `docs/reduccion-costos.md`: catálogo de técnicas de ahorro (RC-01 a RC-21), con estado, código y verificación.
- `docs/medidor-gasto.md`: diseño técnico del medidor (endpoint, esquema de Firestore, reglas, módulos, modos de falla).

## Qué pide el enunciado

Presentar **gasto, saldo, costo por función, medidas de ahorro y crédito reservado** para la demo. El producto debe evitar llamadas costosas cuando ordenar, recuperar o presentar contenido se pueda resolver de forma más barata, y la infraestructura adicional debe usar niveles gratuitos cuando sea viable.

## Decisiones

| Decisión | Valor | Por qué |
|---|---|---|
| Proveedor | Anthropic, cuenta de Rol 5 con **USD 20** de crédito | Un solo dueño de la cuenta y de la clave (`docs/roles-equipo.md`, Rol 5). |
| Modelo | **Claude Haiku 5.5** (`claude-haiku-5-5`) | El más barato de la familia actual. Precio: **USD 0,10 por millón de tokens de entrada, USD 0,50 por millón de salida** (precios oficiales para prompts de hasta 100.000 tokens). |
| Presupuesto | USD 20 (valor fijo) | Saldo = presupuesto − gasto medido. |
| Reserva para la demo | **USD 10** | Editable desde el tablero `/costos`. Si el saldo cruzaría la reserva, el chat se apaga solo; con la reserva en 10, desarrollo y pruebas pueden gastar hasta **USD 10**. En la demo se puede bajar a 0. |
| Medidor | **Propio**, en Firestore, dentro del endpoint del chat | Ver abajo. |
| Despliegue | Nada nuevo: el endpoint `POST /api/chat` de `apps/mobile` en Vercel, el mismo Firestore (plan Spark) y una página en el portal | `docs/medidor-gasto.md` |

### Por qué un medidor propio

Anthropic tiene una API de uso y costos (`usage_report` y `cost_report`), pero:

- exige una **Admin API key**, y **no está disponible para cuentas individuales** (hace falta una organización en la Consola). No tenemos acceso a esa key;
- los datos llegan con unos **5 minutos de retraso**, así que no sirve para un tope;
- **no informa el saldo restante**.

Por eso el endpoint cuenta los tokens que devuelve la API en cada respuesta y calcula el costo con la tabla de precios. Para verificarlo, en cada ensayo se compara el tablero con la página **Usage** de la Consola de Anthropic (se ve sin Admin key) y se guarda la captura en `docs/evidencia/`.

**Limitación:** el medidor solo ve lo que pasa por el endpoint. Cualquier prueba hecha fuera de la app (curl, Consola) gasta del mismo crédito y no queda registrada. Regla: **todas las pruebas con el modelo se hacen a través del endpoint**; si alguna no, se anota a mano en la tabla de abajo.

## Costo por pregunta

Tamaños medidos por Rol 2 (`docs/chat.md`, paso 4). El tope de `max_tokens` incluye los tokens de pensamiento, así que el peor caso está acotado.

| Caso | Entrada | Salida | Costo |
|---|---|---|---|
| Pregunta típica (3 noticias) | ~1.300 | ≤ 350 | ~USD 0,0003 |
| "¿Qué pasó hoy?" (5 noticias) | ~1.900 | ≤ 350 | ~USD 0,0004 |
| **Peor caso** (5 noticias al máximo) | < 2.500 | 350 | **≤ USD 0,000425** |
| Sin modelo (saludo, vacía, sin noticias, fuera de tema, bloqueada) | 0 | 0 | **USD 0** |

Con el tope de USD 10, el peor caso permite unas 23.500 preguntas. **El riesgo no es que la demo agote el crédito: es el abuso** (un bucle, un script o muchas cuentas). Por eso la mitad de las técnicas (RC-14 a RC-20) son de protección.

## Costo por función

| Función | Qué usa | Costo |
|---|---|---|
| Ranking del feed (Rol 4) | Reglas y puntajes en el celular | USD 0 |
| Recuperación del chat (Rol 2) | Búsqueda por palabras, sin modelo | USD 0 |
| Respuestas sin modelo (Rol 2) | Textos fijos | USD 0 |
| Imágenes (Rol 3) | Openverse, imágenes libres | USD 0 |
| Login, datos | Firebase plan Spark | USD 0 |
| Hosting y endpoint | Vercel, nivel gratuito | USD 0 |
| **Chat con modelo** | Haiku 5.5, una llamada por pregunta | ~USD 0,0003 a 0,000425 por pregunta |

El chat con modelo es **lo único que cuesta dinero** en todo el producto.

## Tablero en el portal (`apps/admin`, página `/costos`)

Lee los contadores de Firestore (`usage/totals` y sus documentos por día y por hora) directamente con el SDK de cliente; las reglas solo dejan leer a los admins. Muestra:

- **Gasto** acumulado, **saldo** (USD 20 − gasto, fijo), **reserva** editable (USD 10 por defecto) y lo disponible antes de la reserva. Si el saldo cruza la reserva, el chat se apaga solo y el tablero lo muestra.
- **Costo por función** (tabla de arriba, con el chat medido).
- **Medidas de ahorro:** preguntas resueltas sin modelo, fuera de tema, limitadas o bloqueadas, y el ahorro estimado (esas preguntas × costo promedio de una llamada real).
- Gasto de hoy y de la última hora.
- El **interruptor** para apagar y encender el chat (`config/chat`). Encender es siempre manual. **Hecho (2026-10-13):** `apps/admin/app/costos/page.tsx`.

## Gasto fuera del endpoint (registro manual)

| Fecha | Quién | Qué | Gasto aprox. |
|---|---|---|---|
| 2026-10-14 | Rol 5 | Pruebas en vivo `npm run test:live` (`apps/mobile/lib/anthropic.live.ts`): 2 llamadas a Haiku 5.5 por corrida, no pasan por el medidor | USD 0,00015 por corrida |

## Preguntas abiertas

- **Valores de los límites.** Por decidir con el equipo, idealmente después de medir en un ensayo cuántas preguntas hace una persona en la demo. Hoy son constantes del código (`USER_LIMITS` en `apps/mobile/lib/usage.ts`):
  - ráfaga por usuario (preguntas por minuto);
  - total por usuario por día;
  - cuántas noticias trae la consulta a Firestore (propuesta: 50, RC-10).
- Lista de palabras del filtro de pedidos fuera de tema (RC-14): se arma con el banco de pruebas, cuidando no bloquear preguntas legítimas.

## Orden de implementación

1. Medidor + reserva con apagado automático (RC-19), con `UsageStore` en memoria y pruebas. No depende de nadie. **Hecho en código (2026-10-13).**
2. Límites por usuario e interruptor (RC-17, RC-20). **Hecho en código (2026-10-13).** El freno por hora (RC-18) se descartó.
3. Conectar Haiku 5.5 + banco de pruebas del pensamiento (RC-08), con Rol 2. **Parcial:** Haiku 5.5 conectado (`lib/anthropic.ts`, pensamiento desactivado); falta el banco de pruebas.

Los pasos 1 a 3 falta probarlos en vivo: Rol 4 tiene que configurar Vercel y Firebase (`docs/medidor-gasto.md`, Tarea 10 de `docs/medidor_gasto_plan.md`).
4. Tablero en el portal. **Hecho en código (2026-10-13):** `/costos`, con interruptor y reserva editable.
5. Filtro fuera de tema, contexto según la intención, consulta acotada y caché (RC-14, RC-09, RC-10, RC-11).

## Quién hace qué

| Quién | Qué |
|---|---|
| **Rol 5** | Código y pruebas en la rama `rol5/medidor`; API key de Anthropic; reglas propuestas en el PR. |
| **Rol 4** (administra Firebase y Vercel) | Clave de la cuenta de servicio; desplegar las reglas; documento `admins/{correo}` de Rol 5; `FIREBASE_SERVICE_ACCOUNT` y `ANTHROPIC_API_KEY` en Vercel (`docs/medidor-gasto.md`); borrar un `config/chat` viejo antes de desplegar las reglas. |
| **Rol 2** | Revisar los cambios en `route.ts`, `chat.ts` (motivos nuevos) y `prompt.ts` (RC-09, RC-13). |
| **Rol 3** | Revisar la página `/costos` del portal. |
