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

## 2026-10-10 — Portal: acceso solo para admins (Rol 3, Etapa 1)

**Se esperaba:** reemplazar el placeholder de `apps/admin` por un acceso real: login con Google, y que solo los correos autorizados del equipo vean el portal.

**Qué pasó:**
- `lib/auth.tsx` centraliza la sesión (mismo método que la PWA, `signInWithPopup`, ver ciclo 2026-09-30) y expone si el correo es admin. `prompt: "select_account"` obliga a elegir cuenta, para poder cambiar de cuenta en la prueba sin cerrar sesión en Google.
- `components/AdminGate.tsx` decide la pantalla: sin sesión → login; con sesión pero sin ser admin → "Sin acceso al portal"; admin → portal. Los errores comunes de login (popup cerrado o bloqueado, sin red, dominio no autorizado) se muestran en español.
- `lib/admins.ts` guarda la lista de correos admin como **espejo** de `isAdmin()` en `firestore.rules`. Esta lista solo decide qué pantalla se ve (UX); la seguridad real la siguen poniendo las reglas de Firestore, que rechazan escrituras en `news` de correos no admin aunque alguien se salte la pantalla.
- La página principal muestra un resumen de la colección `news` (total, publicadas y conteo por estado de validación) como confirmación de que la lectura funciona con sesión admin.

**Prueba (localhost, 2026-10-10):**
- `biancalderon01.15@gmail.com` (admin) → entra y ve el resumen: 13 noticias, 12 publicadas, 8 confirmadas, 2 en desarrollo, 3 no verificadas. Evidencia: `docs/evidencia/acceso-admin.png`.
- `biancalderon15@gmail.com` (no admin) → ve "Sin acceso al portal" con opción de cambiar de cuenta. Evidencia: `docs/evidencia/acceso-denegado.png`.

**Qué se cambió y por qué:** nada respecto al plan. La única decisión de diseño fue duplicar la lista de correos en el cliente en vez de leerla de Firestore: es más simple y no agrega una lectura por login, a cambio de tener que mantener las dos listas sincronizadas (queda anotado en el comentario de `lib/admins.ts`).

**Pendiente:** probar el portal desplegado (no solo localhost). Siguiente rama: `rol3/formulario` (crear noticia con fuentes y estado de validación).

## 2026-10-10 — Portal: formulario para crear y publicar noticias (Rol 3, Etapa 1)

**Se esperaba:** que una persona admin pueda crear una noticia desde el portal con fuentes, alcance geográfico y estado de validación, y que al publicarla aparezca en la app según la ubicación simulada de cada usuario.

**Qué pasó:**
- **Países y regiones compartidos:** el feed compara `country` y `region` como texto exacto, y la lista vivía solo en `apps/mobile/lib/locations.ts`. Se agregó `packages/shared/locations.ts` (solo nombres) para que el portal guarde exactamente los mismos textos que el usuario elige en la app. No cambia el esquema `News` ni toca `apps/mobile`; se avisó al equipo (Rol 1 puede tomar los nombres de ahí más adelante).
- **Reglas separadas de la pantalla** (`apps/admin/lib/newsDraft.ts`), para probarlas sin navegador y reusarlas al editar:
  - `confirmed` exige ≥2 fuentes que no sean IA (`original` o `summary`). Aplica también a borradores: nunca queda guardada una noticia "confirmada" sin evidencia. Una fuente `ai` se muestra al lector pero no cuenta como prueba.
  - `in_progress` y `unverified` exigen `validationNote` (por qué no está confirmada, qué falta o qué se contradice).
  - Publicar exige título, resumen, cuerpo, al menos una fuente, país (salvo internacional) y región (si es local).
  - Firestore no acepta `undefined`: los campos opcionales vacíos no se guardan. Fechas con `serverTimestamp()`, igual que las noticias semilla.
