# Log de ciclos de ingeniería

Formato por ciclo: qué se esperaba, qué pasó, qué se cambió y por qué.

## 2026-09-30 — Arranque de Etapa 0

**Se esperaba:** definir desde cero la estructura del repo y el esquema de noticia antes de escribir código de producto.

**Qué pasó:**
- Se leyó el CLAUDE.md del repo y se comparó contra el enunciado oficial del proyecto. No se encontraron contradicciones; el CLAUDE.md es una interpretación fiel, con decisiones de diseño propias del equipo (esquema de noticia, estados de validación, cupo anti-burbuja) que el enunciado deja abiertas a cada equipo.
- Surgió una instrucción externa (recibida en clase/reunión, no del enunciado) de instalar LM Studio con modelos locales (Qwen, posible "Gemma"/otro ~27B mal transcrito) y usar Ollama/OpenCode. Se confirmó con la usuaria que es solo para pruebas/desarrollo local, no para el endpoint de chat de producción — evita el conflicto con el requisito de backend en la nube (sección 2.5 del CLAUDE.md).
- Se creó la estructura de carpetas sugerida (`/apps/app`, `/apps/admin`, `/packages/shared`, `/functions`, `/docs`) con un README por carpeta.
- Se confirmó el esquema de `Noticia` (sección 6 del CLAUDE.md) y se guardó en `/packages/shared/noticia.ts`, sin cambios respecto al borrador.

**Qué se cambió y por qué:** nada del esquema ni del enunciado se modificó; se documentó el estado de las decisiones pendientes en `/docs/decisiones-pendientes.md` para no perderlas de vista, dado que el equipo todavía no asigna roles ni cierra el stack.

**Pendiente para el próximo ciclo:** asignar roles, decidir stack, crear proyecto de Firebase y probar login de Google en un iPhone real (riesgo conocido de `signInWithPopup`/`signInWithRedirect` en PWA instalada en iOS).

## 2026-09-30 — Setup de Firebase y decisión de hosting

**Se esperaba:** crear el proyecto de Firebase (Auth + Firestore) siguiendo el checklist de Etapa 0, sin necesitar decidir el stack completo todavía.

**Qué pasó:**
- Se creó el proyecto `respai-news-app` en Firebase, plan **Spark** (gratis), sin Google Analytics ni Gemini in Firebase (no aportaban nada al proyecto).
- Se habilitó Google como proveedor de login en Authentication.
- Al configurar Firestore, surgió la pregunta de si el endpoint del chat correría en Cloud Functions de Firebase. Se identificó que Cloud Functions requiere el **plan Blaze** (pago por uso, exige tarjeta de crédito) para poder hacer llamadas salientes a APIs externas — necesario para hablar con el modelo de IA del chat.
- Se decidió separar responsabilidades: **Firebase solo para Auth + Firestore** (se queda en plan Spark, sin tarjeta), y **Vercel para el hosting del frontend y el endpoint serverless del chat** (sí permite llamadas salientes sin plan de pago).

**Qué se cambió y por qué:** se resolvió una de las decisiones pendientes del stack (dónde corre el chat) antes de lo previsto, porque bloqueaba decidir qué tipo de base de datos/plan de Firebase usar. La razón fue puramente de costo/riesgo: evitar poner una tarjeta de crédito en el proyecto cuando hay una alternativa gratuita que cumple lo mismo.

**Pendiente para el próximo ciclo:** terminar de crear Firestore (modo de prueba), registrar la app web en Firebase para obtener la config del cliente, y definir el framework de frontend (Next.js u otro) ahora que el hosting ya es Vercel.

## 2026-09-30 — Prueba de login de Google en iPhone real (riesgo de la sección 5)

**Se esperaba:** que `signInWithPopup` y/o `signInWithRedirect` fallaran dentro de una PWA instalada en iOS, por el bloqueo de almacenamiento entre dominios de Safari que menciona la sección 5 del CLAUDE.md — había que confirmarlo con evidencia antes de construir el resto de la app encima.

