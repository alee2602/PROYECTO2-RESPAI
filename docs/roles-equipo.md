# Roles del equipo — Proyecto 2: AI Assisted News App

Entrega y presentación: **16 de octubre de 2026**.
Stack acordado: PWA · Firebase (solo Auth + Firestore) · Vercel (hosting y endpoint del chat) · TypeScript.

## Asignación

| Rol | Responsable | Suplente |
|---|---|---|
| 1. App (PWA) | ____________ | Rol 3 |
| 2. Chat | ____________ | Rol 4 |
| 3. Portal admin | ____________ | Rol 1 |
| 4. Datos y relevancia | ____________ | Rol 2 |
| 5. Costos, calidad y Responsible AI | ____________ | (apoya a todos) |

## Reglas para todo el equipo

1. **Una tarea, una rama, un PR.** Nadie hace push directo a `main`. Cada PR lo revisa otra persona y enlaza el criterio de aceptación que cierra.
2. **El esquema `Noticia` (`packages/shared/noticia.ts`) no se cambia en silencio.** Quien necesite un cambio lo propone al equipo y al Rol 4 antes de tocarlo.
3. **Ninguna clave de API o secreto en el repo ni en el cliente.** Las claves del modelo viven solo en variables de entorno de Vercel.
4. **Ninguna llamada a un modelo si se resuelve con reglas o una consulta a la base de datos.**
5. **Ni el código ni el modelo marcan una noticia como `confirmada`.** Lo decide una persona desde el portal.
6. **Cada integrante registra al menos un ciclo real de su rol** en `docs/ciclos.md` (qué esperábamos, qué pasó, qué cambiamos y por qué), con evidencia.
7. **Todos presentan.** Cada quien explica y demuestra su parte en la presentación final.

---

## Rol 1 — App móvil (PWA)

**Misión.** Que cualquier compañero abra un link en su iPhone o Android, inicie sesión con Google y vea un feed que se siente distinto según su ubicación simulada.

**Responsabilidades**
- Login con Google (Firebase Auth) en la PWA, con sesión persistente.
- Manifest, íconos e instalación ("Añadir a pantalla de inicio") en iOS y Android; manejo de zonas seguras (notch y barra inferior).
- Selector de ubicación simulada, guardado en el perfil del usuario. La personalización **nunca** usa GPS.
- Feed con jerarquía visual: posición, tamaño y recursos visuales (hero, grande, normal, compacta) según la prominencia que calcula el Rol 4.
- Lector de noticia: título, cuerpo, fuentes, estado de validación y origen de la imagen.
- Distintivos visibles: **Confirmada / En desarrollo / No verificada**; tipo de fuente (original, resumen, IA); y **"Imagen generada por IA"** cuando corresponda.
- Registro de señales de comportamiento (abrir, tiempo de lectura, compartir) y envío a Firestore, de acuerdo con el Rol 4.
- Mostrar en cada tarjeta, de forma breve, por qué aparece (por ejemplo "Ocurre en tu región").

**Entregables por etapa**
- Etapa 0: login probado en Android real (el de iPhone ya está probado) y esqueleto de la PWA desplegado en Vercel.
- Etapa 1: selector de ubicación y feed que lee noticias publicadas desde Firestore.
- Etapa 2: la pantalla del chat (la construye el Rol 2) integrada como pantalla inicial con navegación a feed y lector.
- Etapa 3: jerarquía visual completa, distintivos de validación e imagen, pulido y revisión de zonas seguras en iOS.

**Criterios de aceptación (ejemplos)**
- Una persona nueva instala la PWA desde un link y entra con Google en menos de 2 minutos, en iPhone y Android.
- Dos usuarios con ubicaciones distintas ven un orden y una prominencia distintos para las mismas noticias.
- Ninguna noticia se muestra sin su estado de validación y su procedencia.
- Una imagen generada por IA siempre muestra la etiqueta visible, también en el lector.

