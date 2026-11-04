// Endpoint seguro para importar movimientos pendientes en D1 v2.
// Fuente bancaria: requiere autenticacion Firebase y permisos Premium
// para sincronizacion; los proveedores reales deben conectarse SOLO
// desde servidor, con consentimiento del titular.
import { requireFirebaseUser } from './auth/firebase-id-token.js';

const json=(body,status=200)=>Response.json(body,{status,headers:{
  'Cache-Control':'no-store','Vary':'Authorization'
}});

export async function createPendingMovement(request,env) {
  if(request.method!=='POST') return json({ok:false,error:'Metodo no permitido'},405);
  let uid;
  try {uid=await requireFirebaseUser(request);}
  catch {return json({ok:false,error:'No autorizado'},401);}
  if(!env.DB) return json({ok:false,error:'Base de datos no disponible'},503);
  const type=request.headers.get('Content-Type')||'';
  if(!/^application\/json(?:\s*;|$)/i.test(type)) return json({ok:false,error:'Se requiere JSON'},415);
  let body;
  try {
    const raw=await request.text();
    if(raw.length>4096) return json({ok:false,error:'Solicitud demasiado grande'},413);
    body=JSON.parse(raw);
  } catch {return json({ok:false,error:'JSON invalido'},400);}
  // Solo carga manual por ahora. La importacion bancaria no debe aceptar
  // movimientos declarados como bank_api/bank_email por el navegador.
  const {accountId,transactionId,description,amountMinor,currencyCode,bookedAt}=body||{};
  if(![accountId,transactionId,description,currencyCode,bookedAt].every(
    x=>typeof x==='string'&&x.length>0&&x.length<=200)||
    !Number.isSafeInteger(amountMinor)||amountMinor===0||
    !/^[A-Z]{3}$/.test(currencyCode)||
    !/^\d{4}-\d{2}-\d{2}$/.test(bookedAt)) {
    return json({ok:false,error:'Datos invalidos'},400);
  }
  const id=crypto.randomUUID();
  try {
    // La subconsulta exige cuenta perteneciente al usuario y moneda
    // coincidente. Si falla, no se inserta ningun movimiento.
    const result=await env.DB.prepare(
      'INSERT OR IGNORE INTO bank_movements_v2 '+
      '(id,owner_uid,bank_account_id,source,source_transaction_id,booked_at,'+
      'description,amount_minor,currency_code,status) '+
      'SELECT ?,owner_uid,id,?,?,?,?,?, ?,? FROM bank_accounts_v2 '+
      'WHERE id=? AND owner_uid=? AND currency_code=?'
    ).bind(id,'manual',transactionId,bookedAt,description,amountMinor,
      currencyCode,'pending',accountId,uid,currencyCode).run();
    if(result?.meta?.changes!==1) {
      return json({ok:false,error:'Cuenta no disponible o movimiento duplicado'},409);
    }
    return json({ok:true,id,status:'pending'},201);
  } catch {
    return json({ok:false,error:'No se pudo guardar el movimiento'},500);
  }
}