**Qué pasó:**
- Se armó una página de prueba desechable (`/pruebas/ios-login/`), sin framework, desplegada en Vercel (`https://ios-login.vercel.app`), con botones separados para probar popup y redirect.
- Se agregó el dominio de Vercel a Authorized domains en Firebase Authentication.
- En Safari normal (sin instalar): login con popup funcionó sin problema (caso base).
- Instalada como PWA en un iPhone real ("Agregar a pantalla de inicio"): **tanto popup como redirect funcionaron** dentro de la app instalada.
- Se cerró la app por completo (no solo minimizada) y se volvió a abrir: la sesión **persistió**, sin pedir volver a iniciar sesión.

**Qué se cambió y por qué:** se descarta el riesgo que tenía más incertidumbre del proyecto. La hipótesis del CLAUDE.md (basada en problemas reportados en otros proyectos) no se cumplió en este caso concreto — posiblemente porque Firebase Auth usa `authDomain` en `firebaseapp.com`, que iOS no trata como "third-party" de la misma forma que un dominio arbitrario. No se cambia nada de la arquitectura planeada; se puede seguir construyendo con `signInWithPopup` o `signInWithRedirect` sin plan de contingencia adicional.

**Pendiente:** repetir esta misma prueba en al menos un Android antes de dar por cerrado el checklist de Etapa 0 (debería funcionar sin complicaciones, pero no se ha probado todavía).

## 2026-10-09 — Reglas reales de Firestore (Rol 4)

**Se esperaba:** reemplazar el modo de prueba abierto de Firestore (dejado así desde el 30 de septiembre) por reglas de seguridad reales, antes de que el equipo empiece a publicar/leer noticias de verdad.

**Qué pasó:**
- Se definió cómo identificar a un "admin" del portal: por correo de Gmail, en una función dentro del propio archivo de reglas (`isAdmin()`), en vez de una lista separada en la consola de Firebase — así queda versionado, revisable por PR y no depende de configuración manual invisible.
- Se escribieron `firestore.rules` (lectura de `noticias` para cualquier usuario logueado, escritura solo para admins; `usuarios/{uid}` y su subcolección `senales` solo accesibles por su propio dueño; todo lo demás cerrado por defecto), más `firebase.json`, `firestore.indexes.json` y `.firebaserc` para poder desplegar con un solo comando.
- Se desplegaron con `firebase deploy --only firestore:rules`. Deploy exitoso.

**Qué se cambió y por qué:** se decidió no usar una colección `admins` en Firestore (que había sido la primera idea) porque requeriría conseguir de antemano el UID de cada admin, algo incómodo de coordinar en equipo. El correo es más fácil de conseguir y de revisar a simple vista en el código.

**Pendiente:** agregar el correo de quien tenga el Rol 3 (portal) a `isAdmin()` en `firestore.rules` en cuanto el equipo lo confirme.
- **Actualización 2026-10-09, tarde:** se agregó el segundo correo admin (Rol 3, confirmado por la usuaria) a `firestore.rules` y se volvió a desplegar. Pendiente resuelto.
- **Actualización 2026-10-09, validación:** se agregaron botones de prueba a `pruebas/ios-login/index.html` (leer `news`, escribir `news`, escribir perfil propio, escribir perfil ajeno) y se probaron con sesión real. Resultado, los 5 casos se comportaron como se esperaba: leer `news` OK (cualquier logueado), escribir `news` OK con correo admin, escribir perfil propio OK, escribir perfil ajeno DENEGADO, escribir `news` con un correo no-admin DENEGADO. Reglas validadas con evidencia real, no solo con que el deploy compiló.

## 2026-10-09 — Esquema de noticia pasa a inglés

**Se esperaba:** mantener el esquema en español, ya que cambiarlo implicaba tocar `packages/shared`, `CLAUDE.md` y `firestore.rules` al mismo tiempo.

