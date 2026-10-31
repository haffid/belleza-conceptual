'use strict';
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Database and password doubles prevent CLI tests from touching real accounts,
// loading .env, opening network connections or copying private customer data.
async function command(file, { args = [], env = {}, open, hash = mock.fn(async () => 'hashed') } = {}) {
  const errors = [], logs = [];
  const process = { argv: ['node', file, ...args], env: { ...env } };
  const filename = path.resolve(__dirname, '../..', file);
  await vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    process, console: { error: x => errors.push(x), log: x => logs.push(x) },
    require(id) {
      if (id === 'dotenv') return { config() {} };
      if (id === './db') return { openDatabase: open };
      if (id === './server') return { hashPassword: hash };
      throw new Error('Unexpected dependency: ' + id);
    },
  }, { filename });
  return { process, errors, logs, hash };
}
function database(query = async () => ({ rows: [] })) {
  const db = { query: mock.fn(query), close: mock.fn(async () => {}) };
  db.transaction = mock.fn(async fn => fn(db));
  return db;
}
const credentials = { ADMIN_EMAIL: ' Admin@Example.test ', ADMIN_PASSWORD: 'synthetic-password' };

test('admin normaliza el correo, cifra la contraseña y asigna el rol en el servidor', async () => {
  const db = database();
  const h = await command('manage.js', { args: ['admin'], env: credentials, open: async () => db });
  const insert = db.query.mock.calls[1].arguments;
  assert.match(insert[0], /'admin'/);
  assert.deepEqual(Array.from(insert[1]), ['admin@example.test', 'hashed', 'Administrador']);
  assert.equal(h.hash.mock.calls[0].arguments[0], credentials.ADMIN_PASSWORD);
  assert.equal(h.errors.length, 0);
  assert.equal(db.close.mock.callCount(), 1);
});
test('admin rechaza correo inválido y contraseñas fuera del rango antes de escribir', async () => {
  for (const env of [{}, { ...credentials, ADMIN_EMAIL: 'incorrecto' }, { ...credentials, ADMIN_PASSWORD: 'corta' }, { ...credentials, ADMIN_PASSWORD: 'x'.repeat(129) }]) {
    const db = database();
    const h = await command('manage.js', { args: ['admin'], env, open: async () => db });
    assert.equal(h.process.exitCode, 1);
    assert.match(h.errors[0], /ADMIN_EMAIL/);
    assert.equal(db.query.mock.callCount(), 0);
    assert.equal(h.hash.mock.callCount(), 0);
    assert.equal(db.close.mock.callCount(), 1);
  }
});
test('admin no eleva una cuenta existente ni vuelve a cifrar su contraseña', async () => {
  const db = database(async () => ({ rows: [{ id: 1 }] }));
  const h = await command('manage.js', { args: ['admin'], env: credentials, open: async () => db });
  assert.match(h.errors[0], /correo ya existe/);
  assert.equal(db.query.mock.callCount(), 1);
  assert.equal(h.hash.mock.callCount(), 0);
  assert.equal(db.close.mock.callCount(), 1);
});
test('seed crea nueve productos dentro de una transacción y conserva el agotado', async () => {
  const db = database();
  const h = await command('manage.js', { args: ['seed'], open: async () => db });
  assert.equal(db.transaction.mock.callCount(), 1);
  const inserts = db.query.mock.calls.filter(c => c.arguments[0].startsWith('INSERT'));
  assert.equal(inserts.length, 9);
  assert.equal(inserts.filter(c => c.arguments[1][4] === 0).length, 1);
  assert.ok(inserts.every(c => Number.isInteger(c.arguments[1][3]) && c.arguments[1][3] > 0));
  assert.equal(h.errors.length, 0);
});
test('seed protege un catálogo existente y cierra la conexión', async () => {
  const db = database(async () => ({ rows: [{ id: 7 }] }));
  const h = await command('manage.js', { args: ['seed'], open: async () => db });
  assert.match(h.errors[0], /No se modificaron existencias/);
  assert.equal(db.query.mock.callCount(), 1);
  assert.equal(db.close.mock.callCount(), 1);
});
test('comandos desconocidos y errores de datos producen salida fallida y liberan recursos', async () => {
  for (const args of [[], ['admin']]) {
    const db = database(async () => { throw new Error('database unavailable'); });
    const h = await command('manage.js', { args, env: credentials, open: async () => db });
    assert.equal(h.process.exitCode, 1);
    assert.match(h.errors[0], args.length ? /database unavailable/ : /Usa:/);
    assert.equal(db.close.mock.callCount(), 1);
  }
});
test('migración exige un destino explícito sin abrir bases de datos', async () => {
  const open = mock.fn();
  const h = await command('migrate-postgres.js', { open });
  assert.equal(h.process.exitCode, 1);
  assert.equal(open.mock.callCount(), 0);
});
test('migración parametriza filas, reajusta secuencias y excluye sesiones', async () => {
  const source = database(async sql => ({ rows: sql.includes('store_users') ? [{ id: 8, nombre: "O'Neil" }] : [] }));
  const target = database();
  const open = mock.fn(async options => options ? target : source);
  const h = await command('migrate-postgres.js', { env: { DATABASE_URL: 'postgres://synthetic' }, open });
  assert.equal(h.process.env.DATABASE_URL, undefined);
  assert.equal(open.mock.calls[0].arguments.length, 0);
  assert.equal(open.mock.calls[1].arguments[0].url, 'postgres://synthetic');
  const inserts = target.query.mock.calls.filter(c => c.arguments[0].startsWith('INSERT'));
  assert.equal(inserts.length, 1);
  assert.match(inserts[0].arguments[0], /VALUES \(\$1,\$2\)/);
  assert.deepEqual(Array.from(inserts[0].arguments[1]), [8, "O'Neil"]);
  assert.equal(target.query.mock.calls.filter(c => c.arguments[0].includes('setval')).length, 5);
  assert.ok(source.query.mock.calls.every(c => !c.arguments[0].includes('store_sessions')));
  assert.equal(target.transaction.mock.callCount(), 1);
  assert.equal(source.close.mock.callCount(), 1);
  assert.equal(target.close.mock.callCount(), 1);
  assert.equal(h.errors.length, 0);
});
test('migración no sobrescribe un destino con datos o sesiones', async () => {
  for (const occupied of ['store_users', 'store_sessions']) {
    const source = database();
    const target = database(async sql => ({ rows: sql.includes(occupied) ? [{ exists: 1 }] : [] }));
    const h = await command('migrate-postgres.js', { env: { DATABASE_URL: 'postgres://synthetic' }, open: async options => options ? target : source });
    assert.match(h.errors[0], /debe estar vacío/);
    assert.equal(source.query.mock.callCount(), 0);
    assert.ok(target.query.mock.calls.every(c => !c.arguments[0].startsWith('INSERT')));
    assert.equal(source.close.mock.callCount(), 1);
    assert.equal(target.close.mock.callCount(), 1);
  }
});
test('migración libera el origen cuando falla abrir el destino', async () => {
  const source = database();
  const h = await command('migrate-postgres.js', { env: { DATABASE_URL: 'postgres://synthetic' }, open: async options => { if (options) throw new Error('connection refused'); return source; } });
  assert.equal(h.process.exitCode, 1);
  assert.match(h.errors[0], /connection refused/);
  assert.equal(source.close.mock.callCount(), 1);
});
test('migración propaga errores de lectura y cierra ambas conexiones', async () => {
  const source = database(async () => { throw new Error('read failure'); });
  const target = database();
  const h = await command('migrate-postgres.js', { env: { DATABASE_URL: 'postgres://synthetic' }, open: async options => options ? target : source });
  assert.equal(h.process.exitCode, 1);
  assert.match(h.errors[0], /read failure/);
  assert.equal(source.close.mock.callCount(), 1);
  assert.equal(target.close.mock.callCount(), 1);
});