- **Publicar vs. borrador:** "Publicar" guarda con `publishedAt` (la app la muestra); "Guardar borrador" la guarda sin `publishedAt` (la app la ignora, ver `fetchPublishedNews` en `apps/mobile/lib/news.ts`).
- **Pruebas:** 10 pruebas con el test runner nativo de Node (`npm test` en `apps/admin`, mismo patrón que `apps/mobile/lib/ranking.test.ts`), todas pasaron al primer intento. También pasan `tsc --noEmit` y `npm run build`.

**Prueba de punta a punta (2026-10-10):** se publicó desde el portal (localhost) una noticia de prueba local en Guatemala / Petén, estado `unverified`, una fuente `original`, sin imagen. En la app desplegada en Vercel, abierta en un iPhone real con ubicación en Petén, apareció en el primer lugar del feed con "No verificada", "Local · Petén", la fuente marcada "Original" y "Ocurre en tu región (Petén)". Evidencia: `docs/evidencia/formulario-publicada.png`, `docs/evidencia/formulario-en-app.jpeg`.

**Qué se cambió y por qué:** se decidió exigir nota también para `unverified` (la decisión original solo la pedía para `in_progress`), para que la app siempre pueda decir *qué* no se pudo confirmar (CLAUDE.md, restricción 6). Para `international` el país es opcional (vacío = alcance global) y se escribe libre con sugerencias, porque una noticia internacional puede ser de un país que no está entre las ubicaciones elegibles.

**Pendiente:** borrar la noticia de prueba (ID `IgTAEKzgN6FEMGyGRGgr`) desde Firebase Console o, cuando exista, desde la lista del portal. Siguiente rama: `rol3/lista-editar` (ver, editar, publicar borradores y despublicar).
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

## 2026-10-10 — El feed no se actualizaba solo al cambiar de ubicación

**Se esperaba:** que al guardar una nueva ubicación en `/ubicacion` y volver a `/feed` (`router.push`), el feed se recalculara de inmediato con la ubicación nueva.

**Qué pasó:** la usuaria notó que, al cambiar de ubicación, el feed seguía mostrando el orden/etiquetas de la ubicación anterior hasta refrescar la página manualmente. La causa: `apps/mobile/next.config.ts` tenía activadas dos funciones experimentales de Next.js 16 (`cacheComponents`, `partialPrefetching`), activadas por defecto al crear el proyecto con `create-next-app`, no elegidas a propósito. Esas funciones cachean/precargan páginas para que la navegación se sienta más rápida — pero esta app es dinámica y personalizada (ubicación simulada + Firestore en tiempo real), así que el cache estaba sirviendo una versión de `/feed` precargada antes de guardar la nueva ubicación.

**Qué se cambió y por qué:** se desactivaron ambas banderas en `next.config.ts`. Se verificó con `npm run build`: la ruta `/noticia/[id]` pasó de "Partial Prerender" a "Dynamic", confirmando que el cache agresivo ya no aplica.

**Pendiente:** la usuaria debe reiniciar `npm run dev` (los cambios en `next.config.ts` no se recargan solos) y probar de nuevo cambiando de ubicación, para confirmar que el feed ya se actualiza sin refrescar manualmente.

## 2026-10-10 — Las noticias semilla pasan de ficticias a reales (decisión del profesor)

**Se esperaba:** que mantener las noticias ficticias fuera una decisión de diseño razonable y defendible (ver ciclo del 30 de septiembre).

**Qué pasó:** el equipo le preguntó directamente al catedrático si las noticias debían basarse en hechos reales o podían ser ficticias. Respuesta: parte de los requerimientos exige validar la veracidad de las noticias contra otros medios confiables — lo cual solo tiene sentido con contenido real. Se descarta la decisión anterior.

