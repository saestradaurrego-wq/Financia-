// API multiusuario de referencia para Cloudflare Workers.
// NO publicar antes de configurar D1 v2 y verificar las integraciones.
import { listPendingMovements } from './list-pending-movements.js';
import { requireFirebaseUser } from './auth/firebase-id-token.js';
import { reviewBankMovement } from './review-bank-movement.js';
import { getEntitlements } from './entitlements.js';

const json = (body, status=200) => Response.json(body,{
  status,headers:{'Cache-Control':'no-store'}
});

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin || !env.FINANCIA_ALLOWED_ORIGIN) return null;
  // Comparacion exacta, no se permite '*' ni coincidencia por sufijo.
  return origin === env.FINANCIA_ALLOWED_ORIGIN ? origin : null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = allowedOrigin(request,env);
    if (origin && !allowed) return json({ok:false,error:'Origen no autorizado'},403);
    if (request.method === 'OPTIONS') {
      if (!allowed) return json({ok:false,error:'Origen no autorizado'},403);
      return new Response(null,{status:204,headers:{
        'Access-Control-Allow-Origin':allowed,
        'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':'Authorization, Content-Type',
        'Access-Control-Max-Age':'600',
        'Vary':'Origin',
        'Cache-Control':'no-store'
      }});
    }

    const url = new URL(request.url);
    let response;
    if (url.pathname === '/api/v2/health' && request.method === 'GET') {
      response = json({ok:true,service:'financia-api-v2'});
    } else if (url.pathname === '/api/v2/movements/pending') {
      response = await listPendingMovements(request,env);
    } else if (url.pathname === '/api/v2/movements/review') {
      response = await reviewBankMovement(request,env);
    } else if (url.pathname === '/api/v2/entitlements' && request.method === 'GET') {
      response = await getEntitlements(request,env);
    } else if (url.pathname === '/api/v2/session' && request.method === 'GET') {
      try {
        const uid = await requireFirebaseUser(request);
        response = json({ok:true,uid});
      } catch {
        response = json({ok:false,error:'No autorizado'},401);
      }
    } else {
      response = json({ok:false,error:'Ruta no encontrada'},404);
    }
    const headers = new Headers(response.headers);
    headers.set('Cache-Control','no-store');
    if (allowed) {
      headers.set('Access-Control-Allow-Origin',allowed);
      headers.set('Vary','Origin, Authorization');
    }
    return new Response(response.body,{status:response.status,headers});
  }
};