**Depende de:** Rol 4 (esquema, ranking, datos), Rol 2 (pantalla del chat), Rol 3 (noticias publicadas).
**Entrega a:** todo el equipo, para la demo en vivo.
**Presenta:** secciones 2 (aplicación móvil) y 4 (validación con compañeros).
**Evidencia a conservar:** capturas en iPhone y Android, video corto de cambio de ubicación, PRs, ciclo de login/instalación.

---

## Rol 2 — Chat de noticias

**Misión.** Que el chat responda sobre las noticias publicadas, cite sus fuentes y diga claramente qué está confirmado y qué no, sin gastar de más.

**Responsabilidades**
- Endpoint serverless en Vercel. La clave del modelo solo vive en el servidor.
- Recuperación de noticias relevantes a la pregunta **sin usar un modelo** (filtros por ubicación, alcance, tema, recencia y búsqueda por palabras clave sobre Firestore).
- Contexto corto: solo las pocas noticias recuperadas, no todas. Respuestas cortas.
- Prompt del sistema que obliga a: responder solo con base en las noticias recuperadas, citar fuentes, distinguir confirmado / en desarrollo / no verificado y decir "no puedo confirmarlo" cuando corresponda.
- Respuesta estructurada: texto, citas (noticia, fuentes, estado) y nota de incertidumbre, para que la app las muestre.
- Pantalla del chat (temporal, sin historial entre sesiones), con las citas visibles y etiqueta de "respuesta generada por IA".
- Cubrir las consultas del enunciado: resumir lo reciente, noticias de la región simulada, explicar una noticia de otro país, novedades de un tema.
- Usar el medidor de gasto del Rol 5 en cada llamada y comportarse bien cuando el tope se alcanza (mensaje claro, no error).

**Entregables por etapa**
- Etapa 1: elegir modelo y proveedor junto con el Rol 5; endpoint de prueba con una pregunta fija.
- Etapa 2: chat completo con recuperación, citas e incertidumbre.
- Etapa 3: casos difíciles (noticia contradictoria, tema sin noticias, intento de que el chat afirme algo no publicado).

**Criterios de aceptación (ejemplos)**
- Toda respuesta que afirma un hecho incluye al menos una cita a una noticia publicada.
- Si la noticia está `en_desarrollo` o `no_verificada`, la respuesta lo dice con claridad.
- Si no hay noticias sobre lo preguntado, el chat lo dice y no inventa.
- Una llamada típica cuesta menos de lo definido con el Rol 5 (anotar el costo real).

**Depende de:** Rol 4 (esquema y consultas), Rol 5 (medidor de gasto y tope).
**Entrega a:** Rol 1 (integración en la app), Rol 5 (costos por función).
**Presenta:** sección 5 (chat).
**Evidencia a conservar:** conversaciones de prueba (buenas y malas), cambios de prompt con su motivo, costo por llamada, PRs.

---

## Rol 3 — Portal administrativo

**Misión.** Que una persona pueda crear, validar y publicar una noticia con procedencia clara, y que el portal empuje a hacerlo con criterio humano.

**Responsabilidades**
- Login con Firebase Auth y restricción de acceso a administradores.
- Formulario de noticia basado en el esquema: título, resumen, cuerpo, fuentes (nombre, URL, tipo: original / resumen / IA), alcance (local / nacional / internacional), país, región, temas.
- Estado de validación (`confirmada`, `en_desarrollo`, `no_verificada`) con nota obligatoria cuando no es `confirmada`: qué falta o qué se contradice.
- Flujo definido para los tres casos del enunciado: **fuente insuficiente, dos fuentes que se contradicen, noticia sin confirmar**. Dejar por escrito qué hace el portal en cada uno (por ejemplo, impedir marcar `confirmada` con una sola fuente o sin una segunda revisión).
- Publicar, editar y actualizar una noticia (`publicadaEn`, `actualizadaEn`).
- Flujo de imagen para noticias sin foto: preferir imágenes libres con atribución; si se genera con IA, `origen: generada_ia` es obligatorio y la etiqueta es visible en la app. Considerar costo, calidad, derechos y riesgo de engaño.
- Aviso en el formulario: ningún texto generado por IA se publica sin revisión humana.

