# Costos: medición, tope y reducción (Rol 5)

Última actualización: 2026-10-13. Estado: **diseño aprobado, sin implementar**. Este documento es el spec del medidor de gasto y crece con cada paso.

## Qué pide el enunciado

Presentar **gasto, saldo, costo por función, medidas de ahorro y crédito reservado** para la demo. El producto debe evitar llamadas costosas cuando ordenar, recuperar o presentar contenido se pueda resolver de forma más barata, y la infraestructura adicional debe usar niveles gratuitos cuando sea viable.

## Decisiones

| Decisión | Valor | Por qué |
|---|---|---|
| Proveedor | Anthropic, cuenta de Rol 5 con **USD 20** de crédito | Un solo dueño de la cuenta y de la clave (`docs/roles-equipo.md`, Rol 5). |
| Modelo | **Claude Haiku 5.5** (`claude-haiku-5-5`) | El más barato de la familia actual. Precio: **USD 0,10 por millón de tokens de entrada, USD 0,50 por millón de salida** (precios oficiales para prompts de hasta 100.000 tokens). |
| Presupuesto | USD 20 (valor fijo) | Saldo = presupuesto − gasto medido. |
| Reserva para la demo | **USD 10** | El tope de desarrollo y pruebas es USD 20 − 10 = **USD 10**. |
| Medidor | **Propio**, en Firestore | Ver "Por qué un medidor propio". |
| Pensamiento del modelo | Al mínimo (desactivado o esfuerzo `low`), decidido con pruebas | Ver "Pensamiento del modelo". |

### Por qué un medidor propio

Anthropic tiene una API de uso y costos (`/v1/organizations/usage_report/messages` y `/v1/organizations/cost_report`), pero:

- exige una **Admin API key**, y **no está disponible para cuentas individuales** (hace falta una organización en la Consola). No tenemos acceso a esa key;
- los datos llegan con unos **5 minutos de retraso**, así que no sirve para un tope;
- **no informa el saldo restante**.

Sin esa key, el endpoint del chat cuenta los tokens que devuelve la API en cada respuesta (`usage.input_tokens`, `usage.output_tokens`) y calcula el costo con la tabla de precios. Para verificarlo, en cada ensayo se compara el tablero con la página **Usage** de la Consola de Anthropic (se ve sin Admin key) y se guarda la captura en `docs/evidencia/`.

**Limitación:** el medidor solo ve lo que pasa por el endpoint. Cualquier prueba hecha fuera de la app (curl, Consola) gasta del mismo crédito y no queda registrada. Regla: **todas las pruebas con el modelo se hacen a través del endpoint**; si alguna no, se anota a mano aquí.

## Costo por pregunta

Tamaños medidos por Rol 2 (`docs/chat.md`, paso 4). El tope de `max_tokens` incluye los tokens de pensamiento, así que el peor caso de salida está acotado.

| Caso | Entrada | Salida | Costo |
|---|---|---|---|
| Pregunta típica (3 noticias) | ~1.300 | ≤ 350 | ~USD 0,0003 |
| "¿Qué pasó hoy?" (5 noticias) | ~1.900 | ≤ 350 | ~USD 0,0004 |
| **Peor caso** (5 noticias al máximo) | < 2.500 | 350 | **≤ USD 0,000425** |
| Sin modelo (saludo, vacía, sin noticias, fuera de tema, bloqueada) | 0 | 0 | **USD 0** |

Con el tope de USD 10, el peor caso permite unas 23.500 preguntas. **El riesgo no es que la demo agote el crédito: es el abuso** (un bucle, un script o muchas cuentas). Por eso la mitad de este diseño es protección.

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

## El diseño en tres partes

### 1. Flujo eficiente de las preguntas legítimas

- **Una sola llamada por pregunta, sin herramientas ni bucle de agente.** El modelo no puede "ir a buscar" nada por su cuenta: recibe las noticias ya elegidas y redacta. Es la decisión que más ahorra; un agente con herramientas multiplica las llamadas.
- **La recuperación no usa modelo** y manda solo de 1 a 5 noticias recortadas (hecho, Rol 2).
- **Consulta acotada a Firestore:** solo publicadas, ordenadas por `publishedAt` de la más nueva a la más vieja, con un límite (por ejemplo 50). No filtra por ubicación: eso rompería "explicar una noticia de otro país"; ese filtro lo hace la recuperación.
- **Caché de la lista de noticias en el servidor por 60 segundos.** Diez personas preguntando a la vez equivalen a una sola lectura.
- **Contexto según la intención.** "Resumir lo reciente" solo necesita título, resumen y estado; el extracto del cuerpo se manda solo cuando hay que explicar una noticia. Baja el caso más caro de ~1.900 a ~1.000 tokens de entrada.
- Sin historial, pregunta ≤ 300 caracteres, salida ≤ 350 tokens (hecho, Rol 2).

