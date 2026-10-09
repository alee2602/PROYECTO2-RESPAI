# Estado técnico del proyecto (qué ya existe, para no duplicar trabajo)

Última actualización: 2026-10-09, por Rol 4. Si algo de esto cambia, actualizar este documento en el mismo commit que el cambio.

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
| Login con Google | `apps/admin/app/page.tsx` (ya implementado); `apps/mobile` (todavía NO) | Método decidido: `signInWithPopup` (no redirect). Probado y funcionando en PWA instalada en iPhone real — evidencia en `docs/ciclos.md`, 2026-09-30. |
| Dónde vive el endpoint del chat | `apps/mobile/app/api/chat/` (carpeta todavía no creada, pero esa es la ruta) | Es una API route de Next.js, no un proyecto de Vercel aparte. La carpeta `/functions` que existía en Etapa 0 se eliminó. |

## Guía rápida por rol

**Rol 1 (App móvil):** reemplazar el placeholder de `apps/mobile/app/page.tsx` con el feed real. Agregar el login (todavía no existe ahí — copiar el patrón de `apps/admin/app/page.tsx` o de `pruebas/ios-login/index.html`, con `signInWithPopup`). **Sin login, la lectura de `news` va a fallar con "permission denied"** porque las reglas exigen usuario autenticado — no es un bug, es la regla de seguridad funcionando. El selector de ubicación guarda la elección en `users/{uid}` (ver reglas).

**Rol 2 (Chat):** crear `apps/mobile/app/api/chat/`. La recuperación de noticias relevantes se hace con una consulta normal a Firestore (filtros por `scope`, `topics`, etc.), sin modelo. El modelo solo se usa para redactar la respuesta final con las pocas noticias ya filtradas.

**Rol 3 (Portal admin):** reemplazar el placeholder de `apps/admin/app/page.tsx` con el formulario real. El login ya existe ahí, se puede reusar tal cual. Para poder publicar de verdad, tu correo tiene que estar en `isAdmin()` de `/firestore.rules` — pídele a Rol 4 que lo agregue y despliegue.

**Rol 5 (Costos, calidad, RAI):** nada técnico bloqueante todavía. El medidor de gasto se conecta una vez que Rol 2 tenga el endpoint y el modelo elegido.

## Huecos conocidos (no son bugs, son trabajo pendiente)

- `apps/mobile` no tiene login todavía (lo construye Rol 1).
- El feed no tiene lógica de ranking/ubicación todavía — Rol 4 está construyendo una consulta simple por ubicación para Etapa 1 (ranking completo + anti-burbuja es Etapa 3).
- El endpoint del chat no existe todavía (carpeta `apps/mobile/app/api/chat/` vacía).
- Nadie tiene asignado buscar/redactar contenido para la "Publicación en vivo" de la demo — ver `docs/decisiones-pendientes.md`.
