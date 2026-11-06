# Puesta en marcha controlada — Financia v2 staging

**Estado:** guía operativa; no se ha desplegado Cloudflare ni conectado Gmail real. Mantener intactos el Worker anterior `cold-surf-9305`, su D1 y su Apps Script.

## 1. Crear recursos separados

En Cloudflare Dashboard, crear una base D1 llamada `financia-v2-staging`. Copiar el ID real de esa base al bloque `[[d1_databases]]` de `worker/wrangler.toml`, descomentándolo. El binding debe llamarse `DB`. **Nunca** copiar el ID de la D1 antigua.

Desde la raíz del repositorio, con Wrangler autenticado en la cuenta Cloudflare correcta:

```sh
npx wrangler d1 execute financia-v2-staging --remote --file=db/schema-multiusuario-v2.sql
cd worker
npx wrangler deploy
```

Antes del despliegue, confirmar que el nombre del Worker sea exclusivamente `financia-api-v2-staging`. El comando `--remote` aplica cambios a la D1 seleccionada: verificar nombre e ID antes de ejecutarlo.

## 2. Configurar secretos y variables

En la configuración del Worker de staging, establecer:

- `FINANCIA_GMAIL_IMPORT_SECRET`: secreto aleatorio de al menos 32 caracteres; **Secret** de Worker, no código ni variable pública.
- `FINANCIA_GMAIL_OWNER_UID`: UID Firebase de un usuario **de prueba**.
- `FINANCIA_GMAIL_ACCOUNT_ID`: ID de una cuenta CLP de prueba en `bank_accounts_v2`.
- `FINANCIA_ALLOWED_ORIGIN`: origen HTTPS exacto del frontend de pruebas.
- Cualquier variable adicional de autenticación requerida por `worker/auth/firebase-id-token.js`, siguiendo su implementación actual.

Crear la cuenta de prueba en D1 **solo después** de verificar el UID y la base. Ejemplo orientativo, reemplazando valores en una sesión administrativa y sin publicarlos:

```sql
INSERT INTO bank_accounts_v2
(id,owner_uid,country_code,bank_code,display_name,currency_code)
VALUES ('staging-clp-account','UID_FIREBASE_DE_PRUEBA','CL','banco-chile',
        'Cuenta CLP de prueba','CLP');
```

No insertar un UID inventado como si fuese real.

## 3. Conectar Apps Script sin tocar producción

Crear **un proyecto Apps Script nuevo**, copiar `integrations/google-apps-script/FinanciaV2Staging.gs` y establecer sus Script Properties:

- `FINANCIA_V2_STAGING_URL`: URL HTTPS del Worker `financia-api-v2-staging`.
- `FINANCIA_V2_IMPORT_SECRET`: exactamente el mismo secreto del Worker.

Ejecutar primero `financiaV2PruebaFicticia()` con datos de prueba. Para enviar compras reales posteriormente, adaptar el parser actual para producir `transactionId` estable, `description`, `amountMinor` negativo en CLP, `currencyCode: 'CLP'` y `bookedAt` YYYY-MM-DD. No habilitar disparadores automáticos hasta aprobar el circuito completo.

## 4. Lista de aceptación

- CI de GitHub en verde y respuesta correcta de `/api/v2/ready`.
- Primera compra ficticia: `saved:1`, `status:'pending'`.
- Reenvío con mismo ID: `saved:0`, `duplicates:1`.
- Lote con ID duplicado o monto positivo: HTTP 400.
- Cuenta de destino inexistente: HTTP 503 sin escrituras.
- Compra pendiente visible solo para su usuario; aprobar y rechazar con sesión Firebase verificada.
- Pendientes no modifican los saldos confirmados.
- Ningún cambio en Worker, D1 ni script antiguos.

**Bloqueo externo actual:** se necesitan el ID de D1 staging, acceso Cloudflare y configuración de UID/cuenta de prueba. Sin eso, el código no equivale a una integración desplegada.
