/**
 * Financia — API v2 de compras pendientes (Cloudflare Workers + D1).
 * Código de referencia aislado: NO reemplaza el Worker existente.
 * Requiere bindings: DB (D1), FIREBASE_PROJECT_ID, INGEST_SECRET,
 * INGEST_OWNER_UID y ALLOWED_ORIGIN. Todos los secretos van en variables
 * seguras de Cloudflare, nunca en el navegador ni en GitHub.
 *
 * El endpoint de ingestión solo permite la cuenta INGEST_OWNER_UID.
 * Admite múltiples bancos por propietario; múltiples usuarios requieren vinculación verificada.
 */
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store', ...headers }
  });
const encoder = new TextEncoder();
const bytes = (s) => encoder.encode(s);
function safeEqual(a, b) {
  const x = bytes(String(a || '')), y = bytes(String(b || ''));
  let mismatch = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) mismatch |= (x[i] || 0) ^ (y[i] || 0);
  return mismatch === 0;
}
function decodeB64url(s) {
  const p = s.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(p + '='.repeat((4 - p.length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function verifyFirebaseToken(token, projectId) {
  if (!projectId || !token || token.length > 8192) throw Error('Token inválido');
  const parts = token.split('.');
  if (parts.length !== 3) throw Error('Token inválido');
  const header = JSON.parse(new TextDecoder().decode(decodeB64url(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodeB64url(parts[1])));
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' ||
      claims.aud !== projectId ||
      claims.iss !== 'https://securetoken.google.com/' + projectId ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.iat !== 'number' || claims.iat > now ||
      typeof claims.auth_time !== 'number' || claims.auth_time > now) throw Error('Token inválido');
  const response = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!response.ok) throw Error('No se pudo verificar la firma');
  const jwks = await response.json();
  const jwk = (jwks.keys || []).find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256'));
  if (!jwk) throw Error('Firma desconocida');
  const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeB64url(parts[2]), bytes(parts[0] + '.' + parts[1]));
  if (!valid) throw Error('Firma inválida');
  return claims.sub;
}
async function readSmallJson(request, maxBytes = 16384) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) {
    const error = new Error('Solicitud demasiado grande'); error.status = 413; throw error;
  }
  const reader = request.body?.getReader();
  if (!reader) { const error = new Error('Cuerpo requerido'); error.status = 400; throw error; }
  let total = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        const error = new Error('Solicitud demasiado grande'); error.status = 413; throw error;
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const raw = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); }
  catch (_) { const error = new Error('JSON inválido'); error.status = 400; throw error; }
}
function validISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function cors(request, env) {
  const origin = request.headers.get('origin');
  return origin && origin === env.ALLOWED_ORIGIN ?
    {'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'} : {};
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const headers = cors(request, env);
    if (!env.DB || !env.FIREBASE_PROJECT_ID) return json({error:'Configuración incompleta'},503,headers);
    if (request.method === 'OPTIONS') return Object.keys(headers).length ? new Response(null,{status:204,headers}) : json({error:'Origen no autorizado'},403);
    if (request.headers.get('origin') && !Object.keys(headers).length) return json({error:'Origen no autorizado'},403);
    try {
      if (path === '/api/v2/ingest' && request.method === 'POST') {
        if (!env.INGEST_SECRET || !env.INGEST_OWNER_UID ||
            !safeEqual(request.headers.get('x-ingest-secret'),env.INGEST_SECRET))
          return json({error:'No autorizado'},401,headers);
        const body = await readSmallJson(request);
        if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error:'Formato inválido'},400,headers);
        const {external_id,comercio,monto_clp,fecha,banco} = body;
        const bank = typeof banco === 'string' ? banco.trim().toLowerCase() : 'no_identificado';
        if (!/^[a-z0-9][a-z0-9_-]{1,49}$/.test(bank)) return json({error:'Banco inválido'},400,headers);
        if (typeof external_id !== 'string' || !/^[A-Za-z0-9:_-]{8,160}$/.test(external_id) ||
            typeof comercio !== 'string' || !comercio.trim() || comercio.length > 160 ||
            !Number.isSafeInteger(monto_clp) || monto_clp <= 0 || monto_clp > 1000000000 ||
            !validISODate(fecha))
          return json({error:'Datos de compra inválidos'},400,headers);
        const id = crypto.randomUUID();
        const result = await env.DB.prepare(
          'INSERT OR IGNORE INTO compras_pendientes_v2 (id,owner_uid,external_id,comercio,monto_clp,fecha,banco) VALUES (?,?,?,?,?,?,?)'
        ).bind(id,env.INGEST_OWNER_UID,bank + ':' + external_id,comercio.trim(),monto_clp,fecha,bank).run();
        return json({ok:true,insertada:result.meta.changes === 1,duplicada:result.meta.changes === 0},200,headers);
      }
      if (!path.startsWith('/api/v2/compras')) return json({error:'Ruta no encontrada'},404,headers);
      const bearer = request.headers.get('authorization') || '';
      if (!bearer.startsWith('Bearer ')) return json({error:'Sesión requerida'},401,headers);
      let uid;
      try { uid = await verifyFirebaseToken(bearer.slice(7),env.FIREBASE_PROJECT_ID); }
      catch (_) { return json({error:'Sesión no válida'},401,headers); }
      if (path === '/api/v2/compras/pendientes' && request.method === 'GET') {
        const result = await env.DB.prepare(
          "SELECT id,banco,comercio,monto_clp,fecha,categoria,created_at FROM compras_pendientes_v2 WHERE owner_uid=? AND estado='pendiente' ORDER BY created_at DESC LIMIT 100"
        ).bind(uid).all();
        return json({compras:result.results},200,headers);
      }
      const match = /^\/api\/v2\/compras\/([0-9a-f-]{36})\/resolver$/.exec(path);
      if (match && request.method === 'POST') {
        const body = await readSmallJson(request);
        if (!body || !['confirmada','rechazada'].includes(body.estado) ||
            (body.categoria != null && (typeof body.categoria !== 'string' || body.categoria.length > 80)))
          return json({error:'Resolución inválida'},400,headers);
        const result = await env.DB.prepare(
          "UPDATE compras_pendientes_v2 SET estado=?, categoria=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_uid=? AND estado='pendiente'"
        ).bind(body.estado,body.categoria || null,match[1],uid).run();
        if (result.meta.changes !== 1) return json({error:'Compra inexistente o ya resuelta'},409,headers);
        return json({ok:true,estado:body.estado},200,headers);
      }
      return json({error:'Ruta no encontrada'},404,headers);
    } catch (e) {
      return json({error: e.status === 400 ? 'JSON inválido' : e.status === 413 ? 'Solicitud demasiado grande' : 'No fue posible procesar la solicitud'},e.status === 400 || e.status === 413 ? e.status : 500,headers);
    }
  }
};
