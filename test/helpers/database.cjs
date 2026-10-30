'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { mock } = require('node:test');
async function database({ query = async () => ({ rows: [] }), transactionQuery = async () => ({ rows: [] }) } = {}) {
  const client = { query: mock.fn(transactionQuery), release: mock.fn() };
  const pool = { query: mock.fn(query), connect: mock.fn(async () => client), end: mock.fn(async () => {}) };
  const filename = path.resolve(__dirname, '../../db.js');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.require = id => id === 'pg' ? { Pool: class { constructor() { return pool; } } } : require(id);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  const db = await loaded.exports.openDatabase({ url: 'postgresql://unit.invalid/isolated' });
  pool.query.mock.resetCalls();
  return { db, pool, client };
}
module.exports = { database };
