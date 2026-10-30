'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { backend } = require('../helpers/backend.cjs');
const { database } = require('../helpers/database.cjs');

const admin = { id: 8, email: 'admin@example.test', role: 'admin', nombre: 'Admin' };
const row = (id = 1, cents = 1000, stock = 5) => ({ id, nombre: 'Producto ' + id, descripcion: 'Detalle', categoria: 'Facial', price_cents: cents, stock, active: 1, images: '["https://example.test/p.png"]' });
const payload = items => ({ cliente: { nombre: 'Ana', telefono: '12345678', direccion: 'Guatemala' }, items, metodo_pago_preferido: 'Contra entrega' });
function orderQuery(products) {
  return async (sql, params) => {
    if (sql.startsWith('UPDATE store_products SET stock=stock-')) {
      const item = products.find(p => p.id === params[1]);
      return { rows: item && item.active && item.stock >= params[0] ? [{ ...item, stock: item.stock - params[0] }] : [] };
    }
    if (sql.startsWith('INSERT INTO store_orders(')) return { rows: [{ id: 20 }] };
    return { rows: [] };
  };
}
const writes = h => h.calls.filter(c => c.sql.startsWith('INSERT INTO store_orders('));

test('UT-BE-01 subtotal usa precio del servidor por cantidad', async () => {
  const h = await backend({ query: orderQuery([row()]) });
  const result = await h.invoke('POST', '/api/orders', { body: payload([{ id_producto: 1, cantidad: 2 }]) });
  assert.equal(result.error, undefined); assert.equal(result.res.statusCode, 201); assert.equal(result.res.body.total, 20);
});
test('UT-BE-02 total suma líneas de productos distintos', async () => {
  const h = await backend({ query: orderQuery([row(), row(2, 1500)]) });
  const result = await h.invoke('POST', '/api/orders', { body: payload([{ id_producto: 1, cantidad: 2 }, { id_producto: 2, cantidad: 1 }]) });
  assert.equal(result.error, undefined); assert.equal(result.res.body.total, 35);
  assert.equal(h.calls.filter(c => c.sql.startsWith('INSERT INTO store_order_items(')).length, 2);
});
for (const [id, quantity, description] of [[3, 0, 'cero'], [4, -1, 'negativa'], [5, 'abc', 'no numérica']]) {
  test(`UT-BE-${String(id).padStart(2, '0')} cantidad ${description} se rechaza antes de persistir`, async () => {
    const h = await backend();
    const result = await h.invoke('POST', '/api/orders', { body: payload([{ id_producto: 1, cantidad: quantity }]) });
    assert.equal(result.error.status, 400); assert.equal(h.db.transaction.mock.callCount(), 0); assert.equal(writes(h).length, 0);
  });
}
test('UT-BE-06 pedido vacío se rechaza', async () => {
  const h = await backend(); const result = await h.invoke('POST', '/api/orders', { body: payload([]) });
  assert.equal(result.error.status, 400); assert.equal(h.db.transaction.mock.callCount(), 0);
});
test('UT-BE-07 stock insuficiente simulado impide guardar el pedido', async () => {
  const h = await backend({ query: orderQuery([row(1, 1000, 2)]) });
  const result = await h.invoke('POST', '/api/orders', { body: payload([{ id_producto: 1, cantidad: 3 }]) });
  assert.equal(result.error.status, 409); assert.equal(writes(h).length, 0); assert.equal(result.res.body, undefined);
});
test('UT-BE-08 cantidad igual al stock es aceptada', async () => {
  const h = await backend({ query: orderQuery([row(1, 1000, 2)]) });
  const result = await h.invoke('POST', '/api/orders', { body: payload([{ id_producto: 1, cantidad: 2 }]) });
  assert.equal(result.error, undefined); assert.equal(result.res.statusCode, 201); assert.equal(result.res.body.total, 20);
});
test('UT-BE-09 producto agotado no genera un pedido', async () => {
  const h = await backend({ query: orderQuery([row(1, 1000, 0)]) });
  const result = await h.invoke('POST', '/api/orders', { body: payload([{ id_producto: 1, cantidad: 1 }]) });
  assert.equal(result.error.status, 409); assert.equal(writes(h).length, 0);
});
test('UT-BE-10 líneas repetidas se consolidan antes de reservar', async () => {
  const h = await backend({ query: orderQuery([row()]) });
  const result = await h.invoke('POST', '/api/orders', { body: payload([{ id_producto: 1, cantidad: 1 }, { id_producto: 1, cantidad: 2 }]) });
  assert.equal(result.error, undefined); assert.equal(result.res.body.total, 30);
  const reserves = h.calls.filter(c => c.sql.startsWith('UPDATE store_products SET stock=stock-'));
  assert.equal(reserves.length, 1); assert.deepEqual(reserves[0].params, [3, 1, 3]);
  assert.equal(h.calls.filter(c => c.sql.startsWith('INSERT INTO store_order_items(')).length, 1);
});
test('UT-BE-11 un precio enviado por el cliente no altera el importe', async () => {
  const h = await backend({ query: orderQuery([row(1, 9550)]) });
  const result = await h.invoke('POST', '/api/orders', { body: payload([{ id_producto: 1, cantidad: 2, precio: 0.01 }]) });
  assert.equal(result.error, undefined); assert.equal(result.res.body.total, 191); assert.equal(writes(h)[0].params[3], 19100);
});
test('UT-BE-12 producto inexistente no permite persistir el pedido', async () => {
  const h = await backend({ query: orderQuery([]) });
  const result = await h.invoke('POST', '/api/orders', { body: payload([{ id_producto: 999, cantidad: 1 }]) });
  assert.equal(result.error.status, 409); assert.equal(writes(h).length, 0);
});
test('UT-BE-13 producto inactivo no se confirma', async () => {
  const h = await backend({ query: orderQuery([{ ...row(), active: 0 }]) });
  const result = await h.invoke('POST', '/api/orders', { body: payload([{ id_producto: 1, cantidad: 1 }]) });
  assert.equal(result.error.status, 409); assert.equal(writes(h).length, 0);
});
test('UT-BE-14 fallo del repositorio se propaga sin confirmar ni guardar', async () => {
  const failure = new Error('Dependencia simulada no disponible');
  const h = await backend({ query: async () => { throw failure; } });
  const result = await h.invoke('POST', '/api/orders', { body: payload([{ id_producto: 1, cantidad: 1 }]) });
  assert.equal(result.error, failure); assert.equal(result.res.body, undefined); assert.equal(writes(h).length, 0);
});
test('UT-BE-15 catálogo transforma centavos e imágenes del repositorio', async () => {
  const h = await backend({ query: async () => ({ rows: [row(1, 9550, 3)] }) });
  const result = await h.invoke('GET', '/api/products');
  assert.equal(result.error, undefined); assert.equal(result.res.body[0].precio, 95.5);
  assert.equal(result.res.body[0].cantidad_disponible, 3); assert.equal(result.res.body[0].estado_activo, true);
  assert.deepEqual(result.res.body[0].imagenes, ['https://example.test/p.png']);
});
test('UT-BE-16 catálogo vacío devuelve una colección válida', async () => {
  const h = await backend(); const result = await h.invoke('GET', '/api/products');
  assert.equal(result.error, undefined); assert.deepEqual(result.res.body, []);
});
test('UT-BE-17 precio negativo se rechaza sin insertar un producto', async () => {
  const h = await backend({ user: admin });
  const result = await h.invoke('POST', '/api/admin/products', { body: { nombre: 'A', categoria: 'Facial', precio: -1 } });
  assert.equal(result.error.status, 400); assert.equal(h.db.transaction.mock.callCount(), 0);
});
test('UT-BE-18 precio con tres decimales se rechaza', async () => {
  const h = await backend({ user: admin });
  const result = await h.invoke('POST', '/api/admin/products', { body: { nombre: 'A', categoria: 'Facial', precio: 1.005 } });
  assert.equal(result.error.status, 400); assert.equal(h.db.transaction.mock.callCount(), 0);
});
test('UT-BE-19 producto válido conserva importe y registra inventario inicial', async () => {
  const h = await backend({ user: admin, query: async sql => ({ rows: sql.startsWith('INSERT INTO store_products(') ? [row(1, 1025, 4)] : [] }) });
  const result = await h.invoke('POST', '/api/admin/products', { body: { nombre: '  Crema  ', categoria: 'Facial', precio: 10.25, cantidad_disponible: 4 } });
  assert.equal(result.error, undefined); assert.equal(result.res.statusCode, 201);
  const insert = h.calls.find(c => c.sql.startsWith('INSERT INTO store_products('));
  assert.equal(insert.params[0], 'Crema'); assert.equal(insert.params[3], 1025); assert.equal(insert.params[6], 4);
  const movement = h.calls.find(c => c.sql.startsWith('INSERT INTO store_movements('));
  assert.equal(movement.params[2], 4);
});
test('UT-BE-20 una segunda cancelación no devuelve inventario otra vez', async () => {
  const order = { id: 20, code: 'BC-UNIT', status: 'Recibido', customer: '{}', total_cents: 2000 };
  const h = await backend({ user: admin, query: async (sql, params) => {
    if (sql.startsWith('SELECT * FROM store_orders WHERE id=')) return { rows: [order] };
    if (sql.startsWith('SELECT * FROM store_order_items')) return { rows: [{ product_id: 1, quantity: 2 }] };
    if (sql.startsWith('UPDATE store_orders SET status=')) { order.status = params[0]; return { rows: [order] }; }
    return { rows: [] };
  } });
  const options = { params: { id: '20' }, body: { estado_actual: 'Cancelado' } };
  const first = await h.invoke('PATCH', '/api/admin/orders/:id', options);
  const second = await h.invoke('PATCH', '/api/admin/orders/:id', options);
  assert.equal(first.error, undefined); assert.equal(first.res.body.estado_actual, 'Cancelado'); assert.equal(second.error.status, 409);
  const restores = h.calls.filter(c => c.sql.startsWith('UPDATE store_products SET stock=stock+'));
  assert.equal(restores.length, 1); assert.deepEqual(restores[0].params, [2, 1]);
});
test('UT-BE-21 adaptador reenvía consulta parametrizada al pool simulado', async () => {
  const expected = { rows: [{ id: 1 }] };
  const h = await database({ query: async () => expected });
  const result = await h.db.query('SELECT id FROM productos WHERE id=$1', [1]);
  assert.equal(result, expected); assert.deepEqual(h.pool.query.mock.calls[0].arguments, ['SELECT id FROM productos WHERE id=$1', [1]]);
});
test('UT-BE-22 transacción confirma y libera el cliente', async () => {
  const h = await database();
  const result = await h.db.transaction(async tx => { await tx.query('CONSULTA UNITARIA', [7]); return 42; });
  assert.equal(result, 42); assert.deepEqual(h.client.query.mock.calls.map(c => c.arguments[0]), ['BEGIN', 'CONSULTA UNITARIA', 'COMMIT']);
  assert.equal(h.client.release.mock.callCount(), 1);
});
test('UT-BE-23 fallo del trabajo revierte y libera el cliente', async () => {
  const failure = new Error('Fallo del servicio aislado'); const h = await database();
  await assert.rejects(h.db.transaction(async () => { throw failure; }), error => error === failure);
  assert.deepEqual(h.client.query.mock.calls.map(c => c.arguments[0]), ['BEGIN', 'ROLLBACK']); assert.equal(h.client.release.mock.callCount(), 1);
});
test('UT-BE-24 fallo al confirmar intenta rollback y libera el cliente', async () => {
  const failure = new Error('COMMIT fallido');
  const h = await database({ transactionQuery: async sql => { if (sql === 'COMMIT') throw failure; return { rows: [] }; } });
  await assert.rejects(h.db.transaction(async () => 1), error => error === failure);
  assert.deepEqual(h.client.query.mock.calls.map(c => c.arguments[0]), ['BEGIN', 'COMMIT', 'ROLLBACK']); assert.equal(h.client.release.mock.callCount(), 1);
});
test('UT-BE-25 cierre del adaptador cierra el pool una vez', async () => {
  const h = await database(); await h.db.close(); assert.equal(h.pool.end.mock.callCount(), 1);
});
