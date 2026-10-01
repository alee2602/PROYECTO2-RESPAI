# CLAUDE.md — Proyecto 2: AI Assisted News App

Curso: Responsible AI (CC3106). Equipo de 5 personas. Este archivo es el contexto base para cualquier sesión de Claude Code en este repo. Léelo completo antes de proponer o escribir código.

## 1. Qué estamos construyendo

Una app de noticias personalizadas con portal administrativo. El sistema decide qué noticias le importan a cada usuario y cómo mostrarlas, usando IA de forma responsable, transparente y barata.

Se compone de:

- **App móvil como PWA** (web app progresiva) que funciona en iPhone y Android, se instala desde el navegador ("Añadir a pantalla de inicio") y se comparte por link o QR. Sin tiendas de apps. El profesor dijo de palabra que una PWA es válida; falta confirmarlo por escrito.
- **Portal web administrativo** con autenticación, donde una persona crea y publica noticias.
- **Chat de noticias** (pantalla inicial de la app), temporal, sin historial entre sesiones.
- **Feed personalizado** con jerarquía visual (posición y tamaño según relevancia estimada, estilo Marca adaptado a móvil).
- **Lector de noticia**.

## 2. Restricciones que no se negocian

1. **Presupuesto: USD 20 en créditos de API de IA por equipo**, para desarrollo, pruebas y demo. Hay que evitar gastarlos antes de la presentación.
2. **Login con Google vía Firebase Authentication**, tanto en la app como en el portal.
3. **Ubicación simulada**: el usuario elige su ubicación en la app. La personalización depende de eso, **nunca del GPS**.
4. **Sin publicar en tiendas**.
5. **Varios usuarios con ubicaciones distintas deben poder usar la app a la vez** durante la demo. Por eso el backend tiene que estar en la nube, no en una laptop.
6. **Cuando el sistema no pueda confirmar algo, debe decirlo claramente**.

## 3. Principios de Responsible AI (se tienen que ver en el código, no solo en un documento)

- **Relevancia sin burbujas**: la personalización no puede esconder noticias locales, nacionales o internacionales importantes. Debe existir una regla explícita de protección (por ejemplo, un cupo mínimo de noticias de alcance local/nacional/global en el feed, sin importar los intereses del usuario).
- **Fuentes**: cada noticia guarda y muestra su procedencia. Se distingue contenido original, resumen y aporte generado por IA.
- **Validación**: cada noticia tiene un estado (`confirmada`, `en_desarrollo`, `no_verificada`). Hay un flujo definido para cuando una fuente no alcanza o dos fuentes se contradicen. La respuesta de un modelo **nunca** cuenta como prueba de que algo es verdad.
- **Criterio humano**: publicar y cambiar el estado de validación lo decide una persona desde el portal. La IA puede asistir, no decidir.
- **Imágenes**: si una noticia no tiene imagen, el portal ofrece una forma de obtener una. Toda imagen generada o alterada con IA lleva etiqueta visible y un campo de origen en los datos. Nunca debe parecer evidencia fotográfica del hecho. Preferir imágenes libres con atribución antes que generar.
- **Chat**: responde solo con base en las noticias publicadas, cita las fuentes y marca qué es confirmado y qué es incierto o en desarrollo.

## 4. Costos (regla de oro: no llamar a un modelo si algo se resuelve sin él)

- **El ranking del feed NO usa LLM.** Se resuelve con reglas y puntajes (ubicación, alcance geográfico de la noticia, recencia, señales de comportamiento, piso de protección contra burbujas).
- La llamada al modelo para el chat **siempre pasa por un endpoint del servidor**. Nunca se pone una API key en el código del cliente.
- Ese endpoint registra por llamada: tokens, costo estimado y gasto acumulado, y tiene un **tope de gasto** que lo apaga antes de agotar el saldo. Hay que reservar crédito para la demo.
- Usar un modelo barato, contexto corto (solo las noticias relevantes recuperadas, no todas) y respuestas cortas.
- Preferir niveles gratuitos para la infraestructura.

## 5. Stack (propuesto, por confirmar con el equipo)

> Claude Code: no asumas que esto está decidido. Si una tarea depende de una decisión pendiente (sección 9), pregunta antes de construir.

- **Frontend (PWA + portal)**: React/Next.js con TypeScript, ambos en el mismo repo para compartir tipos y componentes. Mobile-first, con manifest, íconos y manejo de zonas seguras (notch y barra inferior) para iOS.
- **Auth**: Firebase Authentication (Google).
- **Base de datos**: Firestore.
- **Hosting**: Firebase Hosting o Vercel (nivel gratuito).
- **Endpoint del chat**: función serverless (Cloud Functions, Vercel Functions o similar) que habla con el modelo y mide el gasto.

