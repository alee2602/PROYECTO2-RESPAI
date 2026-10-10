# Flujo de validación de noticias (portal, Rol 3)

Cómo decide el portal qué estado de validación puede tener una noticia, y qué hace en cada uno de los tres casos del enunciado: **fuente insuficiente**, **fuentes que se contradicen** y **noticia sin confirmar**.

Principio base: **el estado lo elige una persona admin**. El portal no marca nada como `confirmed` por su cuenta. Solo impide lo que no se sostiene y explica por qué. Ninguna respuesta de un modelo cuenta como prueba.

Código: reglas en `apps/admin/lib/newsDraft.ts` (con pruebas en `newsDraft.test.ts`), pantalla en `apps/admin/components/NewsForm.tsx`.

## Estados

| Estado | Cuándo | Nota de validación |
|---|---|---|
| `confirmed` (Confirmada) | Al menos **2 fuentes distintas que no sean IA** la respaldan, y la persona decide confirmarla | Opcional |
| `in_progress` (En desarrollo) | Hay información parcial, el hecho sigue ocurriendo, o **las fuentes se contradicen** | Obligatoria |
| `unverified` (No verificada) | No hay fuentes suficientes para confirmarla | Obligatoria |

### Qué cuenta como "fuente distinta"

- Una fuente de tipo `ai` **nunca cuenta como prueba**. Se muestra al lector para que sepa que hubo un aporte de IA, pero no suma.
- Dos fuentes son **el mismo medio** si tienen el mismo nombre (sin importar tildes ni mayúsculas) o la misma URL de dominio. Por ejemplo, dos artículos de Prensa Libre cuentan como una sola fuente. El formulario lo avisa bajo la fila repetida.

## El diagnóstico en el formulario

Mientras se cargan las fuentes, la sección **Validación** muestra en qué caso está la noticia y qué hacer.

### Caso 1: fuente insuficiente

Hay menos de 2 fuentes distintas que no son IA. Por ejemplo: una sola fuente, dos artículos del mismo medio, o solo aportes de IA.

- **"Confirmada" queda bloqueada**, también al guardar un borrador.
- Se sugiere **No verificada**, o **En desarrollo** si el hecho sigue ocurriendo. La nota tiene que explicar qué falta.
- Se ofrece **buscar en otros medios** (ver más abajo). Si otro medio lo confirma, se agrega como fuente y el diagnóstico cambia solo.

Ejemplo real de las noticias semilla: el CAIMI de Antigua Guatemala, reportado solo por AGN.

### Caso 2: fuentes que se contradicen

Una contradicción no se puede detectar automáticamente sin un modelo, así que **la declara la persona** con la casilla "Las fuentes se contradicen".

- La noticia queda en **En desarrollo**. "Confirmada" y "No verificada" se bloquean mientras la casilla esté marcada.
- Se exigen al menos **2 fuentes distintas**, las que están en conflicto.
- La nota tiene que explicar **qué dice cada fuente**.
- Se guarda con el prefijo **`Fuentes contradictorias:`** al inicio de `validationNote`. Así queda registrado sin agregar un campo al esquema. La app y el chat ya muestran `validationNote` tal cual. Al editar, la casilla se marca sola si la nota empieza así.

Decisión del 2026-10-10: no se agrega un cuarto estado ni se cambia el esquema. Contradicción = `in_progress` más una nota obligatoria.

### Caso 3: noticia sin confirmar (con fuentes suficientes)

Hay 2 o más fuentes distintas, pero la persona todavía no la confirma. Por ejemplo, el hecho sigue en curso o falta el dato oficial.

- El portal **permite** confirmar, pero no lo hace solo: el estado sigue siendo el que la persona eligió.
- Si queda sin confirmar, la nota tiene que explicar por qué.

## Texto aportado por IA

- El formulario muestra siempre: **"Ningún texto generado por IA se publica sin revisión humana."**
- Si alguna fuente es de tipo `ai`, para publicar (o guardar cambios de una publicada) hay que marcar **"Revisé y edité el texto aportado por IA…"**. Es una confirmación en cada guardado; no se guarda en Firestore. Un borrador no la exige.

## Buscar en otros medios (sin IA, $0)

En la sección Fuentes, con el título escrito, hay dos enlaces que abren **Google Noticias en otra pestaña**:

1. **Medios de referencia:** busca el título solo en los medios de la lista del país de la noticia más agencias internacionales (`site:prensalibre.com OR site:agn.gt OR …`).
2. **Todo Google Noticias:** la misma búsqueda, sin filtro.

El portal **no consulta nada por su cuenta** ni guarda resultados. La persona lee y, si otro medio lo confirma, lo agrega como fuente. No usa API keys y no cuesta nada.

Si la URL de una fuente pertenece a un medio de la lista, el formulario muestra "Medio de referencia: X". **Estar en la lista no vuelve verdadera una noticia.** Solo ayuda a reconocer medios con trayectoria.

