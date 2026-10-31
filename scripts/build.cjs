'use strict';
const fs = require('node:fs');
const path = require('node:path');

function build(root, transform, revision = 'local') {
  const output = path.join(root, 'dist');
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(path.join(root, 'reports/ci'), { recursive: true });
  const manifest = { revision, files: [], compiler: 'esbuild', target: 'Node.js 22 / ES2022' };
  for (const name of ['server.js', 'db.js', 'manage.js', 'migrate-postgres.js', 'store-ui.js', 'store.css']) {
    const browser = name === 'store-ui.js' || name.endsWith('.css');
    const options = { loader: name.endsWith('.css') ? 'css' : 'js', target: browser ? 'es2022' : 'node22', minify: browser };
    const result = transform(fs.readFileSync(path.join(root, name), 'utf8'), options);
    fs.writeFileSync(path.join(output, name), result.code);
    manifest.files.push(name);
  }
  for (const name of ['index.html', 'account.html', 'admin.html']) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    const compiled = source.replace(/<script>([\s\S]*?)<\/script>/g, (_whole, code) =>
      '<script>' + transform(code, { loader: 'js', target: 'es2022', minify: true }).code + '</script>');
    fs.writeFileSync(path.join(output, name), compiled);
    manifest.files.push(name);
  }
  fs.writeFileSync(path.join(output, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
module.exports = { build };
if (require.main === module) {
  try {
    build(path.resolve(__dirname, '..'), require('esbuild').transformSync,
      process.env.GITHUB_SHA || process.env.RENDER_GIT_COMMIT || 'local');
    console.log('Compilación esbuild completada: artefacto dist listo para pruebas y despliegue.');
  } catch { console.error('La compilación falló; no continuar con el despliegue.'); process.exitCode = 1; }
}