**Qué se cambió:**
- Se buscaron y verificaron (con búsqueda web) 12 noticias reales, cubriendo exactamente las mismas regiones/países que usa `apps/mobile/lib/locations.ts` (Guatemala: Ciudad de Guatemala, Sacatepéquez, Quetzaltenango; más México, España, Estados Unidos, Argentina).
- Varias candidatas iniciales **no pasaron la verificación** y se descartaron: un supuesto fallo judicial mexicano contra Meta (no se encontró el artículo real), una contradicción Banguat-CEPAL (la cifra de CEPAL no se pudo confirmar). Varios intentos de encontrar un caso real de "rumor sin confirmar" tampoco dieron resultado — los medios confiables rara vez publican rumores de forma prominente, y varias páginas tenían fechas inconsistentes (artículos viejos de 2015-2023 apareciendo marcados como 2026).
- En su lugar, se encontraron dos casos **reales** de validación distinta de "confirmed": uno de fuente única (CAIMI de Antigua Guatemala, solo reportado por AGN) y uno de fuentes contradictorias genuino (pronósticos de crecimiento de Argentina: FMI 4%, Goldman Sachs 2.7%, OCDE 2.6%).
- `scripts/seed-news/index.html` se reescribió con las 12 noticias reales (con fuentes y, donde fue posible, links directos al artículo). Se quitaron las imágenes placeholder: para contenido real, una foto genérica como "libre con atribución" sería engañosa. Se agregó un botón "Borrar TODAS las noticias actuales" (con confirmación) para reemplazar limpiamente las 12 ficticias viejas, y se quitó el botón de "corregir datos" anterior (ya no aplica).
- `docs/decisiones-pendientes.md` y `scripts/seed-news/README.md` actualizados.

**Qué se cambió y por qué:** esto corrige una decisión tomada el 30 de septiembre con buena lógica pero sin consultar al profesor — en retrospectiva, "validar veracidad contra otros medios" solo tiene sentido con hechos reales, algo que no se tuvo tan claro al principio. Buen ejemplo de ciclo real de ingeniería: hipótesis razonable → nueva evidencia (respuesta del profesor) → se corrige.

**Pendiente:** correr "Borrar TODAS las noticias actuales" + "Cargar 12 noticias semilla reales" en la herramienta desplegada; el equipo debe revisar los links de las fuentes antes de usarlas en la demo real (verificación fue preliminar, hecha por IA con búsqueda web, no un chequeo editorial humano completo).

## 2026-10-10 — Verificación profunda encuentra 2 errores en el primer set de noticias reales

**Se esperaba:** que el primer set de 12 noticias reales (ciclo anterior) ya estuviera listo, basado en resúmenes de búsqueda web.

**Qué pasó:** al profundizar (abriendo cada artículo completo en vez de confiar en el resumen de la búsqueda), se encontraron 2 errores reales:
- La noticia "AGN alerta sobre videos falsos de funcionarios" resultó ser una campaña de **2021-2022**, no un hecho nuevo de 2026 — la fecha que parecía reciente era de cuándo se capturó la página web, no de publicación.
- La noticia de Argentina afirmaba que el FMI proyectaba 4% y la OCDE 2.6% — al abrir las fuentes citadas, ninguna de las dos cifras aparecía en ningún lado. Solo se pudo confirmar que el Banco Central de Argentina y Goldman Sachs, por separado, bajaron su proyección a 2.7%.

**Qué se cambió y por qué:** se reemplazó la noticia de videos falsos por una verificada de verdad (vicepresidenta Karin Herrera sobre preparación ante la IA, foro HumanIA, confirmada con fecha y cita textual). Se reescribió la de Argentina para afirmar solo lo que las fuentes realmente dicen.

**Por qué importa:** esto demuestra en la práctica por qué "verificación preliminar con resúmenes de búsqueda" no es lo mismo que "verificación completa" — 2 de ~11 noticias revisadas a fondo no se sostuvieron tal como se habían presentado inicialmente. Es evidencia concreta de por qué el chequeo editorial humano sigue siendo necesario antes de usar esto en la demo real, incluso después de que una IA haga una primera pasada de investigación.

