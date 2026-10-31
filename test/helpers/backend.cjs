'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { mock } = require('node:test');

// Se cargan los controladores originales con dependencias sustituidas.
// No se abre HTTP, no se conecta una base ni se modifica server.js.
async function backend({ query = async () => ({ rows: [] }), user } = {}) {
  const routes = new Map();
  const app = {};
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    app[method] = (url, ...handlers) => { routes.set(method.toUpperCase() + ' ' + url, handlers.at(-1)); return app; };
  }
  for (const method of ['use', 'set', 'param']) app[method] = () => app;
  const noop = (_req, _res, next) => next?.();
  const express = () => app;
  express.json = express.static = () => noop;
  const multer = () => ({ single: () => noop });
  multer.memoryStorage = () => ({});
  multer.MulterError = class MulterError extends Error {};
  const identity = user || { id: 7, email: 'cliente@example.test', role: 'customer', nombre: 'Cliente' };
  const calls = [];
  const db = {
    postgres: false,
    query: mock.fn(async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('FROM store_sessions s JOIN store_users')) return { rows: [identity] };
      return query(sql, params);
    }),
  };
  db.transaction = mock.fn(async fn => fn({ query: db.query }));
  const dependencies = {
    dotenv: { config() {} }, express,
    helmet: () => noop, 'express-rate-limit': { rateLimit: () => noop }, multer,
    './db': { openDatabase() { throw new Error('Una unitaria no debe abrir la base real.'); } },
    'node:fs': { ...fs, mkdirSync: mock.fn(), promises: { ...fs.promises, writeFile: mock.fn() } },
  };
  const filename = path.resolve(__dirname, '../../server.js');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = id => Object.hasOwn(dependencies, id) ? dependencies[id] : require(id);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  await loaded.exports.createApp({ db, test: true });
  async function invoke(method, url, { body = {}, params = {}, headers = {} } = {}) {
    const handler = routes.get(method + ' ' + url);
    if (!handler) throw new Error('Controlador no encontrado: ' + method + ' ' + url);
    const req = { body, params, headers: { cookie: 'bc_session=token-unitario', ...headers } };
    const res = {
      statusCode: 200,
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; },
      cookie: mock.fn(), clearCookie: mock.fn(),
    };
    let error;
    await handler(req, res, err => { error = err; });
    return { req, res, error };
  }
  return { invoke, db, calls, routes };
}

module.exports = { backend };
