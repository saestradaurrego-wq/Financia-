import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('todos los scripts internos tienen sintaxis JavaScript válida', () => {
  const scripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)];
  assert.ok(scripts.length >= 2);
  for (const [index, match] of scripts.entries()) {
    if (match[1].trim()) assert.doesNotThrow(() => new vm.Script(match[1], {filename:'inline-'+index+'.js'}));
  }
});
test('PWA tiene manifiesto, nombre e icono disponibles', () => {
  assert.match(html, /rel="manifest" href="\\/manifest\\.webmanifest"/);
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name.includes('Financia'));
  for (const icon of manifest.icons) assert.ok(fs.existsSync(new URL('..'+icon.src, import.meta.url)));
});
test('service worker no cachea datos bancarios', () => {
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sw, /caches\\.open\\(/);
  assert.doesNotThrow(() => new vm.Script(sw));
});
test('UI de compras autenticada y con control de duplicados', () => {
  assert.match(html, /user\\.getIdToken\\(\\)/);
  assert.match(html, /importedId === id/);
  assert.match(html, /await window\\.FINANCIA_CLOUD_SAVE\\(nextState\\)/);
  assert.match(html, /data-act="import-approve"/);
});
test('worker v2 usa identidad verificada y consultas parametrizadas', () => {
  const src = fs.readFileSync(new URL('../cloudflare/worker-compras-v2.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new vm.SourceTextModule(src));
  assert.match(src, /verifyFirebaseToken/);
  assert.match(src, /owner_uid=\\?/);
  assert.match(src, /readSmallJson/);
});
