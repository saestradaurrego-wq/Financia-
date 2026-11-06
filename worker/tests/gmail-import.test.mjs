import test from 'node:test';
import assert from 'node:assert/strict';
import {importGmailPurchases} from '../import-gmail-purchases.js';
const url='https://staging.example/api/v2/import/gmail';
const secret='x'.repeat(40);
const env={FINANCIA_GMAIL_IMPORT_SECRET:secret,FINANCIA_GMAIL_OWNER_UID:'user1',
  FINANCIA_GMAIL_ACCOUNT_ID:'account1'};
const purchase={transactionId:'gmail-message-123',description:'Compra comercio',
  amountMinor:-12500,currencyCode:'CLP',bookedAt:'2026-11-06'};
const req=(body,token=secret)=>new Request(url,{method:'POST',
  headers:{'Content-Type':'application/json','X-Financia-Import-Secret':token},
  body:JSON.stringify(body)});
test('Gmail: rechaza secreto incorrecto sin acceder a D1',async()=>{
  const r=await importGmailPurchases(req({purchases:[purchase]},'bad'),env);
  assert.equal(r.status,401);
});
test('Gmail: rechaza fechas inexistentes antes de D1',async()=>{
  const r=await importGmailPurchases(req({purchases:[{...purchase,bookedAt:'2026-02-30'}]}),{...env,DB:{prepare(){throw Error('No debería consultar D1');}}});
  assert.equal(r.status,400);
});
test('Gmail: requiere configuración de integración',async()=>{
  const r=await importGmailPurchases(req({purchases:[purchase]}),env);
  assert.equal(r.status,503);
});
test('Gmail: importa pendiente con usuario y cuenta fijados en servidor',async()=>{
  let sql='',bindings=[];
  const db={prepare(q){sql=q;return {bind(...args){bindings=args;return {
    async run(){return {meta:{changes:1}};}
  };}};}};
  const r=await importGmailPurchases(req({purchases:[purchase]}),{...env,DB:db});
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{ok:true,saved:1,duplicates:0,status:'pending'});
  assert.match(sql,/INSERT OR IGNORE/);
  assert.match(sql,/bank_email|source_transaction_id/);
  assert.equal(bindings.at(-2),'user1');
  assert.equal(bindings.at(-3),'account1');
  assert.equal(bindings[7],'pending');
});
test('Gmail: duplicados no se contabilizan como nuevos',async()=>{
  const db={prepare(){return {bind(){return {async run(){return {meta:{changes:0}};}};}};}};
  const r=await importGmailPurchases(req({purchases:[purchase]}),{...env,DB:db});
  assert.deepEqual(await r.json(),{ok:true,saved:0,duplicates:1,status:'pending'});
});
