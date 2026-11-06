// Reglas de acceso a funciones Premium.
// El plan se consulta en D1, NUNCA se acepta desde el cuerpo de la solicitud.
// No habilita cobros ni proveedores bancarios por si solo.
import { requireFirebaseUser } from './auth/firebase-id-token.js';

export async function getEntitlements(request, env) {
  let uid;
  try { uid = await requireFirebaseUser(request); }
  catch { return Response.json({ok:false,error:'No autorizado'},{status:401,headers:{'Cache-Control':'no-store'}}); }
  if (!env.DB) return Response.json({ok:false,error:'Base de datos no disponible'},{
    status:503,headers:{'Cache-Control':'no-store'}
  });
  try {
    const row = await env.DB.prepare(
      'SELECT plan, billing_status FROM user_subscriptions_v2 WHERE owner_uid = ?'
    ).bind(uid).first();
    // Fail closed: premium requiere estado de cobro confirmado por backend.
    const premium = row?.plan === 'premium' && row?.billing_status === 'active';
    return Response.json({ok:true,plan:premium?'premium':'free',features:{
      manualEntries:true,
      bankSync:premium,
      advancedAnalytics:premium
    }},{headers:{'Cache-Control':'no-store','Vary':'Authorization'}});
  } catch {
    return Response.json({ok:false,error:'No se pudieron consultar los permisos'},{
      status:500,headers:{'Cache-Control':'no-store'}
    });
  }
}
