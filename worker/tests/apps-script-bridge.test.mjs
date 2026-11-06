import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Ejecuta el Apps Script real con servicios Google simulados: sin red ni secretos.
const source = fs.readFileSync(new URL('../../integrations/google-apps-script/FinanciaV2Staging.gs', import.meta.url), 'utf8');
const endpoint = 'https://financia-api-v2-staging.example-account.workers.dev';
const valid = {
  transactionId:'gmail-message-test-123',
  description:'Comercio de prueba',
  amountMinor:-12500,
  currencyCode:'CLP',
  bookedAt:'2026-11-06'
};
function bridge(overrides={}) {
  const calls=[];
  const properties={
    FINANCIA_V2_STAGING_URL:endpoint,
    FINANCIA_V2_IMPORT_SECRET:'s'.repeat(40),
    ...overrides
  };
  const context={
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k]})},
    UrlFetchApp:{fetch:(url,options)=>{
      calls.push({url,options});
      return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({
        ok:true,saved:1,duplicates:0,status:'pending'
      })};
    }},
    Date,Number,JSON,Object,Array,String,Error
  };
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'FinanciaV2Staging.gs'});
  return {send:items=>context.financiaV2EnviarComprasDePrueba(items),calls};
}
test('Apps Script: envía solo al staging con secreto en header',()=>{
  const {send,calls}=bridge();
  const result=send([valid]);
  assert.equal(result.saved,1);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,endpoint+'/api/v2/import/gmail');
  assert.equal(calls[0].options.headers['X-Financia-Import-Secret'],'s'.repeat(40));
  assert.deepEqual(JSON.parse(calls[0].options.payload).purchases,[valid]);
});
test('Apps Script: bloquea URL externa antes de enviar',()=>{
  const b=bridge({FINANCIA_V2_STAGING_URL:'https://evil.example'});
  assert.throws(()=>b.send([valid]),/staging/);
  assert.equal(b.calls.length,0);
});
test('Apps Script: bloquea monto positivo y fecha imposible antes de enviar',()=>{
  for(const bad of [
    {...valid,amountMinor:12500},
    {...valid,bookedAt:'2026-02-30'},
    {...valid,bookedAt:'not-a-date'}
  ]){
    const b=bridge();
    assert.throws(()=>b.send([bad]),/inválida/);
    assert.equal(b.calls.length,0);
  }
});
test('Apps Script: bloquea IDs repetidos antes de enviar',()=>{
  const b=bridge();
  assert.throws(()=>b.send([valid,valid]),/repetido/);
  assert.equal(b.calls.length,0);
});
test('Apps Script: acepta lote máximo de 20 compras válidas',()=>{
  const b=bridge();
  const items=Array.from({length:20},(_,i)=>({
    ...valid,transactionId:'gmail-test-'+i,
    description:'x'.repeat(200)
  }));
  // 20 compras de 200 caracteres siguen bajo 16 KB.
  assert.equal(b.send(items).saved,1);
  assert.equal(b.calls.length,1);
});
