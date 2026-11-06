/**
 * Financia v2 — puente de pruebas desde Google Apps Script.
 * No reemplaza el script bancario existente ni lee Gmail por sí solo.
 * Invocar desde el parser existente con compras YA validadas.
 * Guardar las propiedades en Script Properties, nunca en el código.
 *
 * FINANCIA_V2_STAGING_URL = https://financia-api-v2-staging.<subdominio>.workers.dev
 * FINANCIA_V2_IMPORT_SECRET = secreto de >= 32 caracteres
 */
function financiaV2EnviarComprasDePrueba(compras) {
  var props = PropertiesService.getScriptProperties();
  var base = String(props.getProperty('FINANCIA_V2_STAGING_URL') || '').replace(/\/$/, '');
  var secret = String(props.getProperty('FINANCIA_V2_IMPORT_SECRET') || '');
  if (!/^https:\/\/financia-api-v2-staging\.[a-z0-9-]+\.workers\.dev$/i.test(base)) {
    throw new Error('Configura exclusivamente la URL HTTPS de staging de Financia v2.');
  }
  if (secret.length < 32) throw new Error('Falta el secreto de importación de staging.');
  if (!Array.isArray(compras) || compras.length < 1 || compras.length > 20) {
    throw new Error('Se requiere entre 1 y 20 compras validadas.');
  }
  var ids = Object.create(null);
  compras.forEach(function (c) {
    if (!c || typeof c.transactionId !== 'string' || c.transactionId.length < 8 ||
        typeof c.description !== 'string' || !c.description.trim() ||
        !Number.isSafeInteger(c.amountMinor) || c.amountMinor === 0 ||
        c.currencyCode !== 'CLP' || !/^\d{4}-\d{2}-\d{2}$/.test(c.bookedAt)) {
      throw new Error('Compra inválida: revisar ID, comercio, monto CLP y fecha.');
    }
    if (c.transactionId.length > 200 || c.description.length > 200 ||
        c.amountMinor >= 0 ||
        new Date(c.bookedAt).toISOString().slice(0, 10) !== c.bookedAt) {
      throw new Error('Compra inválida: fecha, monto o longitud incorrectos.');
    }
    if (ids[c.transactionId]) throw new Error('ID repetido dentro del lote.');
    ids[c.transactionId] = true;
  });
  var response = UrlFetchApp.fetch(base + '/api/v2/import/gmail', {
    method: 'post',
    contentType: 'application/json',
    headers: {'X-Financia-Import-Secret': secret},
    payload: JSON.stringify({purchases: compras}),
    muteHttpExceptions: true,
    followRedirects: false
  });
  var status = response.getResponseCode();
  var data;
  try { data = JSON.parse(response.getContentText()); }
  catch (e) { throw new Error('Respuesta inválida de API v2 (' + status + ')'); }
  if (status !== 200 || !data.ok) {
    throw new Error('Importación staging falló (' + status + '): ' + (data.error || 'error desconocido'));
  }
  return {saved: data.saved, duplicates: data.duplicates, status: data.status};
}

/** Prueba manual con compra ficticia, no toca Gmail ni producción. */
function financiaV2PruebaFicticia() {
  return financiaV2EnviarComprasDePrueba([{
    transactionId: 'financia-staging-test-20261106',
    description: 'Compra ficticia de prueba',
    amountMinor: -12500,
    currencyCode: 'CLP',
    bookedAt: '2026-11-06'
  }]);
}
