'use strict';
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
function runScript(name, dependencies, args = [], proc = {}) {
  const filename = path.join(root, 'scripts', name);
  const logs = [], errors = [];
  const context = {
    require: id => Object.hasOwn(dependencies, id) ? dependencies[id] : require(id),
    __dirname: path.dirname(filename),
    process: { argv: ['node', filename, ...args], env: {}, platform: 'linux', ...proc },
    console: { log: (...v) => logs.push(v), error: (...v) => errors.push(v) },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return { context, logs, errors };
}
const validProtection = {
  required_status_checks: { strict: true, contexts: ['E13 / compilacion-pruebas-gate-api-despliegue'] },
  enforce_admins: { enabled: true }, required_pull_request_reviews: {
    required_approving_review_count: 1, dismiss_stale_reviews: true, require_last_push_approval: true,
  }, required_conversation_resolution: { enabled: true },
  allow_force_pushes: { enabled: false }, allow_deletions: { enabled: false },
};
function protectionHarness(mode, { admin = true, protectedBranch = false, protection = validProtection, transportError = false } = {}) {
  const writes = new Map(), calls = [];
  const spawn = mock.fn((executable, args, options) => {
    assert.equal(executable, '/usr/bin/gh');
    const endpoint = args.at(-1); calls.push({ endpoint, put: args.includes('PUT') });
    if (transportError) return { error: new Error('CLI no disponible') };
    const value = endpoint.endsWith('/protection') ? protection : endpoint.includes('/branches/') ? { protected: protectedBranch } : { permissions: { admin } };
    if (args.includes('PUT')) {
      assert.equal(JSON.parse(options.input).required_status_checks.strict, true);
      assert.deepEqual(JSON.parse(options.input).required_status_checks.contexts, ['E13 / compilacion-pruebas-gate-api-despliegue']);
    }
    return { status: 0, stdout: JSON.stringify(value) };
  });
  const result = runScript('configure-e9-protection.cjs', {
    'node:child_process': { spawnSync: spawn },
    'node:fs': { readFileSync: fs.readFileSync, mkdirSync() {}, writeFileSync: (file, value) => writes.set(file, value) },
  }, [mode]);
  return { ...result, calls, writes };
}
test('protección dry run no llama GitHub ni escribe reglas', () => {
  const h = protectionHarness('--dry-run');
  assert.equal(h.calls.length, 0); assert.equal(h.writes.size, 0);
  assert.equal(JSON.parse(h.logs[0][0]).changes_applied, false);
});
test('protección rechaza una cuenta sin administración antes de escribir', () => {
  const h = protectionHarness('--apply', { admin: false });
  assert.equal(h.context.process.exitCode, 1); assert.equal(h.calls.filter(c => c.put).length, 0);
});
test('protección aplica y verifica ambas ramas usando respuestas simuladas', () => {
  const h = protectionHarness('--apply');
  assert.equal(h.context.process.exitCode, undefined); assert.equal(h.calls.filter(c => c.put).length, 2);
  assert.equal(h.writes.size, 1); assert.match([...h.writes.values()][0], /"protections_verified": true/);
});
test('protección no reemplaza una regla existente incompatible', () => {
  const h = protectionHarness('--apply', { protectedBranch: true, protection: {} });
  assert.equal(h.context.process.exitCode, 1); assert.equal(h.calls.filter(c => c.put).length, 0);
  assert.match(h.errors[0][0], /falta el check obligatorio/);
});
test('verificación detecta protección ausente y acepta reglas completas sin PUT', () => {
  assert.equal(protectionHarness('--verify').context.process.exitCode, 1);
  const h = protectionHarness('--verify', { protectedBranch: true });
  assert.equal(h.context.process.exitCode, undefined); assert.equal(h.calls.filter(c => c.put).length, 0);
});
test('protección propaga fallo del transporte y rechaza argumentos ajenos', () => {
  assert.equal(protectionHarness('--apply', { transportError: true }).context.process.exitCode, 1);
  assert.equal(protectionHarness('--other').context.process.exitCode, 1);
});

test('medición de cobertura distingue cero cobertura y todas las líneas cubiertas', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'belleza-lcov-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { summarize } = require('../../scripts/critical-coverage.cjs');
  for (const hits of [0, 1]) {
    const contents = ['server.js', 'db.js', 'index.html'].map(name => {
      const lines = fs.readFileSync(path.join(root, name), 'utf8').split('\n');
      return 'SF:' + name + '\n' + lines.map((_, i) => `DA:${i + 1},${hits}`).join('\n') + '\nend_of_record';
    }).join('\n');
    const filename = path.join(directory, 'coverage.lcov');fs.writeFileSync(filename, contents);
    const report = summarize(filename);
    assert.equal(report.summary.aggregate.percent, hits ? 100 : 0);
    assert.equal(Object.keys(report.summary.modules).length, 3);assert.equal(report.summary.aggregate.total, 341);
  }
});
const names = [...Array.from({ length: 25 }, (_, i) => 'UT-BE-' + i), ...Array.from({ length: 14 }, (_, i) => 'UT-FE-' + i)];
const tap = names.map((n, i) => `ok ${i + 1} - ${n}`).join('\n') + '\n# pass 39\n# fail 0\n# skipped 0\n# todo 0\n';
function unitHarness(result, baseline = false) {
  const files = new Map();
  const summary = { modules: { catalogo: { covered: 10, total: 10, percent: 100 } }, aggregate: { percent: 100 } };
  const run = () => runScript('run-unit-tests.cjs', {
    'node:fs': { rmSync() {}, mkdirSync() {}, readdirSync: () => ['unit.test.cjs'], writeFileSync: (name, value) => files.set(path.basename(name), value) },
    'node:child_process': { spawnSync: () => result },
    './critical-coverage.cjs': { summarize: () => ({ summary, lcov: 'SF:source' }) },
  }, baseline ? ['--baseline'] : [], { stdout: { write() {} }, stderr: { write() {} }, exit: n => { throw new Error('EXIT:' + n); } });
  return { run, files };
}
test('ejecutor unitario conserva nombres por capa y no atribuye historia inexistente', () => {
  const h = unitHarness({ status: 0, stdout: tap });h.run();
  const report = JSON.parse(h.files.get('critical-summary.json'));
  assert.equal(report.tests.backend, 25);assert.equal(report.tests.frontend, 14);assert.equal(report.historical_baseline_confirmed, false);
});
test('ejecutor unitario propaga fallo del proceso y errores de arranque', () => {
  assert.throws(unitHarness({ status: 1, stdout: 'not ok' }).run, /EXIT:1/);
  assert.throws(unitHarness({ error: new Error('arranque') }).run, /arranque/);
});
test('ejecutor rechaza casos omitidos y suite insuficiente y diferencia el control inicial', () => {
  assert.throws(unitHarness({ status: 0, stdout: tap.replace('# skipped 0', '# skipped 1') }).run, /omitidos/);
  assert.throws(unitHarness({ status: 0, stdout: '# pass 1\n' }).run, /al menos 30/);
  const h = unitHarness({ status: 0, stdout: '# pass 1\n' }, true);h.run();
  assert.match(JSON.parse(h.files.get('critical-summary.json')).kind, /inicialización/);
});
function comparison(before, after) {
  const files = new Map();
  const outcome = () => runScript('check-unit-coverage.cjs', {
    'node:fs': { readFileSync: filename => JSON.stringify(filename.includes('CONTROL') ? before : after), writeFileSync: (filename, text) => files.set(filename, text) },
  });
  return { outcome, files };
}
test('comparador exige alcance comparable y aumento técnico mínimo', () => {
  const before = { modules: { x: { total: 10, percent: 10 } }, aggregate: { percent: 10 } };
  const after = { modules: { x: { total: 10, percent: 50 } }, aggregate: { percent: 50 }, tests: {} };
  const h = comparison(before, after);h.outcome();
  assert.equal(JSON.parse([...h.files.values()][0]).historical_baseline_confirmed, false);
  assert.throws(comparison(before, { ...after, modules: { x: { total: 11, percent: 50 } } }).outcome, /alcance cambió/);
  assert.throws(comparison(before, { ...after, modules: { x: { total: 10, percent: 11 } } }).outcome, /menor a 20/);
});