La lista vive en `apps/admin/lib/outlets.ts`. Es un punto de partida y cambiarla es decisión del equipo:

| País | Medios |
|---|---|
| Guatemala | Prensa Libre, AGN, República, Plaza Pública, La Hora, Soy502 |
| México | El Universal, Animal Político, Milenio, El Financiero |
| España | El País, RTVE, El Mundo, La Vanguardia |
| Estados Unidos | NPR, The New York Times |
| Argentina | La Nación, Clarín, Infobae |
| Internacionales (siempre) | Reuters, AP, AFP, EFE, BBC Mundo, DW |

## Qué queda fuera, y por qué

- **Segunda revisión por otra persona** antes de confirmar. `docs/roles-equipo.md` lo da como ejemplo. Necesitaría guardar quién revisó (un campo nuevo, como `reviewedBy`), y eso es un cambio de esquema que se propone al Rol 4 y al equipo. Hoy el portal registra `updatedAt`, pero no quién editó.
- **Detectar contradicciones automáticamente.** Haría falta un modelo. Ver la propuesta de abajo.

---

## Propuesta para el equipo: asistente de verificación con IA (no implementado)

**Estado:** propuesta del Rol 3, pendiente de aprobación del equipo y del Rol 5. **No se construye** hasta que existan: (1) el proveedor y modelo elegidos (`docs/decisiones-pendientes.md`), (2) la API key en las variables de entorno de Vercel, y (3) el medidor de gasto con tope del Rol 5. Etapa 0: el medidor va antes de la primera llamada a un modelo.

### Qué haría

Un botón **"Buscar fuentes con IA"** en el formulario. Al presionarlo:

1. El portal llama a un **endpoint del servidor**, nunca directo desde el navegador, con el título y el resumen.
2. El endpoint le pide a un modelo con búsqueda web que encuentre **artículos de otros medios** sobre el mismo hecho, limitado a los dominios de `outlets.ts` (`allowed_domains`).
3. Devuelve una lista de **enlaces sugeridos**: medio, título, URL y una frase de qué dice cada uno.
4. La persona **abre cada enlace y lo lee**. Solo si confirma lo que dice, lo agrega como fuente de tipo `original` o `summary`, con el nombre del medio, no como fuente `ai`.

### Reglas que se mantendrían

- La respuesta del modelo **nunca** cuenta como fuente ni como prueba. Las sugerencias no se guardan solas: la persona agrega a mano lo que verificó.
- El modelo no cambia el estado de validación ni escribe la nota.
- Justificación con evidencia del propio proyecto: en el ciclo del 2026-10-10 (`docs/ciclos.md`), una verificación hecha con IA y búsqueda web dio por buenas 2 de unas 11 noticias que no se sostenían al abrir las fuentes completas: fechas viejas que parecían nuevas y cifras que no estaban en las fuentes citadas. Por eso la IA solo sugiere y la persona abre cada enlace.

### Costo estimado

Precios oficiales de Anthropic, consultados el 2026-10-10 (https://platform.claude.com/docs/en/about-claude/pricing):

- Búsqueda web: **USD 10 por 1.000 búsquedas** (USD 0,01 cada una). Los resultados se cobran además como tokens de entrada.
- Claude Haiku 5.5: USD 0,10 por millón de tokens de entrada y USD 0,50 por millón de salida.
- Claude Sonnet 5.5: USD 2 por millón de entrada y USD 10 por millón de salida.

Supuesto por consulta: 2 búsquedas, unos 20.000 tokens de entrada (resultados de búsqueda más instrucciones) y unos 500 de salida.

| Modelo | Búsquedas | Entrada | Salida | **Total por consulta** | Consultas con USD 2 |
|---|---|---|---|---|---|
| Haiku 5.5 | $0,020 | $0,002 | $0,0003 | **≈ $0,022** | ≈ 90 |
| Sonnet 5.5 | $0,020 | $0,040 | $0,005 | **≈ $0,065** | ≈ 30 |

Con Haiku el costo lo dominan las búsquedas, no el modelo. Hay que confirmar que Haiku 5.5 admita la herramienta de búsqueda web en la versión que se use; si no, la opción es Sonnet 5.5.

### Controles propuestos

- **Tope propio** dentro del medidor del Rol 5, por ejemplo USD 2 de los USD 20. Al llegar al tope, el botón se desactiva con un mensaje claro y queda la búsqueda manual de $0.
- `max_uses: 2` búsquedas por consulta y respuesta corta.
- Solo admins autenticados pueden llamar al endpoint.
- Registro por llamada: tokens, búsquedas, costo estimado y gasto acumulado. Lo mismo que se exige para el chat.
- Anotar el costo real en `docs/costos.md` cuando exista.