**Qué pasó:** la usuaria (Rol 4, dueña del esquema) pidió pasar los nombres de campos a inglés, señalando que **nadie del equipo había empezado a construir sobre el esquema todavía** — el costo de cambiarlo ahora es el más bajo que va a ser nunca, y solo iba a subir con el tiempo. Se aceptó el argumento y se hizo el cambio:
- `packages/shared/noticia.ts` → `packages/shared/news.ts` (tipo `News`, campos en inglés, con un comentario de mapeo español↔inglés para quien lea el código).
- `firestore.rules`: colecciones `noticias`→`news`, `usuarios`→`users`, `senales`→`signals`. Redesplegado.
- `CLAUDE.md` sección 6: se actualizó el bloque de tipo y se agregó una tabla de equivalencias, para que la documentación (que sigue en español) y el código no queden desincronizados.

**Qué se cambió y por qué:** se revirtió la recomendación inicial (mantener español) ante el argumento de costo-beneficio de la usuaria, que es correcto: el esquema efectivamente no tenía ningún consumidor todavía (Roles 1, 2 y 3 no habían empezado). Si se hubiera esperado más, el cambio habría sido mucho más caro.

**Pendiente:** avisar al equipo (sobre todo a quien tenga los Roles 1 y 3, que van a consumir este esquema pronto) que los nombres de campos están en inglés, con la tabla de equivalencias de `CLAUDE.md` como referencia.

## 2026-10-09 — Se elige popup sobre redirect para el login

**Se esperaba:** dado que ambos métodos funcionaron en la prueba de iPhone (ver ciclo del 30 de septiembre), no había necesidad técnica de elegir uno — cualquiera serviría.

**Qué pasó:** la usuaria (Rol 1 sería quien construya el login real, pero la decisión se tomó aquí con Rol 4) prefirió fijar `signInWithPopup` como el método que va a usar la app, dejando `signInWithRedirect` solo documentado como alternativa de respaldo. Se actualizó `pruebas/ios-login/index.html` y su README para reflejar esto (etiquetas de los botones, nota de resultado).

**Qué se cambió y por qué:** popup es más simple de implementar — con redirect hay que leer `getRedirectResult()` al cargar la página (la navegación saca al usuario de la app y vuelve), lo que complica el código y el manejo de estado, sin ninguna ganancia ya que popup funcionó sin problema en la prueba real. Queda el redirect documentado por si algún navegador específico bloqueara el popup más adelante.

**Pendiente:** cuando se construya el login real de la PWA (Rol 1), usar `signInWithPopup` como implementación principal.

## 2026-10-09 — Monorepo montado (Next.js + npm workspaces)

**Se esperaba:** montar `apps/app`, `apps/admin`, `packages/shared` como workspaces que comparten tipos, una vez confirmado Next.js con el equipo.

**Qué pasó:**
- `package.json` raíz con `"workspaces": ["apps/*", "packages/*"]` (npm workspaces, sin herramienta extra).
- `apps/app` scaffoldeado con `create-next-app` (Next.js 16, App Router, TypeScript, sin ESLint/Tailwind por ahora).
- `packages/shared` convertido en paquete real (`@respai/shared`, `index.ts` que reexporta `news.ts`), consumido desde `apps/app` vía `transpilePackages` en `next.config.ts` (sin paso de build aparte para el paquete compartido).
- Cliente de Firebase (`apps/app/lib/firebase.ts`) y variables de entorno con prefijo `NEXT_PUBLIC_` (requerido por Next.js para exponerlas al navegador).
- `app/page.tsx` reemplazado por un placeholder que lee la colección `news` de Firestore, para confirmar que toda la cadena Next.js → Firebase → Firestore funciona. No es el feed final (eso es de Rol 1).
- `npm run build` corrido y exitoso después de un error menor (extensión `.ts` en un import de `packages/shared/index.ts`).
- Se encontró y arregló un bug de configuración: el `.gitignore` que genera `create-next-app` dentro de `apps/app` ignoraba también `.env.example` (no debería, ese archivo sí se sube). Se agregó la excepción, igual que en el `.gitignore` raíz.
- **Decisión sobre `functions/`:** el endpoint del chat vive como API route dentro de `apps/app` (`app/api/chat/`), no como proyecto de Vercel aparte — un solo proyecto que desplegar y configurar, y el chat está pegado al frontend de todos modos. La usuaria **eliminó la carpeta `functions/`** en consecuencia.
- Se registra también: `npm audit` marca 4 vulnerabilidades "high" en `@grpc/grpc-js` (dependencia transitiva de `firebase`/Firestore). La única corrección automática implica bajar a `firebase@9.14.0` (regresión de varios años), así que no se aplicó. El riesgo real es bajo para este proyecto (aplica a configuraciones de mTLS del lado servidor, no al uso típico del cliente en el navegador).