### 2. Propósito cerrado

Una pregunta como "¿cómo está el clima en Nicaragua?" ya cuesta USD 0: la recuperación no encuentra noticias y el chat responde "no puedo confirmarlo" sin llamar al modelo. El riesgo es la pregunta **disfrazada**: una palabra que sí está en las noticias más un pedido ajeno ("escríbeme un poema largo sobre las elecciones en España").

- **Regla en el prompt del sistema:** solo responde sobre las noticias publicadas y la ubicación del usuario; cualquier otro pedido (poemas, código, traducciones, opiniones, el clima) se rechaza en una frase.
- **Filtro previo sin modelo (USD 0):** una lista corta de pedidos ajenos y de intentos de inyección. Si aparece, se responde con un texto fijo sin llamar al modelo.
- `max_tokens` = 350 limita cuánto puede divagar.

### 3. Protección contra abuso

| Capa | Estado |
|---|---|
| Solo usuarios con sesión de Google (token verificado) | Hecho (Rol 2) |
| Pregunta ≤ 300 caracteres, salida ≤ 350 tokens, 1 a 5 noticias, sin historial | Hecho (Rol 2) |
| Protección contra inyección en el prompt | Hecho (Rol 2) |
| Filtro previo de pedidos ajenos | Nuevo |
| **Límite por usuario:** ráfaga por minuto y total por día | Nuevo, en Firestore |
| **Freno global por hora**, por si alguien abre muchas cuentas | Nuevo |
| **Tope total:** si gasto + peor caso de una llamada > USD 10, no se llama al modelo y se responde `budget_exhausted` | Nuevo |
| **Interruptor de apagado** del chat desde el tablero del portal | Nuevo |

## Flujo del endpoint `POST /api/chat`

```
token válido? ──no──► 401 unauthenticated
     │sí
chat encendido? (config/chat) ──no──► mensaje fijo
     │sí
límite del usuario? ──superado──► mensaje fijo ("limited", USD 0)
     │ok
recuperación (sin modelo)
     │
sin noticias / vacía / fuera de tema? ──sí──► respuesta sin modelo (USD 0)
     │no
gasto + peor caso > tope?  o  freno por hora? ──sí──► budget_exhausted (USD 0)
     │no
Haiku 5.5 ──► registrar tokens reales y costo ──► respuesta
```

Cada pregunta, con o sin modelo, suma a los contadores con su camino (`model`, `no_model`, `off_topic`, `limited`, `blocked`). Así el tablero muestra cuántas preguntas se resolvieron gratis.

## Qué se agrega a Firebase

1. **Cuenta de servicio (Firebase Admin SDK).** Su clave va solo en las variables de entorno de Vercel del proyecto `mobile` (nunca `NEXT_PUBLIC_`, nunca en el repo). Hace falta porque los contadores los escribe **el servidor**, no el usuario: si el usuario pudiera escribirlos con su propio token, podría borrar su límite. Rol 2 evitó esta cuenta a propósito para leer noticias (usa el token del usuario); para escribir el gasto no hay alternativa sin ella. Con el Admin SDK el token del usuario se verifica aparte, lo que además permite cachear la lista de noticias sin saltarse la seguridad.
2. **Colecciones nuevas:**

   | Documento | Qué guarda | Quién escribe | Quién lee |
   |---|---|---|---|
   | `usage/totals` | Gasto en USD, tokens de entrada y salida, preguntas por camino; lo mismo por día y por hora (para el freno) | Solo el servidor | Admins |
   | `rate_limits/{uid}` | Preguntas del usuario en la ventana actual | Solo el servidor | Admins |
   | `config/chat` | Interruptor encendido/apagado | Admins (portal) | Admins y el servidor |

   No se guarda el texto de las preguntas en ningún lado, solo su largo.
3. **Reglas de Firestore:** lo de arriba, y todo lo demás sigue cerrado por defecto. **Lo aprueba y lo despliega Rol 4.**
4. **Índices compuestos:** ninguno. La consulta de noticias usa un solo campo y Firestore crea ese índice solo.

Todo cabe en el plan gratuito Spark: unas pocas escrituras por pregunta frente a 20.000 escrituras gratis por día.

### Cómo se agregan los datos

**El mismo endpoint suma en cada llamada**, con incrementos atómicos (`FieldValue.increment`) sobre `usage/totals`. Varios celulares a la vez no se pisan. El tablero lee un solo documento.

Descartado:

- **Agregar al abrir el tablero** (leer todas las llamadas y sumar): las lecturas crecen con el uso.
- **Proceso periódico** (cron): necesita Cloud Functions programadas, que exigen el plan Blaze con tarjeta.

Opcional si hay tiempo: un documento por llamada (sin el texto) como historial para la evidencia. Mientras tanto, los logs de Vercel ya registran una línea por pregunta (Rol 2).

## Tablero en el portal (`apps/admin`, página `/costos`)

