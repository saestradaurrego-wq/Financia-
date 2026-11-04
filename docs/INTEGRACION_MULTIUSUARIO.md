# Integracion segura multiusuario — lista de comprobacion

Este codigo es preparatorio y NO esta desplegado en Cloudflare.

## Antes de desplegar
1. Hacer respaldo de D1. Aplicar `db/schema-multiusuario-v2.sql` en entorno de pruebas, no sobre produccion sin revisar.
2. Integrar `worker/auth/firebase-id-token.js` en el Worker real; usar `requireFirebaseUser` para cada ruta de usuario.
3. Integrar `worker/list-pending-movements.js` solo tras crear tablas v2 y verificar identidad.
4. Mantener el secreto de Apps Script solo en servidor. No exponerlo en HTML ni en JS del navegador.
5. El endpoint anterior `POST /api/compras` no distingue usuarios; bloquear su uso multiusuario hasta asociar cada fuente a un owner_uid autorizado.
6. Para Gmail por usuario, solicitar consentimiento OAuth independiente; la cuenta de Google para iniciar sesion NO da acceso a correos.
7. El verificador de ID token comprueba firma, emisor, audiencia y caducidad; NO comprueba revocacion ni estado deshabilitado. Diseñar controles adicionales antes del lanzamiento publico.
8. No aceptar plan Premium desde el cliente; actualizar permisos solo desde eventos de pago firmados y verificados en servidor.
9. Pruebas obligatorias: sin token => 401; token invalido => 401; usuario A no ve movimientos B; rechazo de ids ajenos; duplicados; caducidad; errores de proveedor.
10. Revisión de seguridad, políticas de privacidad y cumplimiento normativo por pais antes de abrir bancos reales.

## Nota sobre la PWA
La rama tiene manifiesto, icono SVG, service worker y pantalla offline sin datos financieros. Aun faltan iconos PNG, prueba de instalacion y despliegue.
