# Publicación segura de Financia — checklist

## Situación actual
La aplicación pública usa Cloudflare; la PR #4 contiene código nuevo **sin desplegar**.
La API v2 requiere un Worker separado y una base D1 con esquema multiusuario.
La integración Gmail/Banco de Chile fue probada parcialmente, no es una conexión bancaria universal.

## Bloqueo 1: Cloudflare
- En Cloudflare Workers Builds, la compilación de la rama de desarrollo falla durante *Deploying*.
- En la captura se observa el comando `npx wrangler preview`. Es una **pista**, no una causa demostrada.
- Obtener el mensaje de error de despliegue o inspeccionar los campos Build command y Deploy command en la configuración de Cloudflare.
- Para un sitio estático, verificar el modo de despliegue y la ruta del directorio de archivos; no reemplazar el Worker que recibe compras.
- No introducir un `wrangler.toml` raíz ni modificar el despliegue público sin comprobar primero qué recurso de Cloudflare administra la app.

## Bloqueo 2: API v2
- Aplicar `db/schema-multiusuario-v2.sql` en **D1 de pruebas** y ejecutar sus tests.
- Configurar Worker v2 **separado** con binding DB, CORS restringido y verificación Firebase ID token.
- Crear cuentas bancarias de prueba por usuario y comprobar aislamiento real con dos usuarios.
- Configurar `FINANCIA_API_V2_BASE_URL` solo después de desplegar el Worker v2.
- Verificar flujo crear movimiento pendiente → listar → aprobar/rechazar.
- No cambiar saldos al aprobar hasta implementar reconciliación y pruebas de consistencia.
- Mantener `POST /api/compras` del Worker antiguo mientras se migra el importador Gmail.

## Bloqueo 3: GitHub → Google Cloud
- Se configuraron variables de GitHub: `GCP_SERVICE_ACCOUNT` y `GCP_WORKLOAD_IDENTITY_PROVIDER`.
- La autenticación OIDC **no se ha probado aún**; revisar que el ID del proveedor coincida con Google Cloud.
- Ejecutar el workflow de verificación desde la rama principal cuando se habilite; no mezclar su publicación con el despliegue de funcionalidades no validadas.

## Criterio mínimo para publicar
1. Pruebas automáticas verdes.
2. Despliegue de staging correcto.
3. Sesiones, aislamiento de datos y CORS verificados.
4. Compras importadas deduplicadas y pendientes hasta aprobación.
5. Validación manual en navegador y móvil.
6. Plan de reversión definido.

No fusionar automáticamente la PR #4 hasta cumplir los criterios.
