# Financia — puesta en marcha del módulo de compras

## Qué está implementado en esta rama
- Interfaz «Compras bancarias pendientes» en Movimientos, con consulta, aprobación y rechazo.
- La aprobación guarda primero el gasto en Firestore y luego resuelve el pendiente en D1. El identificador `importedId` evita repetir la incorporación en reintentos del mismo estado.
- API propuesta para D1 con validación de ID token Firebase, autorización por UID y secreto de ingestión del lado del servidor.
- Esquema SQL separado en `cloudflare/migrations/001_compras_pendientes_v2.sql`.

## Qué NO está desplegado
El repositorio GitHub no permite por sí solo crear el binding D1, definir secretos de Cloudflare, activar Firebase Authentication, publicar reglas de Firestore ni ejecutar pruebas con compras reales. **No desplegar esta rama directamente a producción sin completar estas tareas.**

## Configuración requerida del Worker
Bindings/variables: `DB` (binding D1), `FIREBASE_PROJECT_ID` (identificador Firebase), `INGEST_OWNER_UID` (UID de la cuenta autorizada a recibir avisos), `ALLOWED_ORIGIN` (origen HTTPS exacto de la app), `INGEST_SECRET` (secreto de ingestión, solo en Secret de Cloudflare). Verificar nombres contra los bindings reales antes de adaptar el Worker existente. La ruta `/api/v2/ingest` **no** reemplaza automáticamente `/api/compras` de Apps Script.

En la página, configurar `window.FINANCIA_COMPRAS_API_BASE` con la URL HTTPS del Worker **antes** del script principal de Financia. No colocar `INGEST_SECRET` en la página.

## Antes de usar con dinero real
1. Confirmar que el Worker existente y el esquema D1 actual no entren en conflicto con las rutas y tabla nuevas.
2. Probar con Firebase Auth y Firestore reales y reglas de acceso por UID.
3. Verificar que la consulta con usuario A no revele datos de usuario B.
4. Probar ingestión repetida, compras mal formadas, petición de tamaño excesivo, JWT vencido, compra rechazada, confirmación repetida y caída de Firestore.
5. Verificar qué pasa si D1 confirma pero Firestore falla, y viceversa. La integración actual evita un caso de duplicación en el cliente, pero **no ofrece transacciones distribuidas** ni conciliación automática.
6. Corregir la UX de clasificación para que el usuario elija categoría y cuenta antes de contabilizar; por ahora se utiliza `Otros` y `Cuenta corriente` como valores predeterminados.
7. Definir y probar respaldo, restauración y conflictos de edición entre dispositivos.
8. Validar el despliegue en entorno de prueba antes de actualizar producción.

## Bloqueos externos
Se requiere acceso autorizado al proyecto Cloudflare y Firebase (o despliegue por el titular). GitHub por sí solo no puede confirmar que los servicios externos estén configurados ni que funcionen en producción.
