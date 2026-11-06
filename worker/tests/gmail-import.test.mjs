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
test('Gmail: importa pendientes en un único lote atómico',async()=>{
  const statements=[];
  const db={
    prepare(sql){return {bind(...args){return {
      sql,args,async first(){return {id:'account1'};}
    };}};},
    async batch(items){statements.push(...items);return items.map(()=>({meta:{changes:1}}));}
  };
  const r=await importGmailPurchases(req({purchases:[purchase,{...purchase,transactionId:'gmail-message-456'}]}),{...env,DB:db});
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{ok:true,saved:2,duplicates:0,status:'pending'});
  assert.equal(statements.length,2);
  for(const statement of statements){
    assert.match(statement.sql,/INSERT OR IGNORE/);
    assert.equal(statement.args.at(-2),'user1');
    assert.equal(statement.args.at(-3),'account1');
    assert.equal(statement.args[7],'pending');
  }
});
test('Gmail: duplicados no se contabilizan como nuevos',async()=>{
  const db={
    prepare(){return {bind(){return {async first(){return {id:'account1'};}};}};},
    async batch(){return [{meta:{changes:0}}];}
  };
  const r=await importGmailPurchases(req({purchases:[purchase]}),{...env,DB:db});
  assert.deepEqual(await r.json(),{ok:true,saved:0,duplicates:1,status:'pending'});
});
test('Gmail: cuenta inexistente devuelve 503 sin insertar',async()=>{
  let batches=0;
  const db={
    prepare(){return {bind(){return {async first(){return null;}};}};},
    async batch(){batches++;return [];}
  };
  const r=await importGmailPurchases(req({purchases:[purchase]}),{...env,DB:db});
  assert.equal(r.status,503);
  assert.equal(batches,0);
});
test('Gmail: error de lote no informa éxito parcial',async()=>{
  const db={
    prepare(){return {bind(){return {async first(){return {id:'account1'};}};}};},
    async batch(){throw Error('D1 batch failed');}
  };
  const r=await importGmailPurchases(req({purchases:[purchase]}),{...env,DB:db});
  assert.equal(r.status,500);
  assert.equal((await r.json()).ok,false);
});
