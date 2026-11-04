import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { verifyFirebaseIdToken } from '../auth/firebase-id-token.js';
import { listPendingMovements } from '../list-pending-movements.js';

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