**Qué se cambió y por qué:** se revirtió sobre la marcha la estructura original de `/functions` (pensada para Cloud Functions de Firebase en el CLAUDE.md inicial) porque ya no aplica tras decidir Vercel + Next.js para todo. Se avisa al equipo (sobre todo a quien tenga el Rol 2) para que no construya nada ahí.

**Pendiente:** scaffoldear `apps/admin` igual que `apps/app`; probar `npm run dev` localmente; avisar al equipo del cambio de `functions/`.

## 2026-10-09 — `apps/app` se renombra a `apps/mobile`

**Se esperaba:** que el nombre de la carpeta (`apps/app`) no generara confusión al trabajar en el proyecto.

**Qué pasó:** al ver el árbol de archivos en el editor, la carpeta del App Router de Next.js (que el framework exige llamar literalmente `app/`) quedaba anidada como `apps/app/app`, visualmente confusa. Se renombró la carpeta externa a `apps/mobile` (y el paquete de npm de `@respai/app` a `@respai/mobile`).

**Qué se cambió y por qué:**
- `apps/app/` → `apps/mobile/` (y su `package.json`, `name`).
- Se borró `package-lock.json` y `node_modules` (raíz y del paquete) y se corrió `npm install` de nuevo para que los workspaces de npm reconecten con la nueva ruta.
- Se verificó `npm run build` otra vez — compila igual que antes del cambio.
- Se actualizaron las referencias a `apps/app` en `CLAUDE.md`, `docs/roles-equipo.md`, `docs/decisiones-pendientes.md` y `apps/mobile/README.md`.

No cambia nada funcional, es un cambio de nombre para legibilidad del equipo. La carpeta interna `apps/mobile/app/` (la de rutas de Next.js) se mantiene — esa la exige el framework, no se puede renombrar.

**Pendiente:** si alguien ya había clonado el repo antes de este commit, necesita borrar su `node_modules` local y correr `npm install` de nuevo.

## 2026-10-09 — `apps/admin` scaffoldeado

**Se esperaba:** repetir el mismo proceso que `apps/mobile` para el portal (Next.js, workspace `@respai/admin`, cliente de Firebase, `transpilePackages` para `@respai/shared`).

**Qué pasó:** se armó sin sorpresas, reutilizando el patrón ya resuelto. `app/page.tsx` es un placeholder con botón de login (popup) y lectura de la colección `news`, para confirmar la cadena completa antes de que Rol 3 construya el formulario real de publicación. `npm run build` exitoso.

**Qué se cambió y por qué:** nada distinto al plan — se documenta este ciclo principalmente por la evidencia (rúbrica, sección 8), no porque algo fallara.

**Pendiente:** cuando se confirme quién tiene el Rol 3, agregar su correo a `isAdmin()` en `firestore.rules` (ya está ahí el de Mónica y Bianca); Rol 3 construye el formulario real de noticias sobre este placeholder.

## 2026-10-09 — Noticias semilla cargadas

**Se esperaba:** cerrar el último entregable de "Días 1-2" de Rol 4 (monorepo y Firestore ya estaban listos) con 10-15 noticias de ejemplo para desbloquear a Roles 1, 2 y 3.

