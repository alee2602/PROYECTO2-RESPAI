# Estado técnico del proyecto (qué ya existe, para no duplicar trabajo)

Última actualización: 2026-10-09, por Rol 1 (login, PWA instalable, ubicación simulada, feed, lector y señales en `apps/mobile`). Si algo de esto cambia, actualizar este documento en el mismo commit que el cambio.

## Resumen

- **Stack confirmado:** Next.js (App Router) + TypeScript, Firebase (solo Auth + Firestore), Vercel (hosting + endpoint del chat). Detalle y porqués en `docs/decisiones-pendientes.md`.
- **Monorepo con npm workspaces**, ya instalado y compilando (`apps/mobile`, `apps/admin`, `packages/shared`).
- **Firestore con reglas reales desplegadas** (no modo de prueba). 12 noticias semilla ya cargadas.
- Instrucciones de clonar/instalar/correr: `README.md` en la raíz.

## Lo que YA existe — no lo vuelvan a crear

| Qué | Dónde | Qué hace |
|---|---|---|
| Conexión a Firebase (Auth + Firestore) | `apps/mobile/lib/firebase.ts`, `apps/admin/lib/firebase.ts` | Ya inicializada y funcionando. Importar `db` y `auth` de ahí, no crear otra instancia. |
| Esquema de noticia | `packages/shared/news.ts` (tipo `News`) | Contrato único entre las 3 partes. Nombres de campos en inglés — ver tabla de equivalencias en `CLAUDE.md` sección 6. No cambiar sin avisar a Rol 4. |
| Reglas de seguridad de Firestore | `/firestore.rules` | Lectura de `news` para cualquier logueado; escritura solo para correos en `isAdmin()`; `users/{uid}` y `users/{uid}/signals` solo accesibles por su propio dueño. Se despliega con `npx firebase-tools deploy --only firestore:rules`. |
| Noticias de prueba | Ya están en Firestore (12 documentos en la colección `news`) | Variedad completa: 3 alcances, 4 países, 7 temas, casos de validación distintos. Tabla completa en `scripts/seed-news/README.md`. No hace falta cargar más para desarrollar. |
| Login con Google | `apps/admin/app/page.tsx` (ya implementado); `apps/mobile/lib/auth.tsx` + `apps/mobile/components/AuthGate.tsx` (ya implementado, Rol 1) | Método decidido: `signInWithPopup` (no redirect). Probado y funcionando en PWA instalada en iPhone real — evidencia en `docs/ciclos.md`, 2026-09-30. En `apps/mobile`, toda la app está detrás de `<AuthGate>` (en `app/layout.tsx`) con sesión persistente; para saber quién está logueado usar `useAuth()` / `useUser()` de `@/lib/auth`, no volver a llamar a `onAuthStateChanged`. |
| PWA instalable (manifest, íconos, zonas seguras) | `apps/mobile/app/manifest.ts`, `apps/mobile/public/icons/`, `viewport`/`appleWebApp` en `apps/mobile/app/layout.tsx` | Instalable con "Añadir a pantalla de inicio" en iOS y Android. Íconos regenerables con `node scripts/generate-icons.mjs` (desde `apps/mobile`). Para respetar el notch y la barra inferior usar las variables CSS `--safe-top`/`--safe-bottom`/`--safe-left`/`--safe-right` de `globals.css`. Sin service worker por ahora (la app necesita red para Firestore de todos modos). |
| Ubicación simulada del usuario | `apps/mobile/lib/locations.ts` (lista de países/regiones), `apps/mobile/lib/profile.tsx` (lee/escribe `users/{uid}`), pantalla `/ubicacion` | Se guarda en `users/{uid}` como `{ location: { country, region | null }, locationUpdatedAt }` (siempre con `merge: true`, así Rol 4 puede agregar otros campos sin chocar). `region: null` = "todo el país". Los textos de país/región coinciden exactamente con los de las noticias semilla; si el portal usa otros, hay que alinearlos en `locations.ts`. En la app, leerla con `useLocation()` / `useProfile()` de `@/lib/profile`. Nunca se usa GPS. |
| Feed con jerarquía visual | `apps/mobile/app/feed/page.tsx`, `apps/mobile/lib/feed.ts`, `apps/mobile/lib/news.ts`, `apps/mobile/components/NewsCard.tsx` + `Badges.tsx` | Lee `news` publicadas (con `publishedAt`), convierte fechas `Timestamp` → texto ISO (las semillas usan `serverTimestamp()` aunque `News` declara `string`) y **oculta** cualquier noticia sin estado de validación válido o sin fuentes (avisa cuántas). Tarjetas hero / grande / normal / compacta, con distintivo de validación, primera fuente + tipo, y "por qué aparece". **Punto de integración para Rol 4:** `rankFeed` en `lib/feed.ts` (tipo `RankFn` → `FeedItem[]` con `prominence`, `reason`, `protectedByDiversity?`). Hoy usa `fallbackFeed`: orden provisional por cercanía a la ubicación + recencia, sin modelo y sin esconder nada. |
| Lector de noticia | `apps/mobile/app/noticia/[id]/page.tsx` | Imagen con su origen y atribución (etiqueta + pie "Ilustrativa: no es una foto del hecho" si es IA), panel de verificación con regla de 3 pasos (No verificada → En desarrollo → Confirmada) y `validationNote` como cita (`components/VerificationPanel.tsx`), cuerpo, lista completa de fuentes con su tipo y enlace, aviso si hay fuente `ai`, temas y "por qué la ves". Botón de compartir (hoja nativa o copia el enlace). Si la noticia no existe, no está publicada o le falta estado/fuente, lo dice en vez de mostrarla incompleta. Barra superior reutilizable: `components/TopBar.tsx`. |
| Señales de comportamiento | `apps/mobile/lib/signals.ts` (escritura + hook `useReadSignals` usado en el lector) | `open`, `read_time` (solo tiempo visible, ≥2 s, ≤30 min) y `share` en `users/{uid}/signals/{autoId}`, con copia de `topics`/`scope`/país/región de la noticia y la ubicación simulada del usuario. Estructura completa y recomendaciones para el ranking en `docs/senales.md`. Sin modelos. |
| Sistema visual de la PWA | `apps/mobile/app/globals.css` | Poppins (titulares) + Inter (texto) vía `next/font`. Colores como variables CSS con modo oscuro. Distintivos con ícono + texto (no solo color). Noticia sin imagen → bloque gráfico por tema, que no parece foto. Imagen con `origin: "ai_generated"` → etiqueta "Imagen generada por IA" encima, siempre. Mapas de puntos (`components/DotMap.tsx`) generados una vez con `node --experimental-strip-types scripts/generate-maps.mjs` (desde `apps/mobile`, usa `dotted-map` solo como devDependency) → `lib/maps.generated.ts`; banderas SVG de `flag-icons` (MIT) en `public/flags/`. Las coordenadas de cada región son fijas en `lib/locations.ts` (nunca GPS). Se usan en el login y en el selector de ubicación. |
| Dónde vive el endpoint del chat | `apps/mobile/app/api/chat/` (carpeta todavía no creada, pero esa es la ruta) | Es una API route de Next.js, no un proyecto de Vercel aparte. La carpeta `/functions` que existía en Etapa 0 se eliminó. |

