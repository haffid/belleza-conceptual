'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
function removeOwnedDirectory(directory) {
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('belleza-api-')) {
    throw new Error('Ruta temporal fuera del alcance esperado; no se elimina.');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
module.exports = { removeOwnedDirectory };
