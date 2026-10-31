'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { frontend, plain } = require('../helpers/frontend.cjs');
const products = [
  { id_producto: 1, nombre: 'Crema facial', descripcion: 'Hidratante', categoria: 'Facial', precio: 10, cantidad_disponible: 5, imagenes: [] },
  { id_producto: 2, nombre: 'Shampoo', descripcion: 'Capilar', categoria: 'Cabello', precio: 15, cantidad_disponible: 3, imagenes: [] },
];
const element = (h, id) => h.document.getElementById(id);
const button = (h, selector, key, value) => element(h, 'productGrid').querySelectorAll(selector).find(b => b.dataset[key] === String(value));
async function add(h, id = 1, quantity = 1) { element(h, 'qty-' + id).value = String(quantity); await button(h, '[data-add]', 'add', id).fire(); }
async function remove(h, id) { await element(h, 'drawerBody').querySelectorAll('[data-rm]').find(b => b.dataset.rm === String(id)).fire(); }

test('UT-FE-01 agregar producto crea una línea y persiste el carrito', async () => {
  const h = await frontend({ products }); await add(h);
  assert.equal(h.unit.state.cart.length, 1); assert.equal(h.unit.state.cart[0].cantidad, 1); assert.equal(h.unit.cartTotal(), 10);
  assert.equal(JSON.parse(h.storage.get('bc_cart'))[0].id_producto, 1);
});
test('UT-FE-02 agregar el mismo producto consolida la cantidad', async () => {
  const h = await frontend({ products }); await add(h); await add(h);
  assert.equal(h.unit.state.cart.length, 1); assert.equal(h.unit.state.cart[0].cantidad, 2);
});
test('UT-FE-03 agregar dos unidades actualiza cantidad y subtotal', async () => {
  const h = await frontend({ products }); await add(h, 1, 2);
  assert.equal(h.unit.state.cart[0].cantidad, 2); assert.equal(h.unit.cartTotal(), 20);
  assert.match(element(h, 'drawerBody').innerHTML, /Q20\.00/);
});
test('UT-FE-04 quitar una línea conserva la otra y recalcula total', async () => {
  const h = await frontend({ products }); await add(h); await add(h, 2); await remove(h, 1);
  assert.deepEqual(plain(h.unit.state.cart.map(p => p.id_producto)), [2]); assert.equal(h.unit.cartTotal(), 15);
});
test('UT-FE-05 quitar la última línea vacía el carrito y su total', async () => {
  const h = await frontend({ products }); await add(h); await remove(h, 1);
  assert.equal(h.unit.state.cart.length, 0); assert.equal(h.unit.cartTotal(), 0);
  assert.match(element(h, 'drawerBody').innerHTML, /carrito está vacío/); assert.equal(element(h, 'drawerFoot').innerHTML, '');
});
test('UT-FE-06 total acumula precio por cantidad de todas las líneas', async () => {
  const h = await frontend({ products }); await add(h, 1, 2); await add(h, 2, 1);
  assert.equal(h.unit.cartTotal(), 35); assert.equal(element(h, 'cartCount').textContent, 3);
});
test('UT-FE-07 agregar de nuevo no excede el stock comunicado', async () => {
  const h = await frontend({ products }); await add(h, 1, 5); await add(h, 1, 1);
  assert.equal(h.unit.state.cart[0].cantidad, 5); assert.equal(h.unit.cartTotal(), 50);
});
test('UT-FE-08 producto agotado no ofrece una acción de agregar', async () => {
  const h = await frontend({ products: [{ ...products[0], cantidad_disponible: 0 }] });
  assert.equal(element(h, 'productGrid').querySelectorAll('[data-add]').length, 0);
  assert.match(element(h, 'productGrid').innerHTML, /disabled>Sin existencia/); assert.match(element(h, 'productGrid').innerHTML, /Agotado/);
});
test('UT-FE-09 dirección obligatoria faltante impide enviar el pedido', async () => {
  const h = await frontend({ products }); await add(h);
  h.unit.state.user = { nombre: 'Ana', telefono: '12345678', email: 'ana@example.test', direccion: '' }; h.unit.renderCheckoutStep();
  const before = h.fetch.mock.callCount(); await h.unit.submitOrder();
  assert.equal(h.fetch.mock.callCount(), before); assert.match(element(h, 'formMsg').textContent, /obligatorios/);
  assert.equal(element(h, 'formMsg').style.display, 'block'); assert.equal(h.unit.state.cart.length, 1);
});
test('UT-FE-10 fallo simulado del catálogo muestra el error', async () => {
  const h = await frontend({ fetch: async url => {
    if (url === '/api/me') return { ok: false, status: 401 };
    throw new Error('Sin red simulada');
  } });
  assert.match(element(h, 'productGrid').innerHTML, /No se pudo cargar el catálogo/);
  assert.equal(h.fetch.mock.callCount(), 2);
});
test('UT-FE-11 filtro de categoría conserva solo los productos elegidos', async () => {
  const h = await frontend({ products });
  await element(h, 'catFilters').querySelectorAll('.filter-pill').find(b => b.dataset.cat === 'Facial').fire();
  assert.equal(h.unit.state.category, 'Facial'); assert.match(element(h, 'productGrid').innerHTML, /Crema facial/);
  assert.doesNotMatch(element(h, 'productGrid').innerHTML, /Shampoo/);
});
test('UT-FE-12 categoría sin productos muestra estado vacío', async () => {
  const h = await frontend({ products }); h.unit.state.category = 'Sin productos'; h.unit.renderGrid();
  assert.match(element(h, 'productGrid').innerHTML, /No hay productos en esta categoría/);
});
test('UT-FE-13 error al confirmar conserva carrito y reactiva el botón', async () => {
  const h = await frontend({ fetch: async url => {
    if (url === '/api/me') return { ok: false, status: 401 };
    if (url === '/api/orders') return { ok: false, status: 409, json: async () => ({ error: 'Existencia insuficiente' }) };
    return { ok: true, json: async () => products };
  } });
  await add(h); h.unit.state.user = { nombre: 'Ana', telefono: '12345678', email: 'ana@example.test', direccion: 'Guatemala' }; h.unit.renderCheckoutStep();
  await h.unit.submitOrder();
  assert.equal(h.unit.state.cart.length, 1); assert.equal(element(h, 'submitOrder').disabled, false);
  assert.equal(element(h, 'formMsg').textContent, 'Existencia insuficiente');
});
test('UT-FE-14 confirmación exitosa vacía carrito y muestra código y total', async () => {
  const h = await frontend({ fetch: async url => {
    if (url === '/api/me') return { ok: false, status: 401 };
    if (url === '/api/orders') return { ok: true, json: async () => ({ codigo_pedido: 'BC-UNIT', estado_actual: 'Recibido', total: 10, mensaje: 'Pago pendiente', revision_requerida: false }) };
    return { ok: true, json: async () => products };
  } });
  await add(h); h.unit.state.user = { nombre: 'Ana', telefono: '12345678', email: 'ana@example.test', direccion: 'Guatemala' }; h.unit.renderCheckoutStep();
  await h.unit.submitOrder();
  assert.equal(h.unit.state.cart.length, 0); assert.equal(h.storage.get('bc_cart'), '[]');
  assert.match(element(h, 'drawerBody').innerHTML, /BC-UNIT/); assert.match(element(h, 'drawerBody').innerHTML, /Q10\.00/);
  const sent = JSON.parse(h.fetch.mock.calls.find(c => c.arguments[0] === '/api/orders').arguments[1].body);
  assert.deepEqual(sent.items, [{ id_producto: 1, cantidad: 1 }]);
});