## Guía rápida por rol

**Rol 1 (App móvil):** reemplazar el placeholder de `apps/mobile/app/page.tsx` con el feed real. El login ya existe (`signInWithPopup`, sesión persistente, guard `<AuthGate>` en el layout). **Sin login, la lectura de `news` va a fallar con "permission denied"** porque las reglas exigen usuario autenticado — no es un bug, es la regla de seguridad funcionando. El selector de ubicación guarda la elección en `users/{uid}` (ver reglas).

**Rol 2 (Chat):** crear `apps/mobile/app/api/chat/`. La recuperación de noticias relevantes se hace con una consulta normal a Firestore (filtros por `scope`, `topics`, etc.), sin modelo. El modelo solo se usa para redactar la respuesta final con las pocas noticias ya filtradas.

**Rol 3 (Portal admin):** reemplazar el placeholder de `apps/admin/app/page.tsx` con el formulario real. El login ya existe ahí, se puede reusar tal cual. Para poder publicar de verdad, tu correo tiene que estar en `isAdmin()` de `/firestore.rules` — pídele a Rol 4 que lo agregue y despliegue.

**Rol 5 (Costos, calidad, RAI):** nada técnico bloqueante todavía. El medidor de gasto se conecta una vez que Rol 2 tenga el endpoint y el modelo elegido.

## Huecos conocidos (no son bugs, son trabajo pendiente)

- El feed usa un orden provisional por ubicación + recencia (`fallbackFeed` en `apps/mobile/lib/feed.ts`). Falta conectar el ranking completo + anti-burbuja de Rol 4 (Etapa 3) cambiando `rankFeed`.
- El endpoint del chat no existe todavía (carpeta `apps/mobile/app/api/chat/` vacía).
- Nadie tiene asignado buscar/redactar contenido para la "Publicación en vivo" de la demo — ver `docs/decisiones-pendientes.md`.
