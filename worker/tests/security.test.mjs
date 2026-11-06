import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { verifyFirebaseIdToken } from '../auth/firebase-id-token.js';
import { listPendingMovements } from '../list-pending-movements.js';
import { reviewBankMovement } from '../review-bank-movement.js';
import { getEntitlements } from '../entitlements.js';
import { createPendingMovement } from '../create-pending-movement.js';
import { bankAccounts } from '../bank-accounts.js';

const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength:2048});
const jwk = publicKey.export({format:'jwk'});
const kid = 'test-key';
const originalFetch = globalThis.fetch;
function base64url(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}
function tokenFor(uid, overrides = {}) {
  const now = Math.floor(Date.now()/1000);
  const h = base64url({alg:'RS256',kid,typ:'JWT'});
  const p = base64url({iss:'https://securetoken.google.com/financia-57085',aud:'financia-57085',
    sub:uid,iat:now-60,auth_time:now-60,exp:now+3600,...overrides});
  const input = h+'.'+p;
  const signature = createSign('RSA-SHA256').update(input).end().sign(privateKey).toString('base64url');
  return input+'.'+signature;
}
globalThis.fetch = async (url) => {
  assert.match(url, /googleapis.com\/service_accounts/);
  return Response.json({keys:[{...jwk,kid,kty:'RSA',alg:'RS256',use:'sig'}]});
};

test.after(() => {globalThis.fetch = originalFetch;});

test('token Firebase firmado: devuelve el uid verificado', async () => {
  assert.equal(await verifyFirebaseIdToken(tokenFor('usuario-A')), 'usuario-A');
});

test('rechaza audiencia equivocada aunque la firma sea valida', async () => {
  await assert.rejects(verifyFirebaseIdToken(tokenFor('usuario-A',{aud:'otro-proyecto'})));
});

test('rechaza token vencido', async () => {
  await assert.rejects(verifyFirebaseIdToken(tokenFor('usuario-A',{exp:1})));
});

test('rechaza firma modificada', async () => {
  const jwt = tokenFor('usuario-A');
  const pieces = jwt.split('.');
  pieces[1] = base64url({...JSON.parse(Buffer.from(pieces[1],'base64url').toString()),sub:'usuario-B'});
  await assert.rejects(verifyFirebaseIdToken(pieces.join('.')));
});

test('sin autenticacion no consulta D1', async () => {
  let queried = false;
  const env = {DB:{prepare(){queried=true;throw Error('No debe ocurrir');}}};
  const response = await listPendingMovements(new Request('https://example.com/api/pending'),env);
  assert.equal(response.status,401);
  assert.equal(queried,false);
});

test('solo consulta movimientos del uid autenticado y pendientes', async () => {
  const rows = [
    {id:'a1',owner_uid:'usuario-A',status:'pending'},
    {id:'b1',owner_uid:'usuario-B',status:'pending'},
    {id:'a2',owner_uid:'usuario-A',status:'approved'}
  ];
  let sql = '';
  let params = [];
  const env = {DB:{prepare(query) {
    sql = query;
    return {bind(...values) {
      params = values;
      return {async all() {
        return {results:rows.filter(r=>r.owner_uid===params[0]&&r.status===params[1])
          .map(({id,status})=>({id,status}))};
      }};
    }};
  }}};
  const response = await listPendingMovements(new Request('https://example.com/api/pending',{
    headers:{Authorization:'Bearer '+tokenFor('usuario-A')}
  }),env);
  assert.equal(response.status,200);
  assert.match(sql,/WHERE owner_uid = \? AND status = \?/);
  assert.deepEqual(params,['usuario-A','pending']);
  assert.deepEqual((await response.json()).movements,[{id:'a1',status:'pending'}]);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
});

test('un token valido no permite suplantar uid mediante query string', async () => {
  let params;
  const env = {DB:{prepare(){return {bind(...p){params=p;return {async all(){return {results:[]};}};}};}}};
  const response = await listPendingMovements(new Request(
    'https://example.com/api/pending?uid=usuario-B',{
      headers:{Authorization:'Bearer '+tokenFor('usuario-A')}
    }),env);
  assert.equal(response.status,200);
  assert.equal(params[0],'usuario-A');
});

