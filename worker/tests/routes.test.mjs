import test from 'node:test';
import assert from 'node:assert/strict';
import api from '../index.js';

test('API v2: salud disponible sin datos privados', async () => {
  const res = await api.fetch(new Request('https://example.com/api/v2/health'),{});
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{ok:true,service:'financia-api-v2'});
  assert.equal(res.headers.get('Cache-Control'),'no-store');
});

test('API v2: sesion sin token rechazada', async () => {
  const res = await api.fetch(new Request('https://example.com/api/v2/session'),{});
  assert.equal(res.status,401);
});

test('API v2: movimientos sin token rechazados antes de D1', async () => {
  const res = await api.fetch(new Request('https://example.com/api/v2/movements/pending'),{
    DB:{prepare(){throw Error('D1 should not be called');}}
  });
  assert.equal(res.status,401);
});

test('API v2: ruta desconocida rechazada', async () => {
  const res = await api.fetch(new Request('https://example.com/api/v2/unknown'),{});
  assert.equal(res.status,404);
});

test('API v2: CORS rechaza origen ajeno', async () => {
  const res = await api.fetch(new Request('https://api.example.com/api/v2/health',{
    headers:{Origin:'https://sitio-ajeno.example'}
  }),{FINANCIA_ALLOWED_ORIGIN:'https://financia.sa-estradaurrego.workers.dev'});
  assert.equal(res.status,403);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'),null);
});

test('API v2: preflight autorizado para token Firebase', async () => {
  const origin='https://financia.sa-estradaurrego.workers.dev';
  const res = await api.fetch(new Request('https://api.example.com/api/v2/movements/pending',{
    method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET',
      'Access-Control-Request-Headers':'authorization'}
  }),{FINANCIA_ALLOWED_ORIGIN:origin});
  assert.equal(res.status,204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'),origin);
  assert.match(res.headers.get('Access-Control-Allow-Headers'),/Authorization/);
});

test('API v2: respuesta publica permite solo origen configurado', async () => {
  const origin='https://financia.sa-estradaurrego.workers.dev';
  const res = await api.fetch(new Request('https://api.example.com/api/v2/health',{
    headers:{Origin:origin}
  }),{FINANCIA_ALLOWED_ORIGIN:origin});
  assert.equal(res.status,200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal(res.headers.get('Cache-Control'),'no-store');
});

test('API v2: una falla inesperada devuelve error genérico sin filtrar datos internos', async () => {
  // La ruta de sesión con JWT malformado debe fallar de forma controlada.
    const res = await api.fetch(new Request('https://example.com/api/v2/session',{
      headers:{Authorization:'Bearer malformed.token.value'}
    }),{});
    assert.equal(res.status,401);
    assert.equal(res.headers.get('Cache-Control'),'no-store');
    const body=await res.json();
    assert.equal(body.ok,false);
    assert.doesNotMatch(JSON.stringify(body), /stack|sqlite|database_id|private_key/i);
});

test('API v2: no expone cabeceras CORS ante un origen no autorizado', async () => {
  const res=await api.fetch(new Request('https://api.example.com/api/v2/session',{
    headers:{Origin:'https://sitio-malicioso.example'}
  }),{FINANCIA_ALLOWED_ORIGIN:'https://financia.sa-estradaurrego.workers.dev'});
  assert.equal(res.status,403);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'),null);
  assert.equal(res.headers.get('Cache-Control'),'no-store');
});

test('API v2: readiness rechaza D1 sin configurar', async () => {
  const res=await api.fetch(new Request('https://example.com/api/v2/ready'),{});
  assert.equal(res.status,503);
  assert.equal((await res.json()).ready,false);
  assert.equal(res.headers.get('Cache-Control'),'no-store');
});

test('API v2: readiness rechaza esquema D1 incompleto', async () => {
  const res=await api.fetch(new Request('https://example.com/api/v2/ready'),{
    DB:{prepare(){return {async first(){throw Error('tabla no existe');}};}}
  });
  assert.equal(res.status,503);
  assert.equal((await res.json()).ready,false);
});

test('API v2: readiness confirma tablas esenciales en D1', async () => {
  const sql=[];
  const res=await api.fetch(new Request('https://example.com/api/v2/ready'),{
    DB:{prepare(query){sql.push(query);return {async first(){return null;}};}}
  });
  assert.equal(res.status,200);
  assert.equal((await res.json()).ready,true);
  assert.equal(sql.length,2);
  assert.match(sql[0],/bank_accounts_v2/);
  assert.match(sql[1],/bank_movements_v2/);
});
