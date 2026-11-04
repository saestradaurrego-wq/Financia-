// Ejemplo de endpoint de solo lectura para movimientos pendientes.
// NO reemplaza el Worker existente. Integrar tras migracion D1 y pruebas.
import { requireFirebaseUser } from './auth/firebase-id-token.js';

export async function listPendingMovements(request, env) {
  if (request.method !== 'GET') {
    return new Response('Metodo no permitido', {status: 405});
  }
  let uid;
  try {
    uid = await requireFirebaseUser(request);
  } catch {
    return Response.json({ok:false,error:'No autorizado'}, {
      status:401,headers:{'Cache-Control':'no-store'}
    });
  }
  if (!env.DB) {
    return Response.json({ok:false,error:'Base de datos no disponible'}, {
      status:503,headers:{'Cache-Control':'no-store'}
    });
  }
  try {
    // Owner uid is ALWAYS derived from the verified Firebase token.
    const {results} = await env.DB.prepare(
      'SELECT id, bank_account_id, source, booked_at, description, ' +
      'amount_minor, currency_code, status FROM bank_movements_v2 ' +
      'WHERE owner_uid = ? AND status = ? ORDER BY booked_at DESC LIMIT 100'
    ).bind(uid, 'pending').all();
    return Response.json({ok:true,movements:results || []}, {
      headers:{'Cache-Control':'no-store','Vary':'Authorization'}
    });
  } catch {
    return Response.json({ok:false,error:'No se pudieron obtener los movimientos'}, {
      status:500,headers:{'Cache-Control':'no-store'}
    });
  }
}