**Pendiente:** el equipo debe revisar los links de las 10 noticias restantes que no se abrieron una por una a fondo (solo se verificaron en detalle: CAIMI Antigua, Banguat, Arévalo combustibles, Artemis II, Olinia, Argentina, HumanIA/IA — 7 de 12). Las que faltan por abrir a fondo: Roosevelt (Ciudad de Guatemala), Expoferia del Mueble (Quetzaltenango), lluvias/Conred, elecciones España, café internacional.

## 2026-10-10 — Portal: lista de noticias, editar, despublicar y borrar (Rol 3, Etapa 1)

**Se esperaba:** que desde el portal se puedan ver todas las noticias (también borradores), corregirlas y controlar si la app las muestra, sin tocar Firestore a mano.

**Qué pasó:**
- **Lista en el inicio** (`components/NewsList.tsx`): todas las noticias de `news`, de la más nueva a la más vieja, con filtros Todas / Publicadas / Borradores y etiquetas de estado de validación, "Borrador", "Sin fuentes" y "Sin imagen" (esta última prepara el flujo de imagen). Reusa la misma lectura que ya hacía el resumen: no agrega lecturas a Firestore.
- **Editar** (`/editar/[id]`): reusa el mismo formulario y las mismas reglas de `lib/newsDraft.ts`. Se agregaron `draftFromDoc` (documento → formulario) y `toNewsUpdate` (formulario → cambios para `updateDoc`).
  - Editar no toca `authorId`, `createdAt` ni `image`; agrega `updatedAt`.
  - Un campo opcional que se vació (nota, región, país) se **borra** del documento con `deleteField()`, en vez de quedar con el valor viejo.
  - Si un documento trae datos raros o incompletos, el formulario carga valores seguros: el estado cae a `unverified`, **nunca** se asume `confirmed`.
- **Acciones:** publicar un borrador (pone `publishedAt`), despublicar (borra `publishedAt`: la app deja de mostrarla sin perder nada) y borrar (con confirmación). Guardar cambios de una noticia ya publicada exige la noticia completa porque ya está visible; despublicar no, para poder bajarla rápido.
- **Detalle técnico:** este Next.js tiene `cacheComponents` activado, que exige envolver en `<Suspense>` cualquier componente que lea un parámetro de ruta desconocido en build (`useParams` en `/editar/[id]`). Se revisó en la documentación local de Next (`node_modules/next/dist/docs`) antes de escribirlo; el build compila con la ruta como "Partial Prerender".
- **Pruebas:** 3 pruebas nuevas de edición (13 en total, todas pasan): un opcional vaciado se borra, cargar y volver a guardar no cambia el contenido, y un documento con valores inválidos nunca carga como confirmado. También pasan `tsc` y `npm run build`.

**Prueba de punta a punta (2026-10-10)** con la noticia de prueba del ciclo anterior: se corrigió su título desde el portal y el cambio se vio en la app; al despublicarla desapareció de la app y pasó a "Borrador" en el portal; al volver a publicarla reapareció; al borrarla desapareció de ambos. Evidencia: `docs/evidencia/lista-publicada.png`, `lista-borrador.png`, `editar-acciones-borrador.png`, `lista-sin-borradores.png`.

**Qué se cambió y por qué:** nada respecto al plan. Se dejó fuera a propósito registrar *quién* editó (el esquema solo tiene `authorId`, de quien la creó): agregar un campo así es un cambio de esquema que se propondría al equipo si el flujo de validación (siguiente rama) lo necesita como trazabilidad.

**Pendiente:** siguiente rama `rol3/validacion` (flujo completo: fuente insuficiente, fuentes contradictorias, noticia sin confirmar).

## 2026-10-10 — Portal: flujo de validación para los tres casos del enunciado (Rol 3, Etapa 3)

**Se esperaba:** completar el flujo de validación que pide `docs/roles-equipo.md` (fuente insuficiente, fuentes que se contradicen, noticia sin confirmar), dejarlo por escrito y agregar el aviso de que ningún texto de IA se publica sin revisión humana, sin cambiar el esquema.

