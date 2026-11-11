# Financia — plan de integración segura (11-11-2026)

## Estado comprobado
- El repositorio contiene `index.html`, `firestore.rules` y `FIREBASE_SETUP.md`.
- La interfaz web ya existe; **no** debe reconstruirse sin revisar sus funcionalidades.
- `FIREBASE_SETUP.md` declara que la autenticación y la sincronización con Firebase requieren configuración, publicación y pruebas. No considerarlas operativas sin verificarlas.
- Las reglas de Firestore limitan `users/{userId}/finance/{documentId}` al usuario autenticado con el mismo UID. **No sustituye** una prueba real de aislamiento entre cuentas.
- El repositorio es público: no subir claves privadas, tokens, secretos de Worker, credenciales ni datos financieros personales.

## Separación de responsabilidades
1. **Gmail / Apps Script:** extraer avisos legítimos, validar remitentes y generar un identificador estable para deduplicar.
2. **Cloudflare Worker:** autenticar las peticiones, validar esquema y montos, aplicar límites y guardar compras en D1 como **pendientes**.
3. **Interfaz Financia:** consultar únicamente compras del usuario autenticado; mostrar pendientes y permitir confirmar, corregir categoría o rechazar.
4. **Registro financiero:** incorporar una compra al gasto contabilizado **solo después** de la confirmación; impedir duplicados y dobles confirmaciones.

## Requisitos antes de conectar la interfaz a D1
- Definir autenticación de usuario extremo a extremo: el secreto compartido Apps Script → Worker **no** debe exponerse en JavaScript del navegador.
- Diseñar endpoints de lectura y confirmación con autorización por usuario, paginación y protección contra repetición.
- Validar que las compras importadas pertenezcan a la cuenta correspondiente; no devolver movimientos de otros usuarios.
- Mantener secretos en variables seguras de Cloudflare y Apps Script, nunca en el repositorio.
- Verificar reglas de Firebase en producción y el aislamiento con dos cuentas de prueba.
- Definir cómo migrar datos locales anteriores **solo con consentimiento explícito**.
- Añadir pruebas de: compra duplicada, monto inválido, comercio vacío, rechazo, confirmación repetida, usuario sin autorización y sesión vencida.
- Verificar respaldos y un plan de reversión antes de desplegar cambios.

## Orden de trabajo
1. Auditar `index.html` y su manejo de almacenamiento/autenticación.
2. Revisar el código actual del Worker y su esquema D1 **sin compartir secretos**.
3. Implementar y probar un flujo de compras pendientes por usuario.
4. Integrar la interfaz con ese flujo, inicialmente usando datos de prueba.
5. Publicar solo después de superar pruebas de seguridad y funcionamiento.

**Este documento es planificación técnica, no evidencia de que la integración esté desplegada.**
