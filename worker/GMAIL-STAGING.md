# Integración Gmail → API v2 (staging)

Este endpoint **no está desplegado**. No reemplazar el Worker anterior ni modificar el Apps Script de producción hasta terminar las pruebas.

## Configuración segura en Cloudflare (staging)

Crear una D1 **nueva** e instalar `db/schema-multiusuario-v2.sql`. Crear una cuenta manual CLP para el usuario Firebase de prueba y obtener su `id`.

Configurar en el Worker separado:

- `FINANCIA_GMAIL_IMPORT_SECRET`: secreto aleatorio de al menos 32 caracteres (usar **Secret**, no variable pública).
- `FINANCIA_GMAIL_OWNER_UID`: UID Firebase de la cuenta de prueba.
- `FINANCIA_GMAIL_ACCOUNT_ID`: ID de la cuenta CLP creada en D1.
- `FINANCIA_ALLOWED_ORIGIN`: origen exacto del frontend autorizado.

No subir secretos ni identificadores privados a GitHub.

## Contrato para Apps Script

Enviar **POST** a `https://<staging-worker>/api/v2/import/gmail` con encabezados:

`Content-Type: application/json`
`X-Financia-Import-Secret: <secreto configurado>`

Ejemplo de cuerpo (datos ficticios):

```json
{
  "purchases": [
    {
      "transactionId": "gmail-message-id-unico-123",
      "description": "Comercio de prueba",
      "amountMinor": -12500,
      "currencyCode": "CLP",
      "bookedAt": "2026-11-06"
    }
  ]
}
```

`transactionId` debe ser un identificador **estable** del correo o compra para evitar duplicados. Para egresos, `amountMinor` es negativo y en CLP corresponde a pesos enteros. No enviar texto completo del correo ni datos de tarjetas.

Respuesta: `{"ok":true,"saved":1,"duplicates":0,"status":"pending"}`.

**Importante:** el importador se configura para **un solo usuario y cuenta** de pruebas. No es todavía un puente multiusuario general; requerirá un modelo de autorización por usuario antes de habilitar importación para más cuentas.

## Verificación previa a producción

1. Ejecutar pruebas CI y validar `/api/v2/ready`.
2. Probar con correo ficticio y confirmar inserción pendiente en D1 staging.
3. Reenviar el mismo ID y verificar `duplicates: 1`.
4. Aprobar/rechazar desde una sesión Firebase válida.
5. Comprobar que los saldos del frontend no cambien por compras pendientes.
6. Recién después, preparar migración del Apps Script real y respaldo.