test('revision: solicitud anonima no toca D1', async () => {
  let touched=false;
  const response=await reviewBankMovement(new Request('https://example.com/api/v2/movements/review',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({movementId:'mov-1',decision:'approved'})
  }),{DB:{prepare(){touched=true;throw Error('No debe consultar D1');}}});
  assert.equal(response.status,401);
  assert.equal(touched,false);
});

test('revision: solo actualiza un movimiento pendiente del usuario autenticado', async () => {
  let sql='',params=[];
  const env={DB:{prepare(query){sql=query;return {bind(...values){params=values;return {
    async run(){return {meta:{changes:values[2]==='usuario-A'&&values[3]==='pending'?1:0}};}
  };}};}}};
  const response=await reviewBankMovement(new Request('https://example.com/api/v2/movements/review',{
    method:'POST',headers:{Authorization:'Bearer '+tokenFor('usuario-A'),'Content-Type':'application/json'},
    body:JSON.stringify({movementId:'mov-1',decision:'approved',owner_uid:'usuario-B'})
  }),env);
  assert.equal(response.status,200);
  assert.match(sql,/WHERE id = \? AND owner_uid = \? AND status = \?/);
  assert.deepEqual(params,['approved','mov-1','usuario-A','pending']);
  assert.equal((await response.json()).status,'approved');
});

test('revision: rechazo de datos invalidos antes de D1', async () => {
  let touched=false;
  const response=await reviewBankMovement(new Request('https://example.com/api/v2/movements/review',{
    method:'POST',headers:{Authorization:'Bearer '+tokenFor('usuario-A'),'Content-Type':'application/json'},
    body:JSON.stringify({movementId:'mov-1',decision:'inventado'})
  }),{DB:{prepare(){touched=true;}}});
  assert.equal(response.status,400);
  assert.equal(touched,false);
});

test('revision: una transicion sin filas modificadas devuelve 404', async () => {
  const env={DB:{prepare(){return {bind(){return {async run(){return {meta:{changes:0}};}};}};}}};
  const response=await reviewBankMovement(new Request('https://example.com/api/v2/movements/review',{
    method:'POST',headers:{Authorization:'Bearer '+tokenFor('usuario-A'),'Content-Type':'application/json'},
    body:JSON.stringify({movementId:'mov-2',decision:'rejected'})
  }),env);
  assert.equal(response.status,404);
});

test('planes: usuario sin suscripcion es gratis', async () => {
  const env={DB:{prepare(){return {bind(){return {async first(){return null;}};}};}}};
  const res=await getEntitlements(new Request('https://example.com/api/v2/entitlements',{
    headers:{Authorization:'Bearer '+tokenFor('usuario-A')}
  }),env);
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.plan,'free');
  assert.equal(data.features.bankSync,false);
});

test('planes: premium requiere suscripcion activa en servidor', async () => {
  const env={DB:{prepare(){return {bind(){return {async first(){return {plan:'premium',billing_status:'past_due'};}};}};}}};
  const res=await getEntitlements(new Request('https://example.com/api/v2/entitlements',{
    headers:{Authorization:'Bearer '+tokenFor('usuario-A')}
  }),env);
  assert.equal((await res.json()).plan,'free');
});

test('planes: premium activo habilita funciones premium', async () => {
  let params;
  const env={DB:{prepare(){return {bind(...values){params=values;return {async first(){
    return {plan:'premium',billing_status:'active'};
  }};}};}}};
  const res=await getEntitlements(new Request('https://example.com/api/v2/entitlements',{
    headers:{Authorization:'Bearer '+tokenFor('usuario-A')}
  }),env);
  const data=await res.json();
  assert.equal(params[0],'usuario-A');
  assert.equal(data.plan,'premium');
  assert.equal(data.features.bankSync,true);
});

test('crear pendiente: sin token no toca D1', async () => {
  let queried=false;
  const res=await createPendingMovement(new Request('https://example.com/api/v2/movements/create',{
    method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
  }),{DB:{prepare(){queried=true;}}});
  assert.equal(res.status,401);
  assert.equal(queried,false);
});

