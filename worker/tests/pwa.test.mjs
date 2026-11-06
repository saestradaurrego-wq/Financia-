import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('PWA: manifiesto válido y recursos locales presentes', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons?.length > 0);
  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith('/') && !icon.src.includes('..'));
    assert.ok(existsSync(resolve(root, '.' + icon.src)), `Falta icono ${icon.src}`);
  }
  const html = read('index.html');
  assert.match(html, /rel="manifest"\s+href="\/manifest\.webmanifest"/);
  assert.ok(existsSync(resolve(root, 'offline.html')));
});

test('PWA: service worker limita caché a la pantalla pública offline', () => {
  const sw = read('sw.js');
  assert.match(sw, /const OFFLINE_URL = '\/offline\.html'/);
  assert.match(sw, /event\.request\.mode !== 'navigate'/);
  assert.match(sw, /event\.request\.method !== 'GET'/);
  assert.doesNotMatch(sw, /cache\.put\s*\(/);
  assert.doesNotMatch(sw, /cache\.addAll\s*\(/);
  assert.doesNotMatch(sw, /caches\.match\s*\(\s*event\.request/);
  assert.doesNotMatch(sw, /cache\.add\s*\(\s*event\.request/);
});
