# apps/admin — Portal administrativo

Donde una persona crea, valida y publica las noticias que ve la app. La IA puede asistir, nunca decidir: publicar y elegir el estado de validación lo hace siempre una persona admin.

Dueño: Rol 3 (Portal admin), sobre el esquema de Rol 4 (`packages/shared`).

## Qué hace

| Pantalla | Ruta | Qué se puede hacer |
|---|---|---|
| Inicio | `/` | Resumen (total, publicadas, conteo por estado) y lista de todas las noticias, también borradores, con filtros y etiquetas (estado, Borrador, Sin fuentes, Sin imagen) |
| Nueva noticia | `/nueva` | Formulario completo: contenido, alcance, imagen, fuentes, validación y vista previa. Publicar o guardar como borrador |
| Editar | `/editar/[id]` | El mismo formulario con la noticia cargada. Guardar cambios, publicar, despublicar o borrar |

Solo entran los correos de `lib/admins.ts`, que es espejo de `isAdmin()` en `/firestore.rules`. Si se agrega o quita un admin, hay que cambiar **los dos archivos en el mismo PR**. La seguridad real la ponen las reglas de Firestore; la lista del portal solo decide qué pantalla se ve.

Detalle de las reglas:
- Validación (fuente insuficiente, contradicción, sin confirmar, revisión de textos de IA): `docs/validacion.md`.
- Imagen (Openverse, URL manual, origen y atribución): `docs/imagenes.md`.

## Desarrollo local

1. Copiar `.env.example` a `.env.local` y llenarlo con los valores de Firebase.
2. Desde la raíz del repo: `npm install` (instala todos los workspaces).
3. Desde la raíz: `npm run dev -w @respai/admin`.
4. Abrir [http://localhost:3000](http://localhost:3000). Si `apps/mobile` también está corriendo, Next.js usa otro puerto, como 3001.

Si el navegador muestra una versión vieja después de cambiar de rama, recarga forzando con `Ctrl + Shift + R`.

## Desplegar en Vercel

Mismo proceso que `apps/mobile` (ver su README): un proyecto de Vercel aparte, conectado al mismo repo. Lo hace quien administra Vercel y Firebase (Rol 4), una sola vez:

1. En [vercel.com/new](https://vercel.com/new), importar otra vez el repo `PROYECTO2-RESPAI` como un **proyecto nuevo**, por ejemplo `respainews-admin`.
2. **Root Directory:** `apps/admin`. Framework: Next.js (lo detecta solo). Dejar activado "Include files outside of the Root Directory" (necesario para `packages/shared` y el `package-lock.json` de la raíz).
3. **Environment Variables:** las 6 `NEXT_PUBLIC_FIREBASE_*` de `.env.example`, con los **mismos valores que el proyecto de la app**, para Production y Preview.
4. Deploy. Vercel da una URL tipo `https://<proyecto>.vercel.app`.
5. **Firebase Console → Authentication → Settings → Authorized domains:** agregar ese dominio. Sin esto, el login falla con "Este dominio no está autorizado en Firebase Authentication" (el portal lo dice en pantalla).

No hace falta tocar las reglas de Firestore: el portal escribe con la sesión del admin, igual que en localhost.

**Verificación después del despliegue:**
- Entrar con un correo admin → se ve la lista de noticias.
- Entrar con un correo no admin → "Sin acceso al portal".
- Publicar una noticia de prueba → aparece en la app desplegada. Después, borrarla desde el portal.

## Pruebas

```bash
npm test -w @respai/admin          # reglas: node --test, sin dependencias extra
npm run typecheck -w @respai/admin
npm run build -w @respai/admin
```

Las pruebas cubren las reglas, no la pantalla: validación, fuentes repetidas, contradicción, IA, imagen, medios de referencia y lectura de Openverse.

## Mapa del código

| Archivo | Qué tiene |
|---|---|
| `lib/newsDraft.ts` | **Las reglas.** Estado del formulario, `validateDraft`, diagnóstico de fuentes, conversión formulario ↔ Firestore (`toNewsDoc`, `toNewsUpdate`, `draftFromDoc`) |
| `lib/outlets.ts` | Medios de referencia por país y enlaces de búsqueda a Google Noticias |
| `lib/images.ts` | Búsqueda en Openverse, licencias y atribución |
| `lib/auth.tsx`, `lib/admins.ts` | Sesión con Google y lista de admins |
| `lib/labels.ts` | Textos en español de estados y alcances |
| `components/NewsForm.tsx` | El formulario de crear y editar |
| `components/ImagePicker.tsx`, `NewsPreview.tsx` | Sección Imagen y vista previa en la app |
| `components/NewsList.tsx`, `EditNews.tsx` | Lista del inicio y carga de una noticia para editar |
| `components/AdminGate.tsx`, `AdminHeader.tsx` | Login, "sin acceso" y barra superior |

Los países y regiones vienen de `packages/shared/locations.ts`, la misma lista que usa la app para la ubicación simulada.

**Nota de Next.js:** este proyecto tiene `cacheComponents` activado. Cualquier componente que lea un parámetro de ruta (`useParams`) necesita un `<Suspense>` alrededor; ver `app/editar/[id]/page.tsx`.
