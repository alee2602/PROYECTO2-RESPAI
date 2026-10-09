# scripts/seed-news — Noticias semilla (Rol 4)

Herramienta de un solo uso (no es parte de la app final): un HTML suelto que, con sesión de un correo admin, escribe 12 noticias de ejemplo en la colección `news` de Firestore. Usa el SDK de cliente de Firebase (no una service account), así que respeta las mismas reglas de seguridad que la app real — no hay atajos de permisos.

**Por qué ficticias y no reales:** evita tener que inventar fuentes falsas para eventos reales (eso sí sería desinformación), evita problemas de derechos de autor, y permite diseñar a propósito los casos que el feed, el chat y el portal necesitan demostrar.

## Cómo usarlo

1. Copiar `config.example.js` a `config.js` (gitignorado) con los valores de `/.env.example`.
2. Abrir `index.html` (local o desplegado, igual que `pruebas/ios-login`).
3. "Entrar con Google" con un correo que esté en `isAdmin()` de `/firestore.rules`.
4. "Cargar 12 noticias semilla".

Se puede correr más de una vez — no hay chequeo de duplicados, así que si se corre dos veces quedan 24 noticias. Para limpiar, borrar manualmente desde Firebase Console → Firestore → colección `news`.

## Qué incluye (variedad exigida por el Rol 4 en `docs/decisiones-pendientes.md`)

| # | Título | Alcance | País | Temas | Estado | Imagen |
|---|---|---|---|---|---|---|
| 1 | Antigua: wifi público | local | Guatemala | tecnología, turismo | confirmed | sí |
| 2 | Zona 10: cortes de agua | local | Guatemala | servicios públicos | unverified (1 sola fuente) | no |
| 3 | Feria de Quetzaltenango | local | Guatemala | cultura | confirmed | sí |
| 4 | Banguat: tasa de interés | national | Guatemala | economía, finanzas | confirmed | sí |
| 5 | Brote en escuelas de Xela | national | Guatemala | salud | in_progress (fuentes contradictorias: 12 vs 20 casos) | no |
| 6 | Selección femenina clasifica | national | Guatemala | deportes | confirmed | **no** |
| 7 | Reforma a ley de contrataciones | national | Guatemala | política | in_progress (dos bancadas se contradicen) | no |
| 8 | México: datos abiertos | international | México | tecnología, gobierno | confirmed | sí |
| 9 | España: ola de calor | international | España | clima | confirmed | sí |
| 10 | Rumor de privacidad (EE.UU.) | international | Estados Unidos | tecnología | unverified (fuente anónima única) | no |
| 11 | Precio internacional del café | international | (sin país específico) | economía | confirmed | sí |
| 12 | Argentina: sede de atletismo | international | Argentina | deportes | confirmed | sí |

Cubre: los 3 alcances, 4 países distintos en internacional, 7 temas distintos, 1 noticia sin fuente suficiente (#2), 1 con fuentes contradictorias (#7), 1 con fuente única no oficial (#10), y 3 noticias sin imagen (#2, #6, #7 — más de la mínima pedida).

Las imágenes son placeholders de `picsum.photos`, marcadas honestamente como contenido de prueba en el campo `attribution` (no se hacen pasar por fotos reales del hecho).
