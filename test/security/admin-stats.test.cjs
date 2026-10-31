'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function statsHarness() {
  const nodes = new Map();
  const element = tag => ({ tag, children: [], textContent: '', addEventListener() {}, append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; }, set innerHTML(_) { throw new Error('Las estadísticas no deben interpretar HTML'); } });
  const document = { body: { dataset: { page: 'account' } }, createElement: element, getElementById(id) { if (!nodes.has(id)) nodes.set(id, element('div')); return nodes.get(id); } };
  const source = fs.readFileSync(path.resolve(__dirname, '../../store-ui.js'), 'utf8');
  const context = { document, FormData, fetch: async () => ({ ok: false, status: 401, json: async () => ({ error: 'Sin sesión' }) }) };
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.renderStatsForTest = renderStats; })();'), context, { filename: path.resolve(__dirname, '../../store-ui.js') });
  await new Promise(resolve => setImmediate(resolve));
  return { render: context.renderStatsForTest, container: nodes.get('stats'), nodes };
}
test('estadísticas muestran unidades y pedidos sin usar innerHTML', async () => {
  const h = await statsHarness();
  h.render([{ cantidad_disponible: 3 }, { cantidad_disponible: 0 }], [{ status: 'Recibido' }, { status: 'Entregado' }]);
  const cards = h.nodes.get('stats').children;
  assert.deepEqual(Array.from(cards, card => card.children[1].textContent), ['2', '3', '1', '1']);
  assert.deepEqual(Array.from(cards, card => card.children[0].textContent), ['Productos', 'Unidades', 'Agotados', 'Pedidos pendientes']);
});
test('un contador con etiquetas maliciosas se conserva como texto inerte', async () => {
  const h = await statsHarness();
  const payload = '<img src=x onerror=alert(1)>';
  h.render([{ cantidad_disponible: payload }], []);
  const count = h.nodes.get('stats').children[1].children[1];
  assert.equal(count.textContent, '0' + payload);
  assert.equal(count.tag, 'strong');
  assert.equal(count.children.length, 0);
});
test('refrescar sustituye las tarjetas previas y respeta el inventario vacío', async () => {
  const h = await statsHarness();
  h.render([{ cantidad_disponible: 4 }], []);
  h.render([], []);
  assert.equal(h.nodes.get('stats').children.length, 4);
  assert.deepEqual(Array.from(h.nodes.get('stats').children, card => card.children[1].textContent), ['0', '0', '0', '0']);
});