**Qué pasó:**
- **Hueco encontrado en la regla anterior:** "2 fuentes que no sean IA" contaba dos artículos del mismo medio como 2 fuentes. Con "Prensa Libre" dos veces, la versión anterior del formulario mostraba "2 de 2" y dejaba confirmar (evidencia: `docs/evidencia/validacion-antes-mismo-medio-contaba-2.png`). Ahora dos fuentes son el mismo medio si coinciden en nombre (sin tildes ni mayúsculas) o en dominio de la URL, y para confirmar hacen falta 2 fuentes **distintas**.
- **Diagnóstico en vivo** en la sección Validación: según las fuentes, muestra el caso (fuente insuficiente / fuentes que se contradicen / fuentes suficientes), bloquea los estados que no corresponden con su razón y sugiere qué escribir en la nota.
- **Contradicción declarada por la persona** (no se detecta sin un modelo): casilla que deja la noticia en `in_progress`, exige 2 fuentes distintas y nota, y se guarda como prefijo `Fuentes contradictorias:` en `validationNote`. Así no se cambia el esquema y la app y el chat la muestran tal cual.
- **Texto de IA:** aviso fijo "Ningún texto generado por IA se publica sin revisión humana"; si hay una fuente `ai`, publicar exige marcar que alguien revisó y editó ese texto (confirmación por guardado, no se guarda).
- **Buscar en otros medios, $0:** enlaces a Google Noticias con el título, filtrado a una lista de medios de referencia del país más agencias internacionales (`apps/admin/lib/outlets.ts`). El portal no consulta nada por su cuenta; la persona lee y agrega la fuente. Si la URL de una fuente es de esa lista, se muestra "Medio de referencia" (que no la vuelve verdadera).
- **Pruebas:** 9 nuevas (22 en total), todas pasan: mismo medio por nombre y por dominio, los tres casos del diagnóstico, contradicción guardada y recuperada como prefijo, revisión de IA, y reconocimiento de medios por dominio (sin falsos positivos como `prensalibre.com.fake.net`).

**Un tropiezo en la prueba manual:** las primeras capturas mostraban la versión anterior del formulario aunque el servidor ya había compilado el código nuevo; la pestaña del navegador se había quedado con la versión vieja. Se resolvió con recarga forzada. Sirvió de evidencia del "antes": ahí se ve el hueco de las fuentes repetidas.

**Prueba (localhost, 2026-10-10):** mismo medio dos veces → "no suma como segunda fuente", 1 de 2, Confirmada bloqueada; fuente de tipo IA → no cuenta y aparece la casilla de revisión; contradicción → En desarrollo, los otros estados bloqueados; Prensa Libre + La Hora → "Fuentes suficientes", Confirmada habilitada pero no marcada sola. Evidencia: `docs/evidencia/validacion-*.png`.

**Qué se cambió y por qué:**
- Se propuso validar veracidad contra otros medios o con IA. Como todavía no hay proveedor ni medidor de gasto (Rol 2 y Rol 5) y CLAUDE.md pide no llamar a un modelo si algo se resuelve sin él, se construyó la búsqueda manual de $0 y se dejó por escrito una **propuesta de asistente con IA** en `docs/validacion.md`. El modelo solo sugeriría enlaces y nunca contaría como prueba. Costo estimado con precios oficiales consultados hoy: ≈ USD 0,022 por consulta con Haiku 5.5 (lo dominan las búsquedas web, a USD 10 por 1.000). La justificación es el ciclo anterior de Rol 4, donde una verificación con IA dejó pasar 2 noticias que no se sostenían.
- La "segunda revisión por otra persona" queda como propuesta: necesitaría un campo nuevo (quién revisó) en el esquema.

**Pendiente:** presentar la propuesta de IA al equipo y a Rol 5. Siguiente rama: `rol3/imagen`.

## 2026-10-10 — Portal: imagen libre con atribución y vista previa (Rol 3, Etapa 3)

**Se esperaba:** que una noticia sin imagen pueda recibir una desde el portal, prefiriendo imágenes libres con atribución, con origen registrado y sin que parezca una foto del hecho; y una vista previa de cómo se verá en la app.

