// Cuentas manuales v2, aisladas por Firebase uid.
import { requireFirebaseUser } from './auth/firebase-id-token.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{
  'Cache-Control':'no-store','Vary':'Authorization'
}});
export async function bankAccounts(request,env) {
  if(!['GET','POST'].includes(request.method)) return json({ok:false,error:'Metodo no permitido'},405);
  let uid;
  try {uid=await requireFirebaseUser(request);}
  catch {return json({ok:false,error:'No autorizado'},401);}
  if(!env.DB) return json({ok:false,error:'Base de datos no disponible'},503);
  try {
    if(request.method==='GET') {
      const {results}=await env.DB.prepare(
        'SELECT id,display_name,country_code,bank_code,currency_code,connection_status '+
        'FROM bank_accounts_v2 WHERE owner_uid = ? ORDER BY created_at DESC LIMIT 100'
      ).bind(uid).all();
      return json({ok:true,accounts:results||[]});
    }
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||'')) {
      return json({ok:false,error:'Se requiere JSON'},415);
    }
    const raw=await request.text();
    if(raw.length>2048) return json({ok:false,error:'Solicitud demasiado grande'},413);
    let body;
    try {body=JSON.parse(raw);} catch {return json({ok:false,error:'JSON invalido'},400);}
    const {displayName,countryCode,currencyCode}=body||{};
    if(typeof displayName!=='string'||displayName.trim().length<1||
       displayName.length>100||typeof countryCode!=='string'||!/^[A-Z]{2}$/.test(countryCode)||
       typeof currencyCode!=='string'||!/^[A-Z]{3}$/.test(currencyCode)) {
      return json({ok:false,error:'Datos invalidos'},400);
    }
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO bank_accounts_v2 '+
      '(id,owner_uid,country_code,bank_code,display_name,currency_code) '+
      'VALUES(?,?,?,?,?,?)').bind(id,uid,countryCode,'manual',
      displayName.trim(),currencyCode).run();
    return json({ok:true,account:{id,display_name:displayName.trim(),
      country_code:countryCode,currency_code:currencyCode,
      connection_status:'disconnected'}},201);
  } catch {
    return json({ok:false,error:'No se pudo procesar la cuenta'},500);
  }
}
