'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { summarize } = require('./critical-coverage.cjs');
const root = path.resolve(__dirname, '..');
const baseline = process.argv.includes('--baseline');
const report = path.join(root, 'reports', baseline ? 'baseline' : 'unit');
fs.rmSync(report, { recursive: true, force: true });
fs.mkdirSync(report, { recursive: true });
const directory = baseline ? 'test/baseline' : 'test/unit';
const tests = fs.readdirSync(path.join(root, directory)).filter(f => f.endsWith('.test.cjs')).sort().map(f => directory + '/' + f);
const result = spawnSync(process.execPath, [
  '--test', '--experimental-test-coverage',
  '--test-coverage-include=server.js', '--test-coverage-include=index.html', '--test-coverage-include=db.js',
  '--test-reporter=tap', '--test-reporter-destination=stdout',
  '--test-reporter=lcov', '--test-reporter-destination=' + path.join(report, 'raw.lcov'),
  ...tests,
], { cwd: root, encoding: 'utf8' });
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
fs.writeFileSync(path.join(report, 'execution.tap'), (result.stdout || '') + (result.stderr || ''));
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
const coverage = summarize(path.join(report, 'raw.lcov'));
coverage.summary.kind = baseline ? 'control de inicialización de esta intervención; no es línea base histórica de Fase 1' : 'suite unitaria aportada en E10';
coverage.summary.historical_baseline_confirmed = false;
coverage.summary.tested_revision = process.env.GITHUB_SHA || 'working-tree-local';
const names = [...(result.stdout || '').matchAll(/^ok \d+ - (UT-[^\r\n]+)/gm)].map(m => m[1]);
const count = key => Number((result.stdout || '').match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1] || 0);
coverage.summary.tests = { backend: names.filter(n => n.startsWith('UT-BE-')).length, frontend: names.filter(n => n.startsWith('UT-FE-')).length, passed: count('pass'), failed: count('fail'), skipped: count('skipped'), todo: count('todo'), names };
if (!baseline && (count('skipped') || count('todo'))) throw new Error('La entrega no debe contar casos omitidos o pendientes como unitarias aprobadas.');
fs.writeFileSync(path.join(report, 'critical-summary.json'), JSON.stringify(coverage.summary, null, 2) + '\n');
fs.writeFileSync(path.join(report, 'critical.lcov'), coverage.lcov);
if (!baseline && (coverage.summary.tests.backend < 1 || coverage.summary.tests.frontend < 1 || coverage.summary.tests.backend + coverage.summary.tests.frontend < 30)) throw new Error('E10 requiere al menos 30 pruebas en ambas capas.');
console.log('\nCobertura del alcance crítico (se excluye el HTML exterior al script):');
for (const [name, metric] of Object.entries(coverage.summary.modules)) console.log(`${name}: ${metric.covered}/${metric.total} (${metric.percent.toFixed(2)} %)`);
console.log(`Total: ${coverage.summary.aggregate.percent.toFixed(2)} %`);
console.log('Reportes: ' + path.relative(root, report));
