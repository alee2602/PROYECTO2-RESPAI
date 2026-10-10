# Señales de comportamiento (app móvil → Rol 4)

Dueño de la escritura: Rol 1 (`apps/mobile/lib/signals.ts`). Consumidor: Rol 4 (afinidad por tema en el ranking).
Última actualización: 2026-10-10.

## Dónde se guardan

`users/{uid}/signals/{autoId}`: un documento por señal. Las reglas de Firestore (`/firestore.rules`) solo dejan leer y escribir al propio usuario. **No se llama a ningún modelo**: son escrituras simples.

## Estructura de un documento

| Campo | Tipo | Qué es |
|---|---|---|
| `type` | `"open"` \| `"read_time"` \| `"share"` | Tipo de señal (ver abajo). |
| `newsId` | string | Id del documento en `news`. |
| `topics` | string[] | Copia de `news.topics` en ese momento (para no volver a leer la noticia). |
| `scope` | `"local"` \| `"national"` \| `"international"` | Copia de `news.scope`. |
| `newsCountry` | string \| null | Copia de `news.country`. |
| `newsRegion` | string \| null | Copia de `news.region`. |
| `userLocation` | `{ country, region \| null }` | Ubicación **simulada** que el usuario tenía elegida (nunca GPS). |
| `durationMs` | number | Solo en `read_time`: milisegundos con la noticia **visible** en pantalla (entre 2 s y 30 min). |
| `shareMethod` | `"native"` \| `"copy"` | Solo en `share`: hoja nativa del celular o copiar enlace. |
| `createdAt` | Timestamp | `serverTimestamp()`. |
| `client` | `"mobile"` | De qué app viene. |

Ejemplo real (capturado en la prueba de la rama `rol1/senales`):

```json
{ "type": "read_time", "newsId": "n5", "topics": ["salud"], "scope": "national",
  "newsCountry": "Guatemala", "newsRegion": "Quetzaltenango",
  "userLocation": { "country": "Guatemala", "region": "Quetzaltenango" },
  "durationMs": 8990, "createdAt": "<Timestamp>", "client": "mobile" }
```

## Cuándo se emite cada una

- **`open`**: una vez cada vez que se abre una noticia en el lector (`/noticia/[id]`).
- **`read_time`**: se cuenta solo el tiempo con la pantalla visible. Se guarda al salir del lector **y** cada vez que la app pasa a segundo plano (el celular puede cerrar la PWA sin avisar). Por eso **una misma apertura puede dejar varios `read_time`**: sumarlos por `newsId`. Lecturas de menos de 2 s no se registran (toques accidentales); se recorta a 30 min (pantalla olvidada).
- **`share`**: solo si se compartió de verdad. Si la persona abre la hoja de compartir y la cancela, no se registra.

## Recomendaciones para Rol 4 (no implementado aquí)

- `read_time` es mejor señal de interés que `open` (un `open` sin `read_time` probablemente fue un toque y salir).
- La afinidad por tema **no debe** desplazar el piso anti-burbuja: noticias locales, nacionales e internacionales importantes siguen arriba aunque el usuario nunca abra esos temas (CLAUDE.md, sección 3).
- No usar `userLocation` de señales viejas para personalizar: la ubicación vigente está en `users/{uid}.location`.

## Privacidad

- Solo se guarda qué noticias abre la persona y cuánto tiempo, asociado a su `uid`. Nada de GPS, IP ni contenido escrito por el usuario.
- La pantalla de login lo dice: "Solo guardamos la ubicación que elijas y qué noticias abres, para ordenar tu feed."
