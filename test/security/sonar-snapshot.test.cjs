'use strict';
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('el snapshot guarda datos remotos sin interpolarlos en el log de CI', async () => {
  const writes = new Map(), logs = [];
  const malicious = '\r\n::error::mensaje inyectado';
  const fetchMock = mock.fn(async url => ({ ok: true, json: async () => {
    if (url.pathname.includes('measures')) return { component: { measures: [{ metric: 'code_smells', value: malicious }] } };
    if (url.pathname.includes('qualitygates')) return { projectStatus: { status: 'OK' } };
    return { paging: { total: 0 }, issues: [] };
  } }));
  const context = {
    require(name) { return name === 'node:fs/promises' ? { mkdir: async () => {}, writeFile: async (file, text) => writes.set(path.basename(file), text) } : require(name); },
    process: { argv: ['node', 'snapshot'], env: {} }, URL, URLSearchParams, AbortSignal,
    fetch: fetchMock, console: { log: text => logs.push(text), error: text => logs.push(text) },
  };
  await vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../scripts/sonar-snapshot.cjs'), 'utf8'), context);
  assert.equal(fetchMock.mock.callCount(), 3);
  assert.equal(JSON.parse(writes.get('summary.json')).metrics.code_smells, malicious);
  assert.deepEqual(logs, ['Snapshot de SonarCloud guardado en los archivos JSON.']);
});