Estructura sugerida del repo:

```
/apps/app        → la PWA (chat, feed, lector, selector de ubicación)
/apps/admin      → el portal administrativo
/packages/shared → esquema de noticia, tipos, reglas de ranking
/functions       → endpoint del chat y medidor de costos
/docs            → requerimientos, criterios de aceptación, Done, log de ciclos, costos
```

### Punto de riesgo conocido: login con Google en iPhone

En una PWA instalada en iOS, `signInWithPopup` suele fallar y `signInWithRedirect` ha tenido problemas por el bloqueo de almacenamiento entre dominios de Safari. Además, la PWA instalada tiene almacenamiento separado de Safari (la sesión no se comparte). **Esto se prueba en un iPhone real en la Etapa 0**, antes de construir nada encima.

## 6. Esquema de una noticia (borrador, es el contrato entre portal, feed y chat)

Se cierra entre todos el primer día. Cualquier cambio posterior se avisa al equipo y se actualiza en `/packages/shared`.

```ts
type Noticia = {
  id: string
  titulo: string
  resumen: string
  cuerpo: string
  // Procedencia
  fuentes: { nombre: string; url?: string; tipo: 'original' | 'resumen' | 'ia' }[]
  autorId: string            // quién la publicó en el portal
  // Validación
  estadoValidacion: 'confirmada' | 'en_desarrollo' | 'no_verificada'
  notaValidacion?: string    // por qué tiene ese estado, qué falta, contradicciones
  // Alcance geográfico (para relevancia)
  alcance: 'local' | 'nacional' | 'internacional'
  pais?: string
  region?: string
  temas: string[]
  // Imagen
  imagen?: { url: string; origen: 'foto_real' | 'libre_con_atribucion' | 'generada_ia'; atribucion?: string }
  // Fechas
  creadaEn: string
  publicadaEn?: string
  actualizadaEn?: string
}
```

No hay campo explícito de "importancia": la prominencia se calcula en el feed por usuario y contexto.

## 7. División de roles (5 personas)

Cada rol es dueño de algo que se puede mostrar funcionando en la demo (todos participan de forma sustantiva en la presentación).

| # | Rol | Dueño de | Se apoya en |
|---|-----|----------|-------------|
| 1 | **App móvil (PWA)** | Auth con Google, instalación en iOS/Android, feed con jerarquía visual, lector, selector de ubicación | Rol 4 (ranking ya calculado) |
| 2 | **Chat** | Recuperar noticias publicadas, responder con fuentes, marcar incertidumbre, pantalla del chat | Rol 4 (esquema), Rol 5 (tope de gasto) |
| 3 | **Portal admin** | Login, crear/publicar noticias, procedencia, estados de validación, flujo de imagen con etiqueta de IA | Rol 4 (esquema) |
| 4 | **Datos y relevancia** | Esquema de noticia, Firestore, reglas de ranking, señales de comportamiento, protección contra burbujas | Todos |
| 5 | **Costos, calidad y Responsible AI** | Medidor de gasto y reserva, pruebas, evidencia de ciclos, requerimientos y Done, guion de demo | Todos |

Suplentes sugeridos: 1 ↔ 3 y 2 ↔ 4. El rol 5 pesa mucho en la rúbrica (ciclos de ingeniería, criterios de aceptación y costos son parte central de la presentación), así que no es "papeleo".

> Completar: nombre de la persona en cada rol. Rol 1: ___ · Rol 2: ___ · Rol 3: ___ · Rol 4: ___ · Rol 5: ___

## 8. Plan por etapas (rebanadas completas, no capas aisladas)

Cada etapa termina con algo que funciona de punta a punta y con evidencia guardada en `/docs`.

### Etapa 0 — Cimientos (todos juntos, primeros días)

- [ ] Confirmar por escrito con el profesor que la PWA cuenta como app móvil.
- [ ] Cerrar el esquema de noticia (sección 6) y decidir stack (sección 5).
- [ ] Crear proyecto de Firebase (Auth con Google + Firestore) y dejar el hosting listo.
- [ ] **Prueba mínima**: PWA con login de Google instalada en un iPhone real y en un Android. Si falla en iPhone, se resuelve ahora.
- [ ] Definir requerimientos, criterios de aceptación y definición de Done iniciales (Rol 5) en `/docs`.
- [ ] Configurar el medidor de gasto y el tope antes de la primera llamada a un modelo.

### Etapa 1 — Primera rebanada: portal → feed

- [ ] Portal: login, formulario para crear una noticia con fuentes y estado de validación, botón de publicar.
- [ ] Firestore: la noticia publicada queda guardada con el esquema.
- [ ] PWA: login, selector de ubicación simulada, feed que lee las noticias publicadas.
- [ ] Todo desplegado en la nube (nada corriendo solo en localhost).
- Criterio de salida: una noticia publicada desde el portal aparece en el celular de otra persona, según su ubicación.