**Qué pasó:** se armó `scripts/seed-news/` (herramienta de un solo uso, mismo patrón que `pruebas/ios-login`: HTML sin framework, login con Google, escritura por el SDK de cliente — respeta las reglas de Firestore reales, sin atajos de admin SDK). 12 noticias ficticias pero realistas, con la variedad exigida: 3 alcances, 4 países distintos en internacional, 7 temas, casos de fuente insuficiente, fuentes contradictorias y fuente única no oficial, y 3 noticias sin imagen. Desplegado a Vercel y corrido con sesión admin real — resultado: 12 creadas, 0 fallidas.

**Qué se cambió y por qué:** se descartó usar el Admin SDK de Firebase (que hubiera requerido generar y proteger una clave de servicio nueva) a favor de reusar el cliente ya autenticado como admin — menos superficie de secretos que manejar, y además sirve como una prueba más de que las reglas de Firestore funcionan en un caso real de carga masiva.

**Qué queda cerrado:** con esto, los tres entregables "Días 1-2" de Rol 4 en `docs/roles-equipo.md` están completos: monorepo, Firestore con reglas reales, y noticias semilla.

**Pendiente:** verificar en `apps/mobile` (con `npm run dev`) que el placeholder ahora muestra las 12 noticias cargadas, como confirmación visual de punta a punta.

## 2026-10-10 — Ranking real por ubicación + protección anti-burbuja (Rol 4, Etapa 1)

**Se esperaba:** reemplazar `fallbackFeed` (orden provisional que Rol 1 dejó como placeholder en `apps/mobile/lib/feed.ts`) por el ranking real de Rol 4: ubicación + recencia, sin modelo.

**Qué pasó:**
- Se implementó `rankNewsByLocation` en `apps/mobile/lib/ranking.ts`, deliberadamente sin depender de `lib/feed.ts` ni `lib/news.ts` (que inicializa Firebase) para que el módulo sea puro y se pueda probar con `node --test` sin arrastrar nada más.
- Primer intento del piso anti-burbuja tenía un bug: al promover cada alcance faltante (local/nacional/internacional) a la misma posición fija de la ventana protegida, el segundo alcance insertado empujaba al primero fuera de esa ventana. **Las pruebas automáticas lo encontraron de inmediato** (`lib/ranking.test.ts`, caso "el top del feed incluye local, nacional e internacional cuando existen los tres" falló). Se corrigió calculando qué alcances faltan una sola vez contra la ventana original, y promoviendo todos juntos en una sola inserción.
- 4 pruebas con el test runner nativo de Node (`node --experimental-strip-types --test`, cero dependencias nuevas, mismo patrón que ya usaba `scripts/generate-maps.mjs` de Rol 1): el top incluye los 3 alcances cuando existen, no se pierde ninguna noticia, el orden por cercanía+recencia es correcto, y no revienta si un alcance no existe en el pool.
- Para que TypeScript aceptara los imports con extensión `.ts` que exige la resolución nativa de módulos de Node, se agregó `"allowImportingTsExtensions": true` al `tsconfig.json` de `apps/mobile` (ya tenía `noEmit: true`, requisito para esa opción). `npm run typecheck` y `npm run build` se corrieron después del cambio para confirmar que no se rompió nada.
- `rankFeed` en `lib/feed.ts` ahora arma el `FeedItem[]` final usando `rankNewsByLocation`, sin crear un import circular entre `feed.ts` y `ranking.ts`.

**Qué se cambió y por qué:** el diseño original tenía un bug real de lógica (no de sintaxis ni de tipos) que ni el build ni el typecheck hubieran detectado — exactamente el tipo de error para el que sirven las pruebas automáticas que pedía el criterio de aceptación del rol ("pruebas que demuestren que una noticia importante no desaparece por ubicación o preferencias").

