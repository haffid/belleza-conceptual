'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { backend } = require('../helpers/backend.cjs');
const { frontend } = require('../helpers/frontend.cjs');
// Control de instrumentación: no se cuenta entre las unitarias aportadas.
// Es una medición inicial de esta intervención, no un reporte histórico de Fase 1.
test('BASELINE inicialización sin los nuevos casos de negocio', async () => {
  const back = await backend(); const front = await frontend();
  assert.ok(back.routes.size); assert.ok(front.unit);
});
