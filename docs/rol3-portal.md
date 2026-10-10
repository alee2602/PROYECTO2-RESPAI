# Rol 3 — Portal administrativo: cierre

Resumen de lo construido, criterios de aceptación con su evidencia, decisiones, limitaciones y guion para la demo.

- Cómo correrlo y mapa del código: `apps/admin/README.md`.
- Ciclos de ingeniería: `docs/ciclos.md`, entradas del 2026-10-10 marcadas "Rol 3".

## Qué se entregó (un PR por tarea)

| PR | Rama | Qué agregó |
|---|---|---|
| #10 | `rol3/acceso` | Login con Google y pantalla "sin acceso" para correos que no son admin |
| #12 | `rol3/formulario` | Formulario de noticia con fuentes, alcance y estado de validación; publicar o guardar borrador. Lista compartida de países y regiones en `packages/shared/locations.ts` |
| #14 | `rol3/lista-editar` | Lista de noticias con filtros; editar, despublicar y borrar |
| #15 | `rol3/validacion` | Flujo de validación de los tres casos, fuentes distintas, revisión de textos de IA, búsqueda en otros medios; propuesta de asistente con IA |
| (siguiente) | `rol3/imagen` | Imagen libre con atribución (Openverse), URL manual con origen, vista previa en la app |
| (este) | `rol3/cierre` | README, este documento, estado técnico |

## Criterios de aceptación y evidencia

| Criterio (de `docs/roles-equipo.md`) | Cumplido | Evidencia |
|---|---|---|
| Solo los admins entran al portal | ✅ | `docs/evidencia/acceso-admin.png`, `acceso-denegado.png` |
| Una noticia publicada desde el portal aparece en el celular de otra persona, según su ubicación | ✅ | `formulario-publicada.png`, `formulario-en-app.jpeg` (iPhone real, ubicación Petén) |
| No se puede publicar sin al menos una fuente y un estado de validación | ✅ | Prueba automática "no se publica sin fuentes" en `newsDraft.test.ts`; el estado siempre tiene valor |
| Publicar, editar y actualizar una noticia (`publishedAt`, `updatedAt`) | ✅ | `lista-publicada.png`, `lista-borrador.png`, `editar-acciones-borrador.png`, `lista-sin-borradores.png` |
| Nota obligatoria cuando no es `confirmed` | ✅ | Prueba automática "en desarrollo o no verificada exigen nota" |
| Flujo definido para fuente insuficiente, fuentes contradictorias y noticia sin confirmar | ✅ | `docs/validacion.md`; `validacion-fuente-insuficiente.png`, `validacion-contradiccion.png`, `validacion-fuentes-suficientes.png` |
| No se puede marcar `confirmed` con una sola fuente | ✅ | Hacen falta 2 fuentes **distintas** que no sean IA; `validacion-fuentes-ia-y-mismo-medio.png`; la captura del antes es `validacion-antes-mismo-medio-contaba-2.png` |
| Aviso: ningún texto generado por IA se publica sin revisión humana | ✅ | Aviso fijo, más una casilla obligatoria si hay una fuente `ai` (`validacion-fuentes-ia-y-mismo-medio.png`) |
| Una noticia sin imagen recibe una imagen con su origen registrado, y la app muestra la etiqueta correspondiente | ✅ | `imagen-libre-elegida.png`, `imagen-en-app.png`; `docs/imagenes.md` |
| Vista previa de cómo se verá en la app | ✅ | `imagen-vista-previa.png` |
| El estado de validación solo lo cambia un usuario autenticado del portal | ✅ | Reglas de Firestore (`isAdmin()`) más el bloqueo de pantalla del portal |

Pruebas automáticas: **29/29** (`npm test -w @respai/admin`), además de `tsc` y `npm run build`.

## Decisiones (y por qué)