**Qué pasó:**
- **Fuente de imágenes:** antes de escribir código se probó la API de Openverse (indexa Wikimedia Commons, Flickr y otros). Responde desde el navegador (CORS abierto), sin API key ni costo, con URL, autor, licencia y página original. Límite anónimo de 20 búsquedas por minuto y 200 por día, suficiente para el portal. Se usó solo Openverse porque ya incluye Wikimedia.
- **En el formulario:** sección Imagen para buscar una imagen libre o pegar una URL. Al elegir una imagen libre se llenan solos `origin: "free_attributed"` y una atribución con título, autor, licencia, sitio y enlace. Publicar exige atribución para cualquier origen, la URL debe ser `https://`, y un origen desconocido se carga como `ai_generated` (lo más cauto). Editar ahora sí toca `image`: si se quita en el portal, se borra del documento.
- **Riesgo de engaño:** la app (Rol 1) solo aclara "no es una foto del hecho" para `ai_generated`, pero una foto libre tampoco es del hecho. Sin tocar el código de la app, la atribución generada empieza con "Imagen ilustrativa (no es del hecho):", porque la app la muestra tal cual en el lector. Ejemplo de la prueba: se eligió una foto de los volcanes de Sacatepéquez para una noticia de prueba de Petén, donde no hay volcanes. Sin el aviso, el lector podría creer que es del lugar.
- **Vista previa:** aproximación de la tarjeta del feed y del pie de imagen del lector, incluida la etiqueta "Imagen generada por IA" cuando corresponde.
- **Pruebas:** 7 nuevas (29 en total), todas pasan, incluidas las que leen un resultado real de Openverse.

**Prueba de punta a punta (2026-10-10):** se buscó una imagen en el portal y se eligió una de Flickr (CC BY-NC-SA 2.0). El portal llenó origen y atribución y la vista previa coincidió con la app. Al publicar, la noticia apareció en el iPhone (ubicación Petén) con la imagen en el feed. Evidencia: `docs/evidencia/imagen-libre-elegida.png`, `imagen-vista-previa.png`, `imagen-en-app.png`.

**Qué se cambió y por qué:** la imagen elegida tenía licencia no comercial. Se dejó permitido, porque es un proyecto de curso sin fines de lucro, y se anotó en `docs/imagenes.md` cómo filtrar a licencias comerciales si hiciera falta. Se sugiere a Rol 1 mostrar "Ilustrativa" también para `free_attributed`, para que el aviso no dependa del texto de la atribución.

**Pendiente:** cierre del rol (docs y estado técnico) y desplegar el portal en la nube para la demo.

## 2026-10-11 — Ranking pasa a puntaje numérico con pesos documentados (Rol 4, Etapa 3)

**Se esperaba:** poder agregar la afinidad por tema (señales de comportamiento) al ranking. El ranking comparaba criterio por criterio (cercanía, luego validación, luego fecha), así que no tenía dónde "sumar" un criterio nuevo con un peso justificable.

**Qué pasó:**
- `apps/mobile/lib/ranking.ts` ahora calcula un puntaje `cercanía + validación + recencia` con pesos explícitos (`WEIGHTS`) y expone el desglose por noticia (`scoreNews`). El piso anti-burbuja no cambió y se sigue aplicando después del puntaje.
- Los pesos se eligieron para que el orden sea **idéntico** al anterior: cada escalón de un criterio vale más que el máximo de los criterios siguientes. Para comprobarlo no bastaban las 8 pruebas existentes, así que se agregó una que compara el orden nuevo contra una copia del comparador anterior en 300 pools aleatorios con semilla fija (con empates de fecha forzados). También se agregó una prueba de la desigualdad entre escalones y otra del desglose de una noticia. Resultado: 11 de 11 pasan y `tsc` pasa.
- La recencia se calcula contra la noticia más nueva del pool, no contra la hora actual, para que el ranking siga siendo una función pura y repetible en las pruebas.
- `next build` local falló con `auth/invalid-api-key` porque esta copia no tiene `.env.local` (la config de Firebase vive en Vercel). No tiene relación con el cambio: la comprobación del build queda en el preview de Vercel del PR.

