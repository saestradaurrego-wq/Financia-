# Comentarios de Financia: configuración de almacenamiento

El formulario de `index.html` envía los datos a `POST /api/feedback`. Para que se guarden de forma persistente, esa ruta debe estar conectada a Cloudflare D1.

## Archivos
- `index.html`: formulario accesible desde el botón «Enviar comentarios». Solo muestra éxito cuando el servidor responde correctamente.
- `feedback-api.js`: función de servidor que valida y guarda las respuestas en D1.
- `migrations/0001_feedback.sql`: esquema de la tabla.

## Configuración requerida en Cloudflare
1. En Workers & Pages, crea una base D1 llamada `financia-feedback`.
2. Ejecuta el SQL de `migrations/0001_feedback.sql` en la consola SQL de esa base.
3. En el Worker `financia`, añade un D1 binding con variable `DB` que apunte a `financia-feedback`.
4. Integra `handleFeedbackRequest` desde `feedback-api.js` en el código del Worker y enruta las solicitudes `POST /api/feedback` a esa función. Conserva la lógica que actualmente sirve la aplicación; no reemplaces el Worker completo sin revisar su código actual.
5. Publica una nueva versión del Worker.
6. Prueba el formulario y verifica en D1 que se creó una fila. No se debe mostrar confirmación de éxito si el servidor falla.

## Privacidad y seguridad
- No se recoge información bancaria ni contraseñas.
- El correo es opcional y debe tratarse como dato personal.
- No hay una ruta pública para leer comentarios; consulta los registros desde el panel de D1 con acceso autenticado.
- Antes de un lanzamiento amplio, añade límites de frecuencia / protección antiabuso y define una política de retención y privacidad.

**Estado:** código preparado en el repositorio. La persistencia no estará activa hasta configurar el binding D1 y publicar el handler en Cloudflare.
