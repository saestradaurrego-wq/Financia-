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
