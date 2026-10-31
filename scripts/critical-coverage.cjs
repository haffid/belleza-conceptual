'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
function readCoverage(file) {
  const files = new Map(); let current;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('SF:')) { current = new Map(); files.set(path.basename(line.slice(3)), current); }
    if (line.startsWith('DA:') && current) { const [number, count] = line.slice(3).split(',').map(Number); current.set(number, count); }
  }
  return files;
}
function scopes() {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const db = fs.readFileSync(path.join(root, 'db.js'), 'utf8');
  const line = (source, marker) => {
    const offset = source.indexOf(marker);
    if (offset < 0) throw new Error('Cambió el alcance; revisar el marcador: ' + marker);
    return source.slice(0, offset).split('\n').length;
  };
  const scriptEnd = html.indexOf('</script>', html.indexOf('<script>'));
  const close = html.lastIndexOf('})();', scriptEnd);
  return {
    catalogo: [
      ['server.js', line(server, "app.get('/api/products'"), line(server, 'fs.mkdirSync(uploadDir') - 1],
      ['index.html', line(html, 'async function loadProducts()'), line(html, 'function updateCartCount()') - 1],
    ],
    pedidos_y_carrito: [
      ['server.js', line(server, "app.post('/api/orders'"), line(server, "app.get('/health'") - 1],
      ['index.html', line(html, 'function updateCartCount()'), line(html, 'document.getElementById("cartBtn")') - 1],
    ],
    persistencia_aplicacion: [['db.js', 1, db.split('\n').length]],
  };
}
function summarize(lcovPath) {
  const coverage = readCoverage(lcovPath);
  const modules = {};
  const mappedLcov = [];
  const sourceFiles = {};
  for (const [name, ranges] of Object.entries(scopes())) {
    let covered = 0, total = 0;
    for (const [file, first, last] of ranges) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      sourceFiles[file] = crypto.createHash('sha256').update(text).digest('hex');
      const lines = text.split('\n');
      const hits = coverage.get(file) || new Map();
      mappedLcov.push('TN:' + name, 'SF:' + file);
      for (let n = first; n <= last; n++) {
        const code = lines[n - 1]?.trim();
        if (!code || code.startsWith('//')) continue;
        const count = hits.get(n) || 0;
        total++; if (count > 0) covered++;
        mappedLcov.push(`DA:${n},${count}`);
      }
      mappedLcov.push('end_of_record');
    }
    modules[name] = { covered, total, percent: Number((100 * covered / total).toFixed(4)), ranges };
  }
  const covered = Object.values(modules).reduce((a, m) => a + m.covered, 0);
  const total = Object.values(modules).reduce((a, m) => a + m.total, 0);
  return {
    summary: { measured_at: new Date().toISOString(), node: process.version, metric: 'líneas no vacías del alcance crítico, con conteos de V8/LCOV', source_commit: 'f3768a14fc7345ff0145b0705574308bf6f19110', source_sha256: sourceFiles, modules, aggregate: { covered, total, percent: Number((100 * covered / total).toFixed(4)) } },
    lcov: mappedLcov.join('\n') + '\n',
  };
}
module.exports = { summarize };