**Entregables por etapa**
- Etapa 1: login, formulario y publicar a Firestore con el esquema completo.
- Etapa 3: flujo de validación con reglas, flujo de imagen con etiqueta y vista previa de cómo se verá en la app.

**Criterios de aceptación (ejemplos)**
- Una noticia publicada desde el portal aparece en el celular de otra persona, según su ubicación.
- No se puede publicar sin al menos una fuente y un estado de validación.
- Una noticia sin imagen recibe una imagen con su origen registrado, y la app muestra la etiqueta correspondiente.
- El estado de validación solo lo cambia un usuario autenticado del portal.

**Decisión para proponer al equipo:** el esquema actual no tiene un estado explícito de "fuentes contradictorias". Hoy se resolvería con `en_desarrollo` o `no_verificada` más `notaValidacion`. Si el equipo prefiere un cuarto estado, se propone y lo aprueba el Rol 4.

**Depende de:** Rol 4 (esquema y reglas de Firestore).
**Entrega a:** Rol 1 y Rol 2 (las noticias que ellos consumen).
**Presenta:** sección 3 (publicación en vivo) y, junto con el Rol 5, la parte de validación e imágenes de la sección 7.
**Evidencia a conservar:** capturas del flujo, ejemplos de cada caso de validación, decisión sobre el origen de imágenes, PRs.

---

## Rol 4 — Datos y relevancia

**Misión.** Que el sistema decida qué noticias mostrar, en qué orden y con qué prominencia para cada usuario, sin llamar a un modelo y sin esconder lo importante.

**Responsabilidades**
- Dueño del esquema `Noticia` y de `packages/shared`. Revisa cualquier cambio propuesto.
- Estructura de Firestore, índices y reglas de seguridad (lectura para usuarios autenticados, escritura de noticias solo para admin, perfil y señales solo del propio usuario).
- **Noticias semilla** para desarrollar y demostrar: 10 a 15 noticias con los tres alcances, al menos dos países, distintos temas, al menos una sin imagen y varias en `en_desarrollo` o `no_verificada`.
- Ranking por reglas y puntajes: coincidencia de ubicación, alcance, recencia, afinidad por temas inferida del comportamiento y ajuste según el estado de validación.
- **Protección anti-burbuja:** en el tope del feed siempre debe haber noticias locales, nacionales e internacionales (si existen), sin importar los intereses del usuario. Cada noticia lleva una explicación de por qué aparece y si entró por esta protección.
- Prominencia por posición (hero, grande, normal, compacta).
- Señales de comportamiento: qué se registra, cómo se convierte en afinidad por tema y cómo se evita que una afinidad desplace noticias importantes.
- Pruebas automáticas del ranking que demuestren que una noticia importante no desaparece por ubicación o preferencias.
- Montar el monorepo (workspaces) para que `apps/mobile`, `apps/admin` y `packages/shared` compartan tipos. (Actualización 2026-10-09: ya no hay carpeta `functions` — el endpoint del chat vive como API route dentro de `apps/mobile`; ver `docs/ciclos.md`.)

**Entregables por etapa**
- Días 1-2 (desbloquea al equipo): monorepo, Firestore, reglas básicas y noticias semilla.
- Etapa 1: consulta de feed simple por ubicación.
- Etapa 3: ranking completo, anti-burbuja, señales y pruebas.

**Criterios de aceptación (ejemplos)**
- Para cada ubicación simulada, el top del feed incluye local, nacional e internacional cuando existen.
- Un usuario muy aficionado a un tema sigue viendo noticias importantes de otros alcances.
- El ranking de todo el feed se calcula sin ninguna llamada a un modelo.
- Los pesos están documentados y cada cambio de peso queda con su motivo.

