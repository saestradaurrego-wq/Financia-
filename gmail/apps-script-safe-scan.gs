/**
 * Financia - Apps Script (fase de validación, SIN ENVÍO DE DATOS).
 * Copia este archivo a tu proyecto "Financia - Gmail" después de verificar
 * el remitente real de las notificaciones de Banco de Chile.
 *
 * No uses coincidencias del nombre visible "Banco de Chile": pueden falsificarse.
 * La dirección exacta debe confirmarse con un correo auténtico.
 */
const FINANCIA_CONFIG = {
  senderAddresses: [], // Ej.: 'avisos@dominio-confirmado.cl'; NUNCA adivinar
  lookbackDays: 7,
  maxThreads: 50
};

function finNormalizeEmailAddress_(from) {
  const angle = String(from || '').match(/<([^<>\s]+@[^<>\s]+)>/);
  const email = angle ? angle[1] : String(from || '').trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email.toLowerCase() : '';
}

function finRevisarAvisosSeguros() {
  const allowed = FINANCIA_CONFIG.senderAddresses.map(s => String(s).toLowerCase().trim()).filter(Boolean);
  if (!allowed.length) {
    console.log('Primero configura direcciones exactas de remitentes verificados. No se leyó ni envió contenido bancario.');
    return;
  }
  const threads = GmailApp.search('newer_than:' + FINANCIA_CONFIG.lookbackDays + 'd', 0, FINANCIA_CONFIG.maxThreads);
  let checked = 0, matched = 0;
  threads.forEach(thread => thread.getMessages().forEach(message => {
    checked++;
    const sender = finNormalizeEmailAddress_(message.getFrom());
    if (!allowed.includes(sender)) return;
    const subject = message.getSubject();
    if (!/compra|cargo|transacci[oó]n/i.test(subject)) return;
    matched++;
    // Solo metadatos de conteo. No imprimir correos, montos ni cuerpos.
  }));
  console.log('Mensajes revisados: ' + checked);
  console.log('Avisos candidatos de remitentes permitidos: ' + matched);
  console.log('Solo lectura: no se registraron gastos ni se enviaron datos.');
}
