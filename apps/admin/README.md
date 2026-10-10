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
