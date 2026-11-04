// API multiusuario de referencia para Cloudflare Workers.
// NO publicar antes de configurar la base D1 v2 y revisar la integracion.
// La API bancaria anterior con secreto compartido NO se incorpora aqui.
import { listPendingMovements } from './list-pending-movements.js';
import { requireFirebaseUser } from './auth/firebase-id-token.js';

const noStore = {'Cache-Control':'no-store'};
const json = (body, status=200) => Response.json(body,{status,headers:noStore});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/v2/health' && request.method === 'GET') {
      return json({ok:true,service:'financia-api-v2'});
    }
    if (url.pathname === '/api/v2/movements/pending') {
      return listPendingMovements(request, env);
    }
    if (url.pathname === '/api/v2/session' && request.method === 'GET') {
      try {
        const uid = await requireFirebaseUser(request);
        return json({ok:true,uid});
      } catch {
        return json({ok:false,error:'No autorizado'},401);
      }
    }
    return json({ok:false,error:'Ruta no encontrada'},404);
  }
};