**Depende de:** Rol 3 (publicación de noticias), Rol 1 (señales desde la app).
**Entrega a:** todos, empezando por los datos y el esquema.
**Presenta:** sección 6 (arquitectura, flujo de datos y relevancia) y apoya la sección 4.
**Evidencia a conservar:** tabla de pesos, salidas del ranking por ubicación, pruebas del anti-burbuja, un ciclo donde un resultado del ranking cambió una decisión.

---

## Rol 5 — Costos, calidad y Responsible AI

**Misión.** Que el equipo pueda demostrar con evidencia que cumplió el presupuesto, probó lo que construyó y respondió las preguntas de transparencia con cosas que se ven en el producto.

**Responsabilidades**
- **Medidor de gasto:** módulo que registra por llamada tokens, costo estimado y gasto acumulado; muestra saldo restante; y **apaga las llamadas antes de agotar el crédito**. Reserva definida para la demo.
- Elegir con el Rol 2 el modelo más barato con calidad aceptable y documentar el costo aproximado por función en `docs/costos.md`, junto con las decisiones que redujeron consumo (caché, contexto corto, recuperación sin modelo, límites por usuario).
- Un solo dueño de la cuenta de API y de la clave; nadie más la usa directamente.
- `docs/`: requerimientos propios, criterios de aceptación, tareas, definición de Done, estrategia de ramas.
- Recoger y ordenar la evidencia de ciclos de ingeniería de todos los roles.
- Plan de pruebas: login en iPhone y Android, ubicaciones distintas, y **casos de desinformación** (noticia con una sola fuente, fuentes contradictorias, noticia sin confirmar, intento de que el chat afirme algo no publicado, imagen generada por IA).
- Documento de transparencia que responda las cinco preguntas del enunciado (importancia y relevancia, fuentes, validación, límites de la IA, imágenes), señalando **dónde se ve cada respuesta** en el portal, el feed y el chat.
- Pedir al profesor la confirmación por escrito de que la PWA es válida.
- Guion y ensayos de la presentación (al menos dos ensayos completos con varios celulares).

**Entregables por etapa**
- Etapa 0: requerimientos, Done, medidor de gasto con tope antes de la primera llamada a un modelo, confirmación del profesor.
- Etapas 1-3: pruebas continuas, `ciclos.md` al día, costos medidos.
- Etapa 4: ensayo, revisión del saldo y guion final.

**Criterios de aceptación (ejemplos)**
- Existe un número visible de gasto acumulado y saldo, y el tope bloquea llamadas en una prueba real.
- Cada tarea cerrada tiene criterio de aceptación y evidencia.
- Cada una de las cinco preguntas de transparencia se puede demostrar en vivo, no solo leer.
- Después del último ensayo queda crédito reservado para la presentación.

**Depende de:** todos (evidencia y mediciones).
**Entrega a:** todos (estructura de pruebas, guion y documentos).
**Presenta:** secciones 1 (producto y alcance), 7 (transparencia y Responsible AI, con aportes de los Roles 2, 3 y 4), 8 (engineering loops y gestión) y 9 (costos).
**Evidencia a conservar:** historial del gasto, tabla de costo por función, plan y resultados de pruebas, documento de transparencia, capturas de ensayos.

---

## Presentación final: quién presenta qué

| Sección | Responsable | Apoyo |
|---|---|---|
| 1. Producto y alcance | Rol 5 | |
| 2. Aplicación móvil | Rol 1 | |
| 3. Publicación en vivo | Rol 3 | |
| 4. Validación con compañeros | Rol 1 | Rol 4 |
| 5. Chat | Rol 2 | |
| 6. Arquitectura y decisiones | Rol 4 | Rol 2 |
| 7. Transparencia y Responsible AI | Rol 5 | Roles 2, 3 y 4 |
| 8. Engineering loops y gestión | Rol 5 | Todos aportan su ciclo |
| 9. Costos | Rol 5 | Rol 2 |
| 10. Lecciones aprendidas | Todos | Una cada uno |