**Pendiente:** afinidad por tema a partir de señales de comportamiento (`docs/senales.md`), sin desplazar el piso anti-burbuja — Etapa 3. Abrir PR en rama `rol4/ranking-ubicacion` y conseguir aprobación de alguien del equipo (branch protection activo desde el 2026-10-09).

## 2026-10-10 — Desempate por validación en el ranking (encontrado probando con datos reales)

**Se esperaba:** que la decisión original de "la validación nunca afecta el orden" fuera suficiente.

**Qué pasó:** probando la app desplegada en Vercel con las 12 noticias reales y la ubicación "California, Estados Unidos", la noticia hero resultó ser la única de fuente única sin confirmar ("Reportes no confirmados sobre nueva política de privacidad..."), porque era la única noticia con `country: "Estados Unidos"` — ganó por cercanía sin ninguna competencia, no por ser importante. La usuaria lo notó directamente en la app desplegada, no en una prueba.

**Qué se cambió y por qué:** se agregó un desempate secundario en `apps/mobile/lib/ranking.ts`: entre noticias con el mismo puntaje de cercanía, gana la más confirmada (`confirmed` > `in_progress` > `unverified`). Esto **no** es un filtro — una noticia no verificada sigue apareciendo siempre que exista en el pool, solo deja de ganarle a algo igual de relevante y mejor sustentado por pura casualidad. Se agregó una quinta prueba automática (`ranking.test.ts`) que reproduce exactamente este caso.

**Pendiente:** ninguno nuevo — la rama `rol4/ranking-ubicacion` sigue abierta, este cambio se suma al mismo PR antes de que lo aprueben.

## 2026-10-10 — La etiqueta Local/Nacional/Internacional pasa a ser relativa al usuario

**Se esperaba:** que `scope` (el dato guardado en cada noticia) fuera suficiente para mostrar directamente en la tarjeta.

**Qué pasó:** la usuaria, probando la app desplegada con ubicación "California, Estados Unidos", notó que una noticia de EE.UU. decía "Internacional" y una de Guatemala decía "Nacional" — al revés de lo intuitivo para alguien ubicado en EE.UU. Al indagar, el primer intento de arreglo (cambiar el dato guardado de México/España/EE.UU. de `international` a `national`) tampoco la convenció. La pregunta correcta resultó ser otra: como el usuario puede cambiar de ubicación simulada en cualquier momento, la etiqueta visible **tiene que cambiar con él** — la misma noticia de España debe verse "Nacional" si simulas estar en España, e "Internacional" si simulas estar en cualquier otro país.

**Qué se cambió:**
- `scope` (el dato guardado) se queda como estaba: describe el alcance propio de la noticia, lo sigue usando el ranking para la protección anti-burbuja.
- Se agregó `displayScope(noticia, ubicación)` en `apps/mobile/lib/ranking.ts` (módulo puro, mismo criterio que el resto): calcula la etiqueta a mostrar comparando el país/región de la noticia contra la ubicación actual del usuario. `FeedItem` ahora incluye `displayScope`; `NewsCard` y el lector (`noticia/[id]`) lo usan en vez del dato crudo.
- 3 pruebas automáticas nuevas (8 en total en `ranking.test.ts`), incluyendo el caso exacto de España visto desde España/Guatemala/EE.UU.
- Además, se corrigieron 3 noticias semilla que tenían `scope: "international"` cuando su alcance propio real es `national` (México, España, EE.UU. — cada una es noticia doméstica de su propio país). Se agregó un botón "Corregir datos ya cargados" en `scripts/seed-news/index.html` para parchar los documentos que ya estaban en Firestore sin crear duplicados.

**Por qué importa:** esto es relevancia personalizada de verdad — la misma noticia, vista distinto según quién la ve, sin usar ningún modelo. Buen ejemplo para la sección de arquitectura y decisiones de la demo.

**Pendiente:** correr el botón "Corregir datos ya cargados" en la app desplegada (la usuaria lo hará); verificar visualmente con `npm run dev` cambiando de ubicación entre Guatemala/España/EE.UU.
