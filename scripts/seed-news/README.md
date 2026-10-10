# scripts/seed-news — Noticias semilla (Rol 4)

Herramienta de un solo uso (no es parte de la app final): un HTML suelto que, con sesión de un correo admin, escribe noticias en la colección `news` de Firestore. Usa el SDK de cliente de Firebase (no una service account), así que respeta las mismas reglas de seguridad que la app real — no hay atajos de permisos.

**Actualización 2026-10-10 — ahora son REALES, no ficticias.** El equipo le preguntó al catedrático si las noticias debían basarse en hechos reales o podían ser inventadas; la respuesta fue que el proyecto exige validar la veracidad contra otros medios confiables, lo cual solo tiene sentido con contenido real. Se reemplazaron las 12 noticias ficticias originales por 12 reales, verificadas con búsqueda web (ver `docs/ciclos.md`, 2026-10-10, para el detalle de qué se descartó y por qué).

**Verificación:** cada noticia tiene al menos una fuente con nombre real; varias tienen link directo al artículo. La verificación fue **preliminar** (hecha por Claude con búsqueda web, no un chequeo editorial humano completo) — revisar los links antes de usar esto en la demo real.

**Sin imágenes:** para contenido real, poner una foto genérica (picsum.photos, como se hacía con las ficticias) como "libre con atribución" sería engañoso — no es una foto del hecho. El origen real de imágenes para noticias publicadas es responsabilidad del flujo del portal (Rol 3), no de este script.

## Cómo usarlo

1. Copiar `config.example.js` a `config.js` (gitignorado) con los valores de `/.env.example`.
2. Abrir `index.html` (local o desplegado, igual que `pruebas/ios-login`).
3. "Entrar con Google" con un correo que esté en `isAdmin()` de `/firestore.rules`.
4. Si ya habías cargado las 12 ficticias anteriores, dale primero a **"Borrar TODAS las noticias actuales"** (pide confirmación, no se puede deshacer) — si no, quedan mezcladas ficticias y reales.
5. "Cargar 12 noticias semilla reales".

## Qué incluye

| # | Título | Alcance | País/Región | Temas | Estado | Fuente |
|---|---|---|---|---|---|---|
| 1 | CAIMI de Antigua Guatemala sin avanzar | local | Guatemala · Sacatepéquez | salud, servicios públicos | **unverified** (1 sola fuente) | [AGN](https://agn.gt/caimi-de-antigua-guatemala-entrampado-y-sin-interes-municipal-en-resolver-procesos/) |
| 2 | Paso a desnivel calzada Roosevelt | local | Guatemala · Ciudad de Guatemala | infraestructura | confirmed | AGN, Prensa Libre |
| 3 | Expoferia del Mueble Quetzaltenango | local | Guatemala · Quetzaltenango | cultura, comercio | confirmed | La Voz de Xela |
| 4 | Banguat: crecimiento 4.1% 2026 | national | Guatemala | economía | confirmed | [Infobae](https://www.infobae.com/guatemala/2026/05/22/guatemala-proyecta-un-crecimiento-economico-del-41-en-2026-impulsada-por-las-remesas-familiares/) |
| 5 | Tres propuestas de subsidio a combustibles | national | Guatemala | economía, política | **in_progress** (sin confirmación de aprobación final) | [Revista E&N](https://www.revistaeyn.com/centroamericaymundo/guatemala-arevalo-presenta-proyecto-de-ley-de-apoyo-al-precio-de-combustibles-HG31510337), Infobae |
| 6 | Lluvias 2026: 13 muertes, alerta Conred | national | Guatemala | clima | confirmed | Conred, Prensa Libre |
| 7 | Vicepresidenta: Guatemala debe prepararse ante la IA (foro HumanIA) | national | Guatemala | tecnología, educación | confirmed | [AGN](https://agn.gt/?p=565671) |
| 8 | España adelanta elecciones al 29 nov | national | España | política | confirmed | [CRHoy/AFP](https://crhoy.com/mundo/pedro-sanchez-adelanta-elecciones-en-espana-para-el-29-de-noviembre/) |
| 9 | Sheinbaum presenta Olinia 1 (auto eléctrico) | national | México | tecnología | confirmed | [Zeta Tijuana](https://zetatijuana.com/2026/06/sheinbaum-presenta-olinia-el-primer-minivehiculo-electrico-disenado-y-fabricado-en-mexico/), Forbes México |
| 10 | Trump condecora a tripulación Artemis II | national | Estados Unidos | tecnología, ciencia | confirmed | [El Español](https://www.elespanol.com/mundo/20260823/tripulacion-artemis-ii-recibira-maxima-condecoracion-eeuu-solo-astronautas/1003744360782_0.html), UnoTV |
| 11 | Banco Central de Argentina y Goldman Sachs bajan su proyección de crecimiento 2026 a 2.7% | national | Argentina | economía | **in_progress** (dos fuentes independientes, cifra final sin confirmar) | [Buenos Aires Times](https://batimes.com.ar/news/economy/argentinas-economy-expanded-faster-than-expected-in-june.phtml), [MercoPress](https://en.mercopress.com/2026/07/25/goldman-sachs-cuts-argentina-s-growth-forecast-to-2.7-and-looks-ahead-to-the-elections/comments) |
| 12 | Precio del café cae ~20% en 2026 | international | (sin país específico) | economía | confirmed | OIC, [Bloomberg Línea](https://bloomberglinea.com/mercados/los-precios-del-cafe-caen-casi-20-en-2026-mientras-el-mercado-anticipa-mas-oferta/) |

Cubre: los 3 alcances, las 4 regiones/países que usa `apps/mobile/lib/locations.ts` (Guatemala con 3 regiones distintas, México, España, Estados Unidos, Argentina), 7 temas, 2 casos reales de validación distinta de "confirmed" (uno de fuente única, uno de fuentes contradictorias — ambos genuinamente reales, no inventados), y una sin país específico para probar el caso "siempre internacional" de `displayScope`. Ninguna tiene imagen (ver nota arriba).

## Candidatas descartadas (no se usaron, documentado por transparencia)

- México/tribunal vs. Meta: no se encontró el artículo real que lo respaldara.
- Contradicción Banguat vs. CEPAL: no se pudo confirmar la cifra de CEPAL en ninguna fuente legible.
- Varios intentos de encontrar un "rumor sin confirmar" real y bien fechado no dieron resultado — los medios confiables rara vez publican rumores de forma prominente, y varias páginas tenían fechas inconsistentes (artículos de 2015–2023 apareciendo marcados como 2026).
- "AGN alerta sobre videos falsos de funcionarios": al verificarlo a fondo (no solo con el resumen de la búsqueda), resultó ser una campaña recurrente de **2021-2022**, no algo nuevo de 2026 — la fecha que parecía reciente era de cuándo se capturó la página, no de publicación. Se reemplazó por la noticia de la vicepresidenta Karin Herrera sobre IA (#7).
- La versión original de la noticia #11 decía que el FMI proyectaba 4% y la OCDE 2.6% para Argentina — al abrir las fuentes directamente, ninguna de las dos cifras se pudo confirmar. Se reescribió para afirmar solo lo verificado (Banco Central + Goldman Sachs, ambos en 2.7%).