test('crear pendiente: identidad y cuenta se filtran en servidor', async () => {
  let sql,params;
  const env={DB:{prepare(q){sql=q;return {bind(...values){params=values;return {
    async run(){return {meta:{changes:1}};}
  };}};}}};
  const res=await createPendingMovement(new Request('https://example.com/api/v2/movements/create',{
    method:'POST',headers:{Authorization:'Bearer '+tokenFor('usuario-A'),'Content-Type':'application/json'},
    body:JSON.stringify({accountId:'cuenta-A',transactionId:'manual-1',description:'Compra',
      amountMinor:-1200,currencyCode:'CLP',bookedAt:'2026-11-04',owner_uid:'usuario-B',
      source:'bank_api',status:'approved'})
  }),env);
  assert.equal(res.status,201);
  assert.match(sql,/WHERE id=\? AND owner_uid=\? AND currency_code=\?/);
  assert.equal(params[1],'manual');
  assert.equal(params[7],'pending');
  assert.deepEqual(params.slice(-3),['cuenta-A','usuario-A','CLP']);
  assert.equal((await res.json()).status,'pending');
});

test('crear pendiente: sin coincidencia o duplicado devuelve conflicto', async () => {
  const env={DB:{prepare(){return {bind(){return {async run(){
    return {meta:{changes:0}};
  }};}};}}};
  const res=await createPendingMovement(new Request('https://example.com/api/v2/movements/create',{
    method:'POST',headers:{Authorization:'Bearer '+tokenFor('usuario-A'),'Content-Type':'application/json'},
    body:JSON.stringify({accountId:'cuenta-ajena',transactionId:'manual-1',description:'Compra',
      amountMinor:-1200,currencyCode:'CLP',bookedAt:'2026-11-04'})
  }),env);
  assert.equal(res.status,409);
});

test('cuentas: acceso anonimo rechazado antes de D1',async()=>{
  let touched=false;
  const res=await bankAccounts(new Request('https://example.com/api/v2/accounts'),
    {DB:{prepare(){touched=true;}}});
  assert.equal(res.status,401);
  assert.equal(touched,false);
});

test('cuentas: listado filtra uid verificado',async()=>{
  let params,sql;
  const env={DB:{prepare(q){sql=q;return {bind(...values){params=values;return {
    async all(){return {results:[]};}
  };}};}}};
  const res=await bankAccounts(new Request('https://example.com/api/v2/accounts',{
    headers:{Authorization:'Bearer '+tokenFor('usuario-A')}
  }),env);
  assert.equal(res.status,200);
  assert.match(sql,/WHERE owner_uid = \?/);
  assert.deepEqual(params,['usuario-A']);
});

test('cuentas: creacion ignora uid y banco falsificados',async()=>{
  let params;
  const env={DB:{prepare(){return {bind(...values){params=values;return {
    async run(){return {meta:{changes:1}};}
  };}};}}};
  const res=await bankAccounts(new Request('https://example.com/api/v2/accounts',{
    method:'POST',headers:{Authorization:'Bearer '+tokenFor('usuario-A'),
      'Content-Type':'application/json'},
    body:JSON.stringify({displayName:'Mi cuenta',countryCode:'CL',currencyCode:'CLP',
      owner_uid:'usuario-B',bank_code:'banco-real',connection_status:'connected'})
  }),env);
  assert.equal(res.status,201);
  assert.equal(params[1],'usuario-A');
  assert.equal(params[3],'manual');
  assert.equal((await res.json()).account.connection_status,'disconnected');
});

test('crear pendiente: rechaza fecha inexistente antes de escribir en D1', async () => {
  let touched=false;
  const res=await createPendingMovement(new Request('https://example.com/api/v2/movements/create',{
    method:'POST',headers:{Authorization:'Bearer '+tokenFor('usuario-A'),'Content-Type':'application/json'},
    body:JSON.stringify({accountId:'cuenta-A',transactionId:'manual-fecha',
      description:'Compra',amountMinor:-1200,currencyCode:'CLP',bookedAt:'2026-02-30'})
  }),{DB:{prepare(){touched=true;throw Error('No debe tocar D1');}}});
  assert.equal(res.status,400);
  assert.equal(touched,false);
});
