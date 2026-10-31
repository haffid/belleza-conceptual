'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const newman = require('../tools/api/node_modules/newman');

async function main() {
  const root = path.resolve(__dirname, '..');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'belleza-api-'));
  // La base y los archivos de la aplicación del usuario nunca se usan.
  process.env.DATABASE_URL = '';
  process.env.NODE_ENV = 'test';
  process.env.UPLOAD_DIR = path.join(temporary, 'uploads');
  process.env.TRUST_PROXY = '0';
  const { openDatabase } = require('../db');
  const { createApp, hashPassword } = require('../server');
  const reportDir = path.join(root, 'reports', 'api');
  fs.mkdirSync(reportDir, { recursive: true });
  const db = await openDatabase({ filename: path.join(temporary, 'api.sqlite') });
  let server;
  try {
    const adminPassword = crypto.randomBytes(18).toString('hex');
    const clientPassword = crypto.randomBytes(18).toString('hex');
    await db.query("INSERT INTO store_users(email,password,role,nombre) VALUES($1,$2,'admin',$3)", ['admin-api@example.test', await hashPassword(adminPassword), 'Administrador de pruebas']);
    const { app } = await createApp({ db, test: true });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const baseUrl = 'http://127.0.0.1:' + server.address().port;
    const collection = JSON.parse(fs.readFileSync(path.join(root, 'postman/Belleza-Conceptual.postman_collection.json'), 'utf8'));
    const environment = JSON.parse(fs.readFileSync(path.join(root, 'postman/local.postman_environment.json'), 'utf8'));
    for (const [key, value] of Object.entries({ baseUrl, adminPassword, clientPassword })) {
      const item = environment.values.find(v => v.key === key);
      if (item) item.value = value;
      else environment.values.push({ key, value, enabled: true });
    }
    const summary = await new Promise((resolve, reject) => newman.run({
      collection, environment,
      reporters: ['cli', 'junit'],
      reporter: { junit: { export: path.join(reportDir, 'newman.xml') } },
      timeoutRequest: 10000,
    }, (error, result) => error ? reject(error) : resolve(result)));
    const executions = summary.run.executions.map(e => ({
      name: e.item.name,
      method: e.request.method,
      status: e.response?.code ?? null,
      assertions: (e.assertions || []).map(a => ({ name: a.assertion, passed: !a.error, error: a.error?.message })),
    }));
    const report = {
      executed_at: new Date().toISOString(),
      tested_revision: process.env.GITHUB_SHA || 'working-tree-local',
      kind: 'Pruebas de API HTTP con Newman; no son unitarias',
      environment: 'Local aislado, SQLite, datos sintéticos y credenciales efímeras',
      requests: executions.length,
      assertions: summary.run.stats.assertions,
      failures: summary.run.failures.map(f => ({ source: f.source?.name, message: f.error.message })),
      executions,
    };
    fs.writeFileSync(path.join(reportDir, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
    const everyRequestChecked = executions.every(e => e.assertions.length >= 3 && e.assertions.every(a => a.passed));
    if (summary.run.failures.length || executions.length < 15 || !everyRequestChecked) throw new Error('E11 falló: se requieren al menos 15 solicitudes y todas sus aserciones aprobadas.');
    console.log(`E11: ${executions.length} solicitudes y ${summary.run.stats.assertions.total} aserciones aprobadas.`);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await db.close();
    const resolved = path.resolve(temporary);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('belleza-api-')) throw new Error('Ruta temporal fuera del alcance esperado; no se elimina.');
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
