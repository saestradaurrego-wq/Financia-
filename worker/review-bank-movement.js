// Aprobacion/rechazo de movimientos bancarios de la API v2.
// Requiere migracion de D1 y un Firebase ID token valido.
// El owner_uid proviene exclusivamente de la firma del token.
import { requireFirebaseUser } from './auth/firebase-id-token.js';

const json = (body,status=200) => Response.json(body,{
  status,headers:{'Cache-Control':'no-store','Vary':'Authorization'}
});

export async function reviewBankMovement(request,env) {
  if (request.method !== 'POST') return json({ok:false,error:'Metodo no permitido'},405);
  let uid;
  try { uid = await requireFirebaseUser(request); }
  catch { return json({ok:false,error:'No autorizado'},401); }
  if (!env.DB) return json({ok:false,error:'Base de datos no disponible'},503);

  const type = request.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(type)) {
    return json({ok:false,error:'Se requiere JSON'},415);
  }
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json({ok:false,error:'Solicitud demasiado grande'},413);
    body = JSON.parse(raw);
  } catch { return json({ok:false,error:'JSON invalido'},400); }
  const id = body && body.movementId;
  const decision = body && body.decision;
  if (typeof id !== 'string' || id.length < 1 || id.length > 128 ||
      !['approved','rejected'].includes(decision)) {
    return json({ok:false,error:'Datos invalidos'},400);
  }

  try {
    // Transicion atomica. Un movimiento ya aprobado o rechazado no
    // puede volver a cambiar de estado. El uid no viene del cliente.
    const result = await env.DB.prepare(
      'UPDATE bank_movements_v2 SET status = ?, updated_at = CURRENT_TIMESTAMP ' +
      'WHERE id = ? AND owner_uid = ? AND status = ?'
    ).bind(decision,id,uid,'pending').run();
    if (result?.meta?.changes !== 1) {
      return json({ok:false,error:'Movimiento no disponible o ya revisado'},404);
    }
    return json({ok:true,movementId:id,status:decision});
  } catch {
    return json({ok:false,error:'No se pudo revisar el movimiento'},500);
  }
}