**Qué se cambió y por qué:** solo la forma de calcular el orden, no el resultado. Tabla de pesos, motivo de cada número e historial de cambios en `docs/ranking.md` (evidencia que pide el rol: "los pesos están documentados y cada cambio de peso queda con su motivo").

**Pendiente:** rama `rol4/afinidad` para leer `users/{uid}/signals` y sumar la afinidad por tema como un componente más del puntaje, con pruebas de que no desplaza el piso anti-burbuja.

## 2026-10-11 — Afinidad por tema a partir de las señales (Rol 4, Etapa 3)

**Se esperaba:** que el feed use las señales que Rol 1 ya guarda (`open`, `read_time`, `share`) para subir los temas que la persona lee, sin modelo y sin que eso esconda noticias importantes de otros alcances.

**Qué pasó:**
- `apps/mobile/lib/affinity.ts` (puro, sin Firebase) convierte señales en interés por tema: lectura visible con tope de 1 por noticia, `open` sin lectura vale poco (0,2), `share` suma 1, y por tema se satura (`suma / (suma + 2)`) para que una lectura suelta no reordene el feed. `lib/userAffinity.ts` lee las últimas 100 señales, con caché de 5 min.
- En `ranking.ts` la afinidad es un componente más del puntaje: `15 × interés`. **Decisión de peso:** mayor que un escalón de cercanía (10), para que se note, y menor que dos (20), para que un tema favorito de otro país nunca le gane a una noticia de tu país. El piso anti-burbuja se sigue aplicando después.
- Transparencia: si la afinidad aporta 3 puntos o más, la tarjeta agrega "sigues el tema X", y la nota al pie del feed explica la regla.
- Si leer las señales falla, el feed se ordena sin afinidad, como antes, en vez de mostrar un error.
- 13 pruebas nuevas (24 en total), todas pasaron al primer intento. Entre ellas, el criterio de aceptación del rol: un fan extremo de deportes con 8 noticias de deportes de su país sigue viendo la local de su región y la internacional en el top 6, porque entran por el piso anti-burbuja. También hay una prueba de que la afinidad nunca sube dos escalones, ni con interés = 1. `tsc` pasa; `next build` compila y luego falla localmente solo por la falta de `.env.local`, igual que en el ciclo anterior.

**Qué se cambió y por qué:** la equivalencia exacta con el orden anterior ahora solo vale para usuarios sin señales. La afinidad la rompe a propósito, acotada a un escalón, y una prueba nueva fija ese límite. Detalle de pesos y tabla de ejemplos en `docs/ranking.md`.

**Limitación conocida:** con las 12 noticias semilla casi cada tema tiene una sola noticia. Leerla sube *esa misma* noticia, que ya leíste, así que el efecto se demuestra poco. Para la demo hacen falta noticias reales adicionales concentradas en 2 o 3 temas (ya anotado en `docs/decisiones-pendientes.md`).

**Pendiente:** probar en el preview de Vercel con una cuenta que lea 2 o 3 noticias de un mismo tema (más de 1 minuto cada una). Después de 5 minutos, o al recargar la app, el feed debe subirlas y mostrar "sigues el tema ...".

## 2026-10-12 — Lista de admins pasa de código a datos en Firestore

**Se esperaba:** agregar un tercer correo admin (rebe120104@gmail.com) de la misma forma de siempre: escribirlo en `firestore.rules` y `apps/admin/lib/admins.ts`.

**Qué pasó:** la usuaria notó que esos correos (de sus compañeras de equipo) quedaban escritos en texto plano en dos archivos del repo, y que eso no debería estar "a la intemperie" por ser datos personales. Se decidió sacar la lista del código.