Lee `usage/totals` directamente con el SDK de cliente (las reglas solo dejan leer a los admins). Muestra:

- **Gasto** acumulado, **saldo** (USD 20 − gasto), **reserva** (USD 10) y cuánto queda antes del tope.
- **Costo por función** (tabla de arriba, con el chat medido).
- **Medidas de ahorro:** preguntas resueltas sin modelo, fuera de tema, limitadas o bloqueadas, y el ahorro estimado (esas preguntas × costo promedio de una llamada real).
- Gasto de hoy y de la última hora.
- El **interruptor** para apagar el chat.

## Pensamiento del modelo

Haiku 5.5 piensa por defecto, y esos tokens se cobran como salida y salen del mismo `max_tokens` de 350: si piensa mucho, además de costar más, puede cortar la respuesta. Se va a usar al mínimo, pero **sin perder lo ético**:

- Las citas y la nota "Lo que no está confirmado" **las arma el código** (`buildCitations`, `uncertaintyNote`, `docs/chat.md` paso 2). Aunque el modelo razone menos, el aviso de incertidumbre nunca falta.
- Lo que sí puede empeorar es el texto. Se decide con un **banco de unas 10 preguntas** (lo comparte el paso 7 de Rol 2): las 4 consultas del enunciado, fuentes contradictorias, noticia no verificada, algo no publicado, pregunta disfrazada fuera de tema e intento de inyección.
- Se compara "pensamiento desactivado" contra "esfuerzo `low`": tokens reales, costo y si cumple cada caso. Gana el más barato que pase todos. El resultado se anota en `docs/ciclos.md`.

## Medidas de ahorro

| Medida | Estado | Qué ahorra |
|---|---|---|
| Ranking del feed sin modelo | Hecho (Rol 4) | Todas las llamadas del feed |
| Recuperación sin modelo | Hecho (Rol 2) | Una llamada por pregunta |
| Respuestas sin modelo (vacía, saludo, sin noticias) | Hecho (Rol 2) | La llamada entera |
| Contexto corto (1 a 5 noticias recortadas), sin historial, salida ≤ 350 | Hecho (Rol 2) | Tokens por llamada |
| Una sola llamada, sin herramientas ni bucle de agente | Hecho (Rol 2), se deja como regla | Llamadas múltiples por pregunta |
| Imágenes libres en vez de generadas | Hecho (Rol 3) | Generación de imágenes |
| Pensamiento al mínimo | Por hacer | Tokens de salida ocultos |
| Filtro previo de pedidos ajenos | Por hacer | La llamada entera |
| Contexto según la intención | Por hacer | ~45 % de la entrada en "lo reciente" |
| Límites por usuario, freno por hora, tope total | Por hacer | Abuso |
| Caché de la lista de noticias (60 s) | Por hacer | Lecturas de Firestore y tiempo |

### Descartado y por qué

- **Prompt caching de Anthropic:** abarata solo la parte repetida de la entrada (la respuesta se cobra igual), y el prompt del sistema (~390 tokens) es más corto que el mínimo que la API cachea. No ahorraría nada.
- **Caché de respuestas "parecidas":** decidir que dos preguntas son iguales agrega complejidad (o un modelo) y no asegura ahorro.
- **API de uso de Anthropic:** sin Admin key (ver arriba).
- **Índices para abaratar Firestore:** Firestore cobra por documento devuelto, no por documento revisado; un índice no baja el costo. Lo que lo baja es el límite de la consulta y el caché.

## Preguntas abiertas

- **Valores de los límites.** Por decidir con el equipo, idealmente después de medir en un ensayo cuántas preguntas hace una persona en la demo:
  - ráfaga por usuario (preguntas por minuto);
  - total por usuario por día;
  - freno global (USD por hora);
  - cuántas noticias trae la consulta a Firestore (propuesta: 50).
- Lista de palabras del filtro de pedidos ajenos: se arma con el banco de pruebas, cuidando no bloquear preguntas legítimas.

## Orden de implementación

1. Medidor + tope total (Firestore, Admin SDK, reglas con Rol 4).
2. Límites por usuario, freno por hora e interruptor.
3. Conectar Haiku 5.5 + banco de pruebas del pensamiento (con Rol 2).
4. Tablero en el portal.
5. Filtro de pedidos ajenos, contexto según la intención y caché de la lista de noticias.

## Coordinación

- **Rol 2:** `app/api/chat/route.ts` y el pipeline son suyos. El medidor vive en módulos propios (`lib/usage.ts` y similares) y en `route.ts` solo se tocan unas pocas líneas para enchufarlo. El filtro fuera de tema y el contexto según la intención tocan `retrieval.ts` / `prompt.ts`: se proponen y revisan con Rol 2.
- **Rol 4:** reglas de Firestore y colecciones nuevas.
- **Rol 3:** la página `/costos` en el portal.
