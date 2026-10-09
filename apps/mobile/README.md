# apps/mobile — PWA (app móvil)

Pantallas: chat de noticias (inicial), feed personalizado, lector de noticia, selector de ubicación simulada.

Dueño: Rol 1 (App móvil), apoyado en el ranking que calcula Rol 4.

Stack: Next.js (App Router) + TypeScript, parte del monorepo con npm workspaces (ver `/docs/decisiones-pendientes.md`). El endpoint del chat también vive aquí, como API route en `app/api/chat/` (ver decisión 2026-10-09 en `/docs/ciclos.md`, carpeta `/functions` eliminada).

Nota: la carpeta se llamaba `apps/app` al scaffoldearla con Next.js, lo que generaba una ruta confusa (`apps/app/app`, la segunda es la carpeta de rutas que exige el App Router). Se renombró a `apps/mobile` el 2026-10-09 — ver `/docs/ciclos.md`.

## Desarrollo local

1. Copiar `.env.example` a `.env.local` y llenar con los valores de Firebase (ver `/.env.example` en la raíz para los mismos valores).
2. Desde la raíz del repo: `npm install` (instala todos los workspaces).
3. `npm run dev` (desde aquí, o `npm run dev --workspace=@respai/mobile` desde la raíz).
4. Abrir [http://localhost:3000](http://localhost:3000).

`app/page.tsx` ahora mismo es un placeholder que solo confirma que Next.js → Firebase → Firestore funciona (lee la colección `news`). El feed real (jerarquía visual, selector de ubicación, login) lo construye Rol 1 encima de esto.

Bootstrapped con `create-next-app`; más detalles de Next.js en su [documentación](https://nextjs.org/docs).