**Qué se cambió:**
- `isAdmin()` en `firestore.rules` ya no compara contra una lista escrita ahí — ahora comprueba si existe un documento `admins/{correo}` en Firestore (`exists()`).
- Nueva regla para esa colección: cada quien solo puede leer **su propio** documento (`request.auth.token.email == email`), nunca la lista completa; y nadie puede crear ni borrar documentos desde el cliente (`allow write: if false`) — se administra a mano desde Firebase Console, para que no haya forma de autoasignarse acceso.
- `apps/admin/lib/admins.ts`: `isAdminEmail()` (síncrono, lista en memoria) → `checkIsAdmin()` (async, lee Firestore).
- `apps/admin/lib/auth.tsx`: el estado de "soy admin" ahora depende de una lectura async; se separó `authLoading` de `adminLoading` para que `<AdminGate>` no muestre "sin acceso" un instante antes de que la lectura termine.
- Se desplegaron las reglas nuevas (`firebase deploy --only firestore:rules`) **antes** de este commit — hay una ventana en la que el código viejo (desplegado) convive con las reglas nuevas, documentado abajo.

**Qué se cambió y por qué:** no es un requisito del enunciado, es una mejora de privacidad por iniciativa propia del equipo — evitar que datos personales (correos de compañeros) quedaran en un repo de GitHub sin necesidad, cuando hay una forma igual de simple de lograrlo con datos en vez de código. Beneficio extra: agregar o quitar un admin ya no necesita un commit ni un deploy, solo un documento en Firebase Console.

**Pendiente:** crear a mano los 3 documentos en `admins` (Firebase Console → Firestore → Data) para los 3 correos actuales; subir este código (PR) para que el portal desplegado reconozca el nuevo flujo — hasta que eso pase, el correo nuevo (rebe120104@gmail.com) no puede entrar al portal aunque ya tenga su documento en Firestore, porque el código desplegado todavía usa la lista vieja en memoria.

## 2026-10-12 — Chat, paso 1: recuperación de noticias sin modelo (Rol 2)

**Se esperaba:** empezar el chat por la parte que no depende de nadie (ni proveedor de modelo, ni API key, ni medidor de gasto): elegir qué noticias publicadas responden a una pregunta, sin llamar a un modelo, como pide CLAUDE.md (sección 4).

**Qué pasó:**
- Antes de diseñar se releyó el enunciado (`docs/Proyecto_2_AI_Assisted_News_App.pdf`): pide 4 tipos de consulta (reciente, región simulada, otro país, tema), y la recuperación se diseñó para cubrir esos 4.
- `apps/mobile/lib/retrieval.ts` (puro, sin Firebase): normaliza la pregunta, detecta lugares (con alias como "Xela" y "EE.UU."), "mi región / mi país" según la ubicación simulada y si pide lo reciente; puntúa título, temas, resumen y cuerpo por raíz de 5 letras, y devuelve como máximo 5 noticias, cada una con su "por qué".
- Al releer el código antes de probar se corrigieron 3 detalles: "Estados Unidos" sumaba doble (se detectaba por nombre y por alias), "IA" se descartaba por tener 2 letras, y verbos comunes como "pasa" o "hubo" quedaban como palabras a buscar.
- 16 pruebas con las 12 noticias semilla reales (40 en total en `apps/mobile`), todas pasan, y `tsc` pasa.

**Qué se cambió y por qué:** la decisión clave fue qué hacer cuando la pregunta pide algo que no está publicado. La salida fácil era devolver "lo más reciente" para que el modelo siempre tenga algo; se descartó porque empuja al modelo a responder con noticias que no tienen que ver. En su lugar, la recuperación devuelve 0 noticias más la lista de palabras no encontradas (`unmatchedTerms`). El paso 3 usará eso para decir "no puedo confirmarlo" **sin llamar al modelo**, que además es un ahorro de costo medible. Diseño completo en `docs/chat.md`.

**Pendiente:** paso 2 (contrato de la respuesta) y paso 3 (respuestas sin modelo cuando no hay noticias).
