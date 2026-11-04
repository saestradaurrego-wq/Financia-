# Pruebas de seguridad de Financia

Requiere Node.js 20+.

Desde la raiz del repositorio:

```bash
node --experimental-default-type=module --test worker/tests/security.test.mjs
```

Las pruebas crean claves RSA de laboratorio, simulan el endpoint publico de claves de Firebase y utilizan una D1 falsa en memoria. No acceden a cuentas bancarias ni a datos reales.

Verifican firma valida, audiencia, expiracion, alteracion de token, rechazo de peticiones anonimas, filtro por owner_uid y estado pendiente, e intento de suplantacion mediante query string.

**Limitaciones:** las pruebas unitarias no sustituyen las pruebas con Cloudflare D1 real, Firebase real, controles de revocacion, reglas Firestore y pruebas de seguridad antes de produccion. El endpoint de ejemplo aun no esta conectado al Worker publicado.