| Decisión | Por qué |
|---|---|
| Contradicción = `in_progress` + nota obligatoria con el prefijo `Fuentes contradictorias:` (sin cuarto estado) | No cambia el esquema; la app y el chat ya muestran `validationNote` |
| `confirmed` exige 2 fuentes **distintas** que no sean IA | La respuesta de un modelo nunca es prueba; dos artículos del mismo medio no se confirman entre sí |
| Nota obligatoria también en `unverified` | Que la app siempre pueda decir *qué* no se pudo confirmar (CLAUDE.md, restricción 6) |
| Verificar contra otros medios con enlaces a Google Noticias ($0), y la IA como propuesta | No hay proveedor ni medidor de gasto todavía. La verificación con IA de Rol 4 dejó pasar 2 noticias que no se sostenían |
| Imágenes libres de Openverse, sin generación con IA | $0, licencias claras, menor riesgo de engaño. La atribución dice "Imagen ilustrativa (no es del hecho)" |
| Países y regiones en `packages/shared/locations.ts` | El feed compara los textos tal cual; una sola lista evita que una noticia "desaparezca" por un typo |
| Reglas en funciones puras (`lib/newsDraft.ts`), separadas de la pantalla | Se prueban sin navegador y las comparten crear y editar |

## Limitaciones conocidas

- **No se registra quién editó** ni hay segunda revisión por otra persona. Necesitaría un campo nuevo (como `reviewedBy`), que es un cambio de esquema a proponer al Rol 4.
- **La lista de admins está duplicada** (`lib/admins.ts` y `firestore.rules`) y hay que mantenerla a mano.
- **La lista de medios de referencia** es un punto de partida, no una certificación.
- **Openverse** tiene un límite anónimo de 200 búsquedas por día, y busca mejor en inglés.
- **La app solo aclara "ilustrativa"** para imágenes de IA. Para imágenes libres, el aviso depende del texto de la atribución (sugerencia hecha a Rol 1).
- La vista previa es una **aproximación** de la tarjeta de la app, no el mismo componente.

## Lecciones aprendidas

- **Las pruebas encontraron lo que el ojo no veía:** la regla de "2 fuentes" contaba dos veces el mismo medio. Se descubrió al pensar los casos de prueba del flujo de validación, no usando la app.
- **Probar el hecho antes de escribir código:** confirmar primero que Openverse respondía desde el navegador, sin key y con licencias, evitó elegir una API que después no sirviera.
- **"Ilustrativa" no es solo cosa de la IA:** una foto libre real también puede engañar si se pone junto a una noticia de otro lugar (la prueba usó volcanes de Sacatepéquez en una noticia de Petén).
- **Probar en la app real, no solo en el portal:** cada rama se cerró viendo la noticia en un iPhone con la app desplegada.

## Guion para la demo (secciones 3 y 7 de la presentación)

**Antes de la demo:**
- [ ] Portal desplegado en la nube, con el dominio autorizado en Firebase Authentication.
- [ ] Borrar las noticias de prueba (PRUEBA, PRUEBA3, PRUEBA4…).
- [ ] Tener listas 3 noticias **reales** para publicar en vivo, con sus fuentes: una local, una nacional o internacional, y **una sin imagen**.
- [ ] Compañeros con la app abierta en ubicaciones distintas.

**Sección 3, publicación en vivo (unos 3 minutos):**
1. Login en el portal y mostrar la lista con sus estados.
2. Crear la noticia local con **una sola fuente**: el portal muestra "Caso: fuente insuficiente" y bloquea "Confirmada". Usar "Buscar en medios de referencia", agregar la segunda fuente y ver cómo cambia a "Fuentes suficientes". Publicar.
3. Pedir a quien está en esa región que la muestre en su celular, y a alguien de otra región que muestre que no le aparece arriba.
4. Crear la noticia sin imagen: buscar una imagen libre, mostrar la atribución "ilustrativa" y la vista previa. Publicar y verla en la app.
5. Abrir una noticia con fuentes que se contradicen: marcar la casilla y mostrar que queda en desarrollo. En la app, la nota empieza con "Fuentes contradictorias:".

**Sección 7, transparencia (puntos a mencionar):**
- El portal nunca confirma solo, y una fuente de IA nunca cuenta como prueba.
- Cada imagen tiene origen y atribución, y la libre se aclara como ilustrativa.
- Despublicar no borra nada; corregir es posible y queda `updatedAt`.
