// Gmail bridge: importación servidor a servidor. No acepta tokens del navegador.
// Requiere secreto independiente, uid y cuenta fijados en variables del Worker.
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function importGmailPurchases(request,env) {
  if(request.method!=='POST') return json({ok:false,error:'Metodo no permitido'},405);
  const expected=env.FINANCIA_GMAIL_IMPORT_SECRET;
  const supplied=request.headers.get('X-Financia-Import-Secret');
  if(typeof expected!=='string'||expected.length<32||
     typeof supplied!=='string'||supplied.length!==expected.length) {
    return json({ok:false,error:'No autorizado'},401);
  }
  // Comparación de tiempo constante para el secreto de integración.
  let diff=0;
  for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^supplied.charCodeAt(i);
  if(diff!==0) return json({ok:false,error:'No autorizado'},401);
  if(!env.DB||!env.FINANCIA_GMAIL_OWNER_UID||!env.FINANCIA_GMAIL_ACCOUNT_ID) {
    return json({ok:false,error:'Integracion no configurada'},503);
  }
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||'')) {
    return json({ok:false,error:'Se requiere JSON'},415);
  }
  let body;
  try {
    const raw=await request.text();
    if(raw.length>16384) return json({ok:false,error:'Solicitud demasiado grande'},413);
    body=JSON.parse(raw);
  } catch {return json({ok:false,error:'JSON invalido'},400);}
  const purchases=body?.purchases;
  if(!Array.isArray(purchases)||purchases.length<1||purchases.length>20) {
    return json({ok:false,error:'Compras invalidas'},400);
  }
  for(const p of purchases) {
    const date=p?.bookedAt;
    const validDate=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&
      !Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
    if(typeof p?.transactionId!=='string'||p.transactionId.length<8||p.transactionId.length>200||
       typeof p.description!=='string'||!p.description.trim()||p.description.length>200||
       !Number.isSafeInteger(p.amountMinor)||p.amountMinor===0||
       p.currencyCode!=='CLP'||!validDate) {
      return json({ok:false,error:'Datos invalidos'},400);
    }
  }
  let saved=0,duplicates=0;
  try {
    for(const p of purchases) {
      const result=await env.DB.prepare(
        'INSERT OR IGNORE INTO bank_movements_v2 '+
        '(id,owner_uid,bank_account_id,source,source_transaction_id,booked_at,'+
        'description,amount_minor,currency_code,status) '+
        'SELECT ?,owner_uid,id,?,?,?,?,?,?,? FROM bank_accounts_v2 '+
        'WHERE id=? AND owner_uid=? AND currency_code=?'
      ).bind(crypto.randomUUID(),'bank_email',p.transactionId,p.bookedAt,
        p.description.trim(),p.amountMinor,'CLP','pending',
        env.FINANCIA_GMAIL_ACCOUNT_ID,env.FINANCIA_GMAIL_OWNER_UID,'CLP').run();
      if(result?.meta?.changes===1) saved++;
      else duplicates++;
    }
    return json({ok:true,saved,duplicates,status:'pending'});
  } catch {
    return json({ok:false,error:'No se pudieron importar las compras'},500);
  }
}
