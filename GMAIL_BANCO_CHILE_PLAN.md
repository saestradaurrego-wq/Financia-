# Integración Gmail — Banco de Chile (en desarrollo)

## Estado
Rama de trabajo: `feature/gmail-banco-chile`. **No está activa ni desplegada.**

## Arquitectura propuesta
1. El usuario inicia sesión en Financia mediante Firebase Authentication.
2. Un flujo OAuth independiente solicita consentimiento explícito para lectura de Gmail con el menor alcance viable. No solicitar ni guardar contraseñas.
3. Un backend autenticado mantiene los tokens OAuth cifrados y restringidos al UID del usuario. Nunca incluir secretos ni refresh tokens en `index.html` o el repositorio.
4. El backend recibe notificaciones de Gmail mediante `users.watch` y Google Cloud Pub/Sub; renueva la suscripción antes de que expire y realiza reconciliación periódica mediante `history.list`. Como alternativa de menor complejidad, polling programado con Gmail API.
5. Procesar únicamente mensajes pertinentes, verificar remitente y cabeceras (no confiar solo en nombre visible), extraer monto, fecha, moneda, comercio y tipo; registrar errores para revisión sin conservar más datos personales de los necesarios.
6. Persistir un identificador único por cuenta/mensaje/transacción y usar escrituras idempotentes; no duplicar compras al recibir notificaciones repetidas.
7. Guardar movimientos en el modelo existente de Financia, aislados por UID, con origen `gmail_banco_chile` y estado de conciliación. Distinguir cargos, reversas, abonos y transferencias; no asumir que todo correo es un gasto.
8. Mostrar en la interfaz conexión, última sincronización, errores, movimientos pendientes de revisión y botón para desconectar/revocar.

## Dependencias y verificaciones previas
- `FIREBASE_SETUP.md` indica que Firebase Authentication, Firestore, reglas y despliegue aún requieren configuración y pruebas; no asumir que están operativos.
- Confirmar estructura real de movimientos y mecanismo de persistencia en `index.html`.
- Obtener **ejemplos redactados** de notificaciones del Banco de Chile (sin nombres, cuentas, tarjetas, códigos, enlaces personales ni identificadores) para desarrollar y probar el parser.
- Elegir hosting del backend (por ejemplo Cloudflare Worker, si corresponde al despliegue actual) y almacén seguro para tokens.
- Revisar requisitos de verificación de Google para scopes restringidos de Gmail, especialmente si habrá usuarios externos.
- Pruebas: correo de compra de $1.000, mensajes duplicados, reversas, correos falsificados, ausencia de monto, Gmail desconectado, expiración de tokens y aislamiento entre usuarios.

## Seguridad
Nunca guardar tokens OAuth en localStorage, Firestore accesible al cliente o GitHub. Aplicar acceso mínimo, cifrado, borrado y revocación; no registrar contenido bancario completo en logs. No habilitar sincronización real sin pruebas y consentimiento explícito.

## Próximo paso de implementación
Auditar `index.html` y el flujo de datos existente; crear backend, parser y pruebas automatizadas; luego conectar interfaz y desplegar solo tras revisión.