### Etapa 2 — Segunda rebanada: chat

- [ ] Endpoint serverless del chat con medición de costo y tope.
- [ ] Recuperación de noticias publicadas relevantes a la pregunta (barata, sin llamar al modelo para recuperar).
- [ ] Respuestas con fuentes citadas y distinción confirmado / incierto / en desarrollo.
- [ ] Pantalla del chat como pantalla inicial.
- Criterio de salida: el chat resume noticias recientes, identifica las de la región simulada, explica una noticia de otro país y dice "no puedo confirmarlo" cuando corresponde.

### Etapa 3 — Tercera rebanada: relevancia, validación e imágenes

- [ ] Ranking por reglas y puntajes + protección contra burbujas (con pruebas que demuestren que una noticia importante no desaparece por preferencias o ubicación).
- [ ] Jerarquía visual del feed (tamaño y posición según relevancia).
- [ ] Flujo de validación completo (fuente insuficiente, fuentes contradictorias, noticia sin confirmar).
- [ ] Flujo de imagen: obtener/generar para noticias sin imagen, con etiqueta visible de IA y campo de origen.
- [ ] Pulido visual y revisión de zonas seguras en iOS.

### Etapa 4 — Ensayo y cierre

- [ ] Ensayo completo de la demo con varios celulares y ubicaciones distintas.
- [ ] Revisión del saldo de créditos y reserva para la presentación.
- [ ] Evidencia de ciclos de ingeniería, tareas cerradas y Done documentadas.
- [ ] Lecciones aprendidas (qué supuestos cambiaron, qué limitaciones quedan, qué haríamos diferente).

## 9. Decisiones pendientes

- [ ] Confirmación por escrito del profesor sobre PWA.
- [ ] Stack definitivo (Next.js vs. otra opción; Firebase Hosting vs. Vercel; dónde corre el endpoint del chat).
- [ ] Qué modelo y proveedor se usa para el chat (el más barato que dé calidad aceptable).
- [ ] Origen de imágenes: libres con atribución, generación con IA, o ambas (y con qué límite de costo).
- [ ] Qué señales de comportamiento se usan para inferir intereses, y cómo se evita que oculten información importante.
- [ ] Fecha de entrega y presentación.

## 10. Formato de la presentación final (la demo es el componente central)

1. Producto y alcance · 2. App móvil (login Google, iPhone y Android, chat, feed, lector, cambio de ubicación) · 3. Publicación en vivo desde el portal (noticias con distinta relevancia geográfica y una sin imagen) · 4. Validación con compañeros en distintas ubicaciones · 5. Chat (recientes, regionales, otros países, fuentes, incertidumbre) · 6. Arquitectura y decisiones · 7. Transparencia y Responsible AI · 8. Engineering loops y gestión · 9. Costos (gasto, saldo, costo por función, ahorros, crédito reservado) · 10. Lecciones aprendidas.

Todo lo que se construya debe poder mostrarse en este orden.

## 11. Cómo queremos que trabaje Claude Code en este repo

- **Desarrollo observable**: el curso evalúa el proceso, no solo el resultado. Trabaja en ciclos cortos: entender → hipótesis → construir → probar → observar → corregir. Cuando algo falle y cambie una decisión, déjalo anotado en `/docs/ciclos.md` (qué se esperaba, qué pasó, qué se cambió y por qué).
- **Pasos pequeños y explicados**: antes de escribir código, di en lenguaje simple qué vas a hacer y por qué. Si un concepto es nuevo, explícalo con una analogía corta. Avanza de a poco, sin reescribir medio proyecto de una vez.
- **Una tarea, un commit** con mensaje claro. Cada tarea cerrada debe tener su criterio de aceptación y su evidencia (captura, test o nota).Tu NO puedes hacer commit ni poner tu co-autoría. Solo el usuario puede hacer commit.
- **Respeta el esquema y los límites del rol**: si una tarea necesita cambiar el esquema de `/packages/shared`, avisa y proponlo en vez de modificarlo en silencio.
- **Nunca** pongas claves de API ni secretos en el código del cliente, ni los subas al repo. Usa variables de entorno.
- **Antes de agregar una llamada a un modelo**, pregunta si se puede resolver con reglas o con una consulta a la base de datos. Anota su costo aproximado en `/docs/costos.md`.
- **No inventes estado de validación**: ni el código ni el modelo deben marcar una noticia como `confirmada` por su cuenta. Eso lo decide una persona en el portal.
- Si algo del enunciado es ambiguo, **pregunta** en lugar de suponer.
