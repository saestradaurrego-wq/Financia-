# Financia — checklist de despliegue seguro (pendiente de accesos)

## Estado comprobado
- La rama `audit-seguridad-integracion-2026-11` tiene pruebas automáticas en GitHub Actions con resultado satisfactorio hasta el commit `ae86461b5a3197349ea9bf438e2bdbf9ce6bc294`.
- El código de integración es **propuesto**, no está confirmado como desplegado en Cloudflare o Firebase.
- El Worker admite múltiples bancos por usuario mediante el campo `banco` y deduplicación por banco e identificador externo.
- La interfaz permite elegir categoría y cuenta al aprobar una compra, aprende preferencias por comercio y configurar el origen HTTPS de la API sin guardar el secreto de ingestión en el navegador.

## Orden de despliegue (no ejecutar directamente en producción)
1. Crear entorno de prueba separado y respaldar la base D1 existente.
2. Verificar Firebase Authentication, Firestore y reglas `firestore.rules` con dos cuentas de prueba (aislamiento por UID).
3. Ejecutar migración `cloudflare/migrations/001_compras_pendientes_v2.sql` en D1 de prueba y **después** `cloudflare/migrations/002_banco_origen.sql`.
4. Configurar Worker v2 en entorno de prueba con binding `DB`, `FIREBASE_PROJECT_ID`, `INGEST_OWNER_UID`, `ALLOWED_ORIGIN` y secreto `INGEST_SECRET` exclusivamente en Cloudflare.
5. Probar autenticación Firebase con tokens reales, expiración, CORS, permisos, confirmación y rechazo, reintentos y aislamiento de usuarios.
6. Adaptar Apps Script para enviar `POST /api/v2/ingest` con `banco`, `external_id`, `comercio`, `monto_clp`, `fecha`. No sustituir el endpoint antiguo sin verificar compatibilidad.
7. Probar correos reales **redactados** de cada banco y suplantación de remitente; un banco no se considera compatible hasta validar su parser.
8. Configurar en Financia el origen HTTPS de la API usando **Configurar API** en Movimientos.
9. Verificar el recorrido completo: correo → Apps Script → Worker → D1 → aprobación en Financia → Firestore → resolución en D1.
10. Verificar PWA en iOS, Android y escritorio, sincronización entre dispositivos, copias de seguridad y recuperación de errores.
11. Recién después aprobar revisión de seguridad, fusionar PR y desplegar producción con plan de reversión.

## Bloqueos y precauciones
- No hay acceso operativo desde esta conversación a Firebase ni Cloudflare. No se han desplegado servicios ni ejecutado migraciones reales.
- No publicar claves privadas, secretos de ingestión ni datos bancarios en GitHub.
- El Worker v2 está orientado a **un propietario de ingestión** (`INGEST_OWNER_UID`), aunque ese propietario puede importar compras de distintos bancos. Para ofrecer la aplicación a múltiples usuarios se requiere vinculación verificada por usuario.
- No hay garantía de transacciones distribuidas entre Firestore y D1. Hay que ensayar fallos parciales y recuperación.
- Los formatos de notificación de bancos aún no están implementados ni verificados individualmente.
- Las pruebas automáticas no sustituyen ensayos con servicios reales.

## Evidencia antes de marcar como listo
- GitHub Actions en verde sobre commit definitivo.
- URLs de Firebase Hosting y Worker de prueba verificadas.
- Migraciones aplicadas en D1 de prueba y verificadas.
- Inicio de sesión, aislamiento, importación, deduplicación, aprobación y rechazo probados de extremo a extremo.
- Ninguna credencial en frontend ni repositorio.
- Despliegue de producción y prueba posterior documentados.
