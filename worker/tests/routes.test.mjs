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
