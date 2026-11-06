#!/usr/bin/env node
// Verifica una API v2 staging ya desplegada. Nunca escribe movimientos ni toca producción.
const base = process.env.FINANCIA_STAGING_URL;
if (!base) {
  console.error('Configura FINANCIA_STAGING_URL con la URL de staging.');
  process.exit(2);
}
let url;
try { url = new URL(base); }
catch { console.error('URL de staging inválida'); process.exit(2); }
if (url.protocol !== 'https:' || url.username || url.password ||
    url.search || url.hash || !url.hostname.startsWith('financia-api-v2-staging.')) {
  console.error('Solo se permite el dominio HTTPS del Worker staging.');
  process.exit(2);
}
async function check(path, expectedStatus, verify) {
  const response = await fetch(new URL(path,url), {
    headers:{'Accept':'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)
  });
  const body = await response.json();
  if (response.status !== expectedStatus || !verify(body)) {
    throw new Error(path + ': respuesta inesperada (' + response.status + ')');
  }
  if (response.headers.get('Cache-Control') !== 'no-store') {
    throw new Error(path + ': falta Cache-Control no-store');
  }
  console.log('OK',path,response.status);
}
try {
  await check('/api/v2/health',200,b=>b.ok===true && b.service==='financia-api-v2');
  await check('/api/v2/ready',200,b=>b.ok===true && b.ready===true);
  await check('/api/v2/session',401,b=>b.ok===false);
  await check('/api/v2/movements/pending',401,b=>b.ok===false);
  console.log('Staging responde y D1 está preparada. Falta validar flujo autenticado.');
} catch (error) {
  console.error('Staging NO está listo:',error.message);
  process.exitCode=1;
}
