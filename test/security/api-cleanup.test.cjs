'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { removeOwnedDirectory } = require('../../scripts/api-cleanup.cjs');
test('limpieza rechaza la raíz temporal sin ejecutar el borrado', t => {
  const remove = t.mock.method(fs, 'rmSync', () => { throw new Error('No debe ejecutarse'); });
  assert.throws(() => removeOwnedDirectory(os.tmpdir()), /fuera del alcance/);
  assert.equal(remove.mock.callCount(), 0);
});
test('limpieza rechaza un nombre ajeno en el directorio temporal', t => {
  const remove = t.mock.method(fs, 'rmSync', () => { throw new Error('No debe ejecutarse'); });
  assert.throws(() => removeOwnedDirectory(path.join(os.tmpdir(), 'datos-del-usuario')), /fuera del alcance/);
  assert.equal(remove.mock.callCount(), 0);
});
test('limpieza admite exclusivamente un directorio creado por el ejecutor', t => {
  const remove = t.mock.method(fs, 'rmSync', () => {});
  const owned = path.join(os.tmpdir(), 'belleza-api-sintetico');
  removeOwnedDirectory(owned);
  assert.equal(remove.mock.callCount(), 1);
  assert.equal(remove.mock.calls[0].arguments[0], path.resolve(owned));
  assert.deepEqual(remove.mock.calls[0].arguments[1], { recursive: true, force: true });
});
