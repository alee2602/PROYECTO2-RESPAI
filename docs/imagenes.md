# Flujo de imagen para noticias sin foto (portal, Rol 3)

Decisión del 2026-10-10: **buscador de imágenes libres + URL manual. Sin generación con IA.**

Código: `apps/admin/lib/images.ts` (con pruebas en `images.test.ts`), `components/ImagePicker.tsx` y `components/NewsPreview.tsx`.

## Qué hace el portal

En la sección **Imagen** del formulario, una noticia sin imagen tiene dos caminos:

1. **Buscar imagen libre.** Busca en [Openverse](https://openverse.org), que indexa Wikimedia Commons, Flickr y otros, y trae solo imágenes con licencia Creative Commons o de dominio público. Al elegir una, el portal llena solo:
   - `origin: "free_attributed"`
   - `attribution`: `Imagen ilustrativa (no es del hecho): "título", de autor (licencia), vía Wikimedia Commons. <enlace a la página original>`
2. **Pegar URL.** Para una foto real del hecho publicada por una de las fuentes (`real_photo`, con crédito como "Foto: AGN"), o una imagen que alguien trae hecha con IA (`ai_generated`).

En todos los casos:

- El **origen** es obligatorio, y lo elige y corrige una persona.
- **Publicar exige atribución.** También para imágenes de IA: con qué herramienta y quién la generó.
- La URL debe ser `https://`.
- Si un documento trae un origen desconocido, el portal lo carga como `ai_generated`, que es lo más cauto, hasta que una persona lo corrija.
- **Sin imagen también es válido.** La app muestra un bloque gráfico con el tema, que no se confunde con una foto.

La **vista previa** al final del formulario muestra cómo se verá la tarjeta en la app y el pie de imagen del lector, antes de publicar.

## Por qué así

| Criterio | Imagen libre (Openverse) | Generar con IA |
|---|---|---|
| **Costo** | $0, sin API key. Límite anónimo de 20 búsquedas por minuto y 200 por día | Gastaría crédito de los USD 20 compartidos con el chat |
| **Derechos** | Licencia clara (CC, dominio público), con autor y enlace en la atribución | Derechos menos claros según la herramienta |
| **Riesgo de engaño** | Bajo si se aclara que es ilustrativa | Alto: puede parecer una foto del hecho |
| **Calidad** | Fotos reales de lugares y temas; mejores resultados en inglés | Alta, pero inventada |

**Riesgo de engaño con imágenes libres:** una foto libre casi nunca es del hecho. Es una foto genérica del lugar o del tema, por ejemplo del volcán de Fuego en otro año. Rol 4 ya lo había advertido en su ciclo de noticias reales. Por eso la atribución generada **empieza con "Imagen ilustrativa (no es del hecho):"**. Como la app muestra la atribución tal cual en el lector, el aviso llega al lector sin cambiar el código de la app.

**Sugerencia para Rol 1:** hoy la app solo muestra "Ilustrativa: no es una foto del hecho" para `ai_generated`. Podría mostrarlo también para `free_attributed`, para que no dependa del texto de la atribución.

**Licencias no comerciales:** Openverse también trae imágenes CC BY-NC (no comercial). En la primera prueba salió una CC BY-NC-SA 2.0 de Flickr. Para un proyecto de curso sin fines de lucro se pueden usar con su atribución. Si el proyecto saliera de ese uso, habría que filtrar la búsqueda a licencias comerciales (`license_type=commercial` en la API de Openverse).

## Imágenes generadas con IA

El portal **no** genera imágenes. Si alguien trae una:

- Debe marcarla como `ai_generated`. La app muestra la etiqueta "Imagen generada por IA" encima de la imagen y aclara en el lector que es ilustrativa.
- Debe escribir en la atribución con qué herramienta se generó.
- Si el equipo decidiera generar imágenes en el futuro, tendría que pasar por el medidor de gasto del Rol 5 y anotarse en `docs/costos.md`, como cualquier llamada a un modelo.
