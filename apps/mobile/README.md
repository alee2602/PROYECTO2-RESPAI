# apps/mobile — PWA (app móvil)

Dueño: Rol 1 (App móvil), apoyado en el ranking que calcula Rol 4. El chat (pantalla + `app/api/chat/`) es de Rol 2.

Stack: Next.js (App Router) + TypeScript, parte del monorepo con npm workspaces. Firebase solo Auth + Firestore. Hosting en Vercel.

Nota: la carpeta se llamaba `apps/app` al scaffoldearla con Next.js, lo que generaba una ruta confusa (`apps/app/app`). Se renombró a `apps/mobile` el 2026-10-09 — ver `/docs/ciclos.md`.

## Pantallas

| Ruta | Qué es | Archivo |
|---|---|---|
| (sin sesión) | Login con Google (`signInWithPopup`) | `components/AuthGate.tsx` |
| (primera vez) | Elegir ubicación simulada | `components/LocationGate.tsx`, `components/LocationPicker.tsx` |
| `/` | Redirige a `/feed`; al abrir la app el **chat** aparece desplegado encima (pantalla inicial) | `app/page.tsx` |
| (todas, salvo ubicación) | **Chat**: hoja que se abre al iniciar y queda como burbuja flotante. El contenido hoy es un placeholder; Rol 2 lo reemplaza | `components/ChatDock.tsx`, `components/ChatPlaceholder.tsx` |
| `/feed` | Portada personalizada con jerarquía visual | `app/feed/page.tsx`, `lib/feed.ts` |
| `/noticia/[id]` | Lector: validación, fuentes, origen de imagen | `app/noticia/[id]/page.tsx` |
| `/ubicacion` | Cambiar ubicación simulada | `app/ubicacion/page.tsx` |

Navegación: el chat se abre/cierra desde la burbuja flotante (`ChatDock`, montado en `app/layout.tsx`); barra superior con volver (`components/TopBar.tsx`) en lector y ubicación.

## Desarrollo local

1. Crear `apps/mobile/.env.local` con los valores de Firebase (plantilla en `.env.example`; los valores los comparte el equipo).
2. Desde la raíz del repo: `npm install`.
3. `npm run dev --workspace=@respai/mobile` y abrir [http://localhost:3000](http://localhost:3000).
4. Antes de abrir un PR: `npm run typecheck --workspace=@respai/mobile`, `npm run test --workspace=@respai/mobile` y `npm run build --workspace=@respai/mobile`.

Si después de cambiar de rama algo se ve "a medias" (estilos nuevos con componentes viejos), detener el servidor, borrar `apps/mobile/.next` y volver a correr `npm run dev`.

## Desplegar en Vercel

La app se despliega como un proyecto de Vercel conectado al repo de GitHub (sin CLI). Se hace una vez:

1. En [vercel.com/new](https://vercel.com/new) → importar el repo `PROYECTO2-RESPAI`.
2. **Root Directory:** `apps/mobile`. Framework: Next.js (lo detecta solo). Dejar activado "Include files outside of the Root Directory" (necesario para `packages/shared` y el `package-lock.json` de la raíz).
3. **Environment Variables:** las 6 `NEXT_PUBLIC_FIREBASE_*` de `.env.example`, para Production y Preview.
4. Deploy. Vercel da una URL tipo `https://<proyecto>.vercel.app`.
5. **Firebase Console → Authentication → Settings → Authorized domains:** agregar ese dominio. Sin esto el login falla con `auth/unauthorized-domain` (la app lo dice en pantalla).
6. Cada push a una rama genera una URL de *preview*; para probar el login en una preview hay que agregar también ese dominio (o probar solo en la URL de producción).

Para la demo, la URL de producción se comparte por link o QR; se instala con "Añadir a pantalla de inicio" (iPhone: Safari → Compartir; Android: Chrome → ⋮ → Instalar app).

## Scripts de una sola vez

- `node scripts/generate-icons.mjs`: íconos PNG de la PWA (`public/icons/`).
- `node --experimental-strip-types scripts/generate-maps.mjs`: mapas de puntos (`lib/maps.generated.ts`) y banderas (`public/flags/`), a partir de `lib/locations.ts`.
