'use strict';
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('../../scripts/build.cjs');
const { deploymentConfig, deploy } = require('../../scripts/deploy-render.cjs');
const revision = 'a'.repeat(40);
const environment = { GITHUB_SHA: revision, RENDER_DEPLOY_HOOK_URL: 'https://api.render.com/deploy/srv-test?key=ficticia', APP_BASE_URL: 'https://example.test' };

test('build compila JS y CSS y conserva los archivos HTML con su revisión', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'belleza-build-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of ['server.js', 'db.js', 'manage.js', 'migrate-postgres.js', 'store-ui.js', 'store.css']) fs.writeFileSync(path.join(root, file), 'source');
  for (const file of ['index.html', 'account.html', 'admin.html']) fs.writeFileSync(path.join(root, file), '<html><script>let x = 1;</script></html>');
  const compiler = mock.fn((source, options) => ({ code: options.loader + ':' + source }));
  const result = build(root, compiler, revision);
  assert.equal(result.files.length, 9); assert.equal(compiler.mock.callCount(), 9);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'dist/build-manifest.json'))).revision, revision);
  assert.match(fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8'), /<script>js:let x = 1;/);
  assert.equal(compiler.mock.calls[0].arguments[1].target, 'node22');
  assert.equal(compiler.mock.calls[5].arguments[1].loader, 'css');
});
test('build conserva el fallo del compilador y no fabrica un manifiesto', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'belleza-build-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'server.js'), 'invalid');
  assert.throws(() => build(root, () => { throw new Error('Error del compilador'); }));
  assert.equal(fs.existsSync(path.join(root, 'dist/build-manifest.json')), false);
});
test('despliegue utiliza la revisión validada y no acepta un hook ajeno', () => {
  const config = deploymentConfig(environment);
  assert.equal(new URL(config.hook).searchParams.get('ref'), revision);
  assert.throws(() => deploymentConfig({ ...environment, RENDER_DEPLOY_HOOK_URL: 'https://example.test/deploy/srv-x?key=ficticia' }));
  assert.throws(() => deploymentConfig({ ...environment, GITHUB_SHA: '' }));
  assert.throws(() => deploymentConfig({ ...environment, APP_BASE_URL: 'http://example.test' }));
});
test('despliegue no confunde health de la revisión anterior con éxito', async () => {
  let healthCalls = 0;
  const request = mock.fn(async (_url, options) => options?.method === 'POST' ? { status: 200 } : {
    status: 200, json: async () => ({ status: 'ok', revision: ++healthCalls === 1 ? 'old' : revision }),
  });
  const report = await deploy(deploymentConfig(environment), request, async () => {}, 3);
  assert.equal(report.revision, revision); assert.equal(healthCalls, 2);
  assert.equal(JSON.stringify(report).includes('ficticia'), false);
});
test('despliegue fallido o versión incorrecta hace fallar la etapa', async () => {
  const config = deploymentConfig(environment);
  await assert.rejects(deploy(config, async () => ({ status: 401 }), async () => {}, 1));
  await assert.rejects(deploy(config, async (_url, options) => options?.method ? { status: 202 } : { status: 503 }, async () => {}, 1));
});
test('despliegue tolera reinicio y solo acepta health sano con el mismo SHA', async () => {
  let attempts = 0;
  const request = async (_url, options) => {
    if (options?.method) return { status: 202 };
    if (++attempts === 1) throw new Error('reinicio');
    return { status: 200, json: async () => ({ status: 'ok', revision }) };
  };
  assert.equal((await deploy(deploymentConfig(environment), request, async () => {}, 2)).status, 'deployed');
});
