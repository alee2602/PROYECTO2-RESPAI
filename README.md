# RespAI News — Proyecto 2 (Responsible AI)

App de noticias personalizadas con portal administrativo. Contexto completo del proyecto, principios de Responsible AI y restricciones en [`CLAUDE.md`](./CLAUDE.md) — léanlo antes de tocar código.

## Estructura del repo

```
/apps/mobile     → la PWA (chat, feed, lector, selector de ubicación) — Next.js
/apps/admin      → el portal administrativo (login, publicar noticias) — Next.js
/packages/shared → esquema de noticia (News), tipos, reglas de ranking
/firestore.rules → reglas de seguridad de Firestore (Rol 4)
/scripts         → herramientas de un solo uso (ej. cargar noticias semilla)
/pruebas         → pruebas desechables de Etapa 0 (ej. login en iOS)
/docs            → roles del equipo, decisiones, log de ciclos de ingeniería
```

Monorepo con **npm workspaces** (no hace falta pnpm ni yarn). Stack: Next.js (App Router) + TypeScript + Firebase (Auth + Firestore) + Vercel (hosting y endpoint del chat).

## Clonar y correr por primera vez

1. Clonar el repo e instalar todo desde la raíz (instala las 3 carpetas de una vez: `apps/mobile`, `apps/admin`, `packages/shared`):
   ```bash
   npm install
   ```
2. Pedir a alguien del equipo y crear un archivo `.env.local` **dentro de `apps/mobile`**

   Repetir el mismo archivo (mismo contenido) **dentro de `apps/admin`**. 
   
3. Correr la app que les toque:
   ```bash
   npm run dev --workspace=@respai/mobile   # PWA, http://localhost:3000
   npm run dev --workspace=@respai/admin    # Portal, http://localhost:3000 (o 3001 si la otra ya está corriendo)
   ```
   (También se puede entrar a la carpeta de la app y correr `npm run dev` directo ahí.)

## Nota de seguridad sobre las keys de Firebase

El bloque de arriba (`apiKey`, `authDomain`, etc.) **no es secreto** — Firebase lo diseñó para ir en el código del cliente, la seguridad real la dan las [reglas de Firestore](./firestore.rules), no ocultar esta config. Se puede compartir por WhatsApp/Discord sin problema.

Lo que **sí** es secreto y nunca va en el repo ni en el cliente: la API key del modelo de IA para el chat (vive solo en variables de entorno de Vercel, del lado del servidor). Ver sección 11 de `CLAUDE.md`.

## Publicar noticias / acceso de admin

Solo los correos listados en `isAdmin()` dentro de [`firestore.rules`](./firestore.rules) pueden publicar, editar o borrar noticias. Si necesitas probar el portal admin, pide que agreguen tu correo ahí (Rol 4 lo despliega con `npx firebase-tools deploy --only firestore:rules`).

## Dónde encontrar qué

- **Qué ya está construido y qué no duplicar**: [`docs/estado-tecnico.md`](./docs/estado-tecnico.md) — léanlo antes de empezar a programar su parte
- **Quién hace qué y con qué criterios de aceptación**: [`docs/roles-equipo.md`](./docs/roles-equipo.md)
- **Qué está decidido y qué sigue pendiente**: [`docs/decisiones-pendientes.md`](./docs/decisiones-pendientes.md)
- **Historial de ciclos de ingeniería (para la rúbrica)**: [`docs/ciclos.md`](./docs/ciclos.md)
- **Esquema de noticia compartido**: [`packages/shared/news.ts`](./packages/shared/news.ts)
