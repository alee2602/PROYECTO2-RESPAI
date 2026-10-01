# Prueba desechable: login de Google en PWA instalada en iOS

No es parte de la app final. Es un HTML suelto (sin framework, sin build) para aislar y validar el riesgo descrito en la sección 5 del CLAUDE.md antes de construir el resto de la app encima.

## Qué prueba

- Si `signInWithPopup` o `signInWithRedirect` de Firebase Auth funcionan dentro de una PWA **instalada** en iPhone (no solo en la pestaña de Safari).
- Si la sesión persiste al cerrar y reabrir la app instalada.

## Cómo probarlo

1. Desplegar esta carpeta en Vercel (dominio público con HTTPS).
2. En Firebase Console → Authentication → Settings → Authorized domains, agregar el dominio que te dé Vercel.
3. Abrir ese link en Safari del iPhone.
4. Probar primero el botón de **popup** y luego el de **redirect**, anotando qué pasa.
5. Agregar la página a la pantalla de inicio ("Compartir" → "Agregar a pantalla de inicio").
6. Abrir el ícono instalado (no la pestaña de Safari) y repetir la prueba de login ahí dentro.
7. Cerrar la app instalada por completo y volver a abrirla: ver si `onAuthStateChanged` sigue mostrando sesión activa.

Resultado y decisión tomada: ver `/docs/ciclos.md`.
