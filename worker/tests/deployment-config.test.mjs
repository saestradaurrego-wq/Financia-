import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const config = readFileSync(resolve(root, 'worker/wrangler.toml'), 'utf8');

test('API v2: Worker de pruebas tiene nombre distinto al Worker existente', () => {
  const name = config.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
  assert.equal(name, 'financia-api-v2-staging');
  assert.doesNotMatch(config, /^routes?\s*=/m);
});

test('API v2: no se permite desplegar con identificador D1 de ejemplo', () => {
  // El archivo de ejemplo no debe fingir que ya existe una D1 conectada.
  assert.doesNotMatch(config, /^database_id\s*=\s*"ID_REAL_DE_D1_STAGING"/m);
  assert.match(config, /#\s*database_id\s*=\s*"ID_REAL_DE_D1_STAGING"/);
});
