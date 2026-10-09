# apps/admin — Portal administrativo

Login, creación y publicación de noticias, procedencia, estados de validación, flujo de imagen con etiqueta de IA.

Dueño: Rol 3 (Portal admin), apoyado en el esquema de Rol 4.

Stack: Next.js (App Router) + TypeScript, parte del monorepo con npm workspaces (ver `/docs/decisiones-pendientes.md`). Solo los correos en `isAdmin()` de `/firestore.rules` pueden publicar/editar/borrar noticias — agregar ahí el correo de quien tenga este rol.

## Desarrollo local

1. Copiar `.env.example` a `.env.local` y llenar con los valores de Firebase (ver `/.env.example` en la raíz para los mismos valores).
2. Desde la raíz del repo: `npm install` (instala todos los workspaces).
3. `npm run dev` (desde aquí, o `npm run dev --workspace=@respai/admin` desde la raíz).
4. Abrir [http://localhost:3000](http://localhost:3000) (si `apps/mobile` también está corriendo, va a pedir otro puerto, ej. 3001).

`app/page.tsx` ahora mismo es un placeholder que solo confirma login + lectura de Firestore. El formulario real de publicar noticias (procedencia, estado de validación, flujo de imagen) lo construye Rol 3 encima de esto.

Bootstrapped con `create-next-app`; más detalles de Next.js en su [documentación](https://nextjs.org/docs).
