import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloudflare/worker-compras-v2.js';

function fakeDB() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              if (!sql.includes('INSERT OR IGNORE')) throw Error('SQL no esperado');
              const [id, owner_uid, external_id, comercio, monto_clp, fecha, banco] = values;
              if (rows.some(r => r.owner_uid === owner_uid && r.external_id === external_id)) return {meta:{changes:0}};
              rows.push({id,owner_uid,external_id,comercio,monto_clp,fecha,banco});
              return {meta:{changes:1}};
            }
          };
        }
      };
    }
  };
}
const env = () => ({DB:fakeDB(),FIREBASE_PROJECT_ID:'test-project',INGEST_SECRET:'secret-test-123',INGEST_OWNER_UID:'owner-1',ALLOWED_ORIGIN:'https://app.example'});
const ingest = (data, secret='secret-test-123') => new Request('https://api.example/api/v2/ingest',{method:'POST',headers:{'x-ingest-secret':secret,'content-type':'application/json'},body:JSON.stringify(data)});
const purchase = (banco,external_id='transaction-0001') => ({banco,external_id,comercio:'Comercio de prueba',monto_clp:15990,fecha:'2026-11-11'});

test('rechaza lectura de pendientes sin autenticación',async()=>{
  const response = await worker.fetch(new Request('https://api.example/api/v2/compras/pendientes'),env());
  assert.equal(response.status,401);
});
test('rechaza origen web distinto del autorizado',async()=>{
  const response = await worker.fetch(new Request('https://api.example/api/v2/compras/pendientes',{headers:{origin:'https://otro.example'}}),env());
  assert.equal(response.status,403);
});
test('rechaza ingestión sin secreto correcto',async()=>{
  const e=env(); const response=await worker.fetch(ingest(purchase('banco_de_chile'),'incorrecto'),e);
  assert.equal(response.status,401); assert.equal(e.DB.rows.length,0);
});
test('acepta bancos distintos con identificador de operación coincidente',async()=>{
  const e=env();
  for(const bank of ['banco_de_chile','santander']){
    const response=await worker.fetch(ingest(purchase(bank)),e);
    assert.equal(response.status,200);
    assert.equal((await response.json()).insertada,true);
  }
  assert.equal(e.DB.rows.length,2);
  assert.deepEqual(e.DB.rows.map(r=>r.banco),['banco_de_chile','santander']);
});
test('reintento del mismo banco no duplica la compra',async()=>{
  const e=env();
  await worker.fetch(ingest(purchase('banco_de_chile')),e);
  const response=await worker.fetch(ingest(purchase('banco_de_chile')),e);
  assert.equal(response.status,200);
  assert.equal((await response.json()).duplicada,true);
  assert.equal(e.DB.rows.length,1);
});
test('rechaza fechas inexistentes y montos negativos',async()=>{
  const e=env();
  for(const data of [{...purchase('banco_de_chile'),fecha:'2026-02-30'},{...purchase('banco_de_chile'),monto_clp:-10}]){
    const response=await worker.fetch(ingest(data),e);
    assert.equal(response.status,400);
  }
  assert.equal(e.DB.rows.length,0);
});
