'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { storeUI } = require('../helpers/store-ui.cjs');
const customer = { role: 'customer', nombre: 'Ana', telefono: '1234', direccion: 'Guatemala' };
const product = { id_producto: 4, nombre: '<Crema>', descripcion: 'Suave', categoria: 'Facial', precio: 12.50, cantidad_disponible: 3, estado_activo: true, imagenes: ['/uploads/a.png'] };
const order = { id: 8, code: 'P-8', created_at: '2026-10-30T12:00:00Z', status: 'Recibido', total: 25, payment: 'Efectivo', cliente: { ...customer, email: 'a@example.test' }, detalle: [{ nombre: '<Crema>', quantity: 2, price_cents: 1250 }], comments: '<script>alert(1)</script>' };
function adminRoute(url) {
  if (url === '/api/admin/inventory') return [product];
  if (url === '/api/admin/orders') return [order];
  if (url === '/api/admin/movements') return [{ created_at: order.created_at, nombre: '<Crema>', delta: -2, reason: '<venta>', administrador: 'Ana' }];
  return {};
}
test('transporte UI conserva multipart y codifica JSON con errores HTTP identificables', async () => {
  const h = await storeUI({ route: url => url.endsWith('fail') ? { status: 503 } : {} });
  await h.api('/save', 'PUT', { nombre: 'Ana' });
  assert.equal(h.calls.at(-1).headers['Content-Type'], 'application/json');
  assert.equal(JSON.parse(h.calls.at(-1).body).nombre, 'Ana');
  const data = new h.FormDataDouble(); data.append('photo', 'synthetic');
  await h.api('/photo', 'POST', data);
  assert.equal(h.calls.at(-1).body, data);
  assert.equal(h.calls.at(-1).headers, undefined);
  await assert.rejects(h.api('/fail'), e => e.status === 503 && /No se pudo/.test(e.message));
});
test('login muestra el perfil y oculta administración a un cliente', async () => {
  const h = await storeUI({ route: url => url.endsWith('/login') ? customer : [order] });
  const login = h.fields('login', { email: 'ana@example.test', password: 'synthetic' });
  await login.fire('submit');
  assert.equal(h.get('admin-link').hidden, true);
  assert.equal(h.get('auth').hidden, true);
  assert.equal(h.get('account').hidden, false);
  assert.equal(h.get('profile').elements.nombre.value, 'Ana');
  assert.match(h.get('orders').innerHTML, /P-8/);
  assert.equal(login.querySelector().disabled, false);
});
test('login fallido muestra el error y permite reintentar', async () => {
  const h = await storeUI({ route: () => ({ status: 401, error: 'Credenciales inválidas' }) });
  await h.get('login').fire('submit');
  assert.equal(h.get('message').textContent, 'Credenciales inválidas');
  assert.equal(h.get('login').querySelector().disabled, false);
  assert.equal(h.calls.some(call => call.url === '/api/orders'), false);
});
test('registro y edición del perfil envían los datos al endpoint correspondiente', async () => {
  const h = await storeUI({ route: url => url === '/api/orders' ? [] : customer });
  await h.fields('register', { nombre: 'Ana', email: 'a@example.test' }).fire('submit');
  assert.equal(h.get('message').textContent, 'Cuenta creada.');
  await h.fields('profile', { nombre: 'Ana', telefono: '9999', direccion: 'Ciudad' }).fire('submit');
  assert.equal(h.calls.at(-1).method, 'PUT');
  assert.equal(JSON.parse(h.calls.at(-1).body).telefono, '9999');
  assert.equal(h.get('message').textContent, 'Datos guardados.');
});
test('la vista administrativa rechaza clientes sin consultar inventario', async () => {
  const h = await storeUI({ admin: true }); h.setUser(customer);
  await h.enter();
  assert.match(h.get('message').textContent, /no tiene permisos/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.get('admin').hidden, true);
});
test('inventario aplica filtros y búsqueda sin interpretar nombres como HTML', async () => {
  const h = await storeUI({ admin: true });
  h.setInventory([product, { ...product, id_producto: 5, nombre: 'Agotado', cantidad_disponible: 0 }, { ...product, id_producto: 6, nombre: 'Oculto', estado_activo: false, cantidad_disponible: 9 }]);
  h.renderInventory(); assert.match(h.get('inventory').innerHTML, /&lt;Crema&gt;/);
  h.get('stock-filter').value = 'low'; await h.get('stock-filter').fire('change');
  assert.match(h.get('inventory').innerHTML, /&lt;Crema&gt;/); assert.doesNotMatch(h.get('inventory').innerHTML, /Agotado|Oculto/);
  h.get('stock-filter').value = 'out'; h.renderInventory(); assert.match(h.get('inventory').innerHTML, /Agotado/);
  h.get('stock-filter').value = 'inactive'; h.renderInventory(); assert.match(h.get('inventory').innerHTML, /Oculto/);
  h.get('search').value = 'inexistente'; await h.get('search').fire('input');
  assert.match(h.get('inventory').innerHTML, /No hay productos/);
});
test('editar conserva los datos y bloquea cambios directos a existencias', async () => {
  const h = await storeUI({ admin: true }); h.setInventory([product]); h.renderInventory();
  await h.buttons('edit')[0].fire('click');
  assert.equal(h.get('product-form').elements.id.value, 4);
  assert.equal(h.get('product-form').elements.cantidad_disponible.disabled, true);
  assert.equal(h.get('initial-stock').hidden, true);
  assert.equal(h.get('editor').open, true);
  await h.get('close-editor').fire('click'); assert.equal(h.get('editor').open, false);
  await h.get('new-product').fire('click');
  assert.equal(h.get('product-form').elements.id.value, '');
  assert.equal(h.get('product-form').elements.cantidad_disponible.disabled, false);
  assert.equal(h.get('editor-title').textContent, 'Nuevo producto');
});
test('vista previa acepta HTTPS y uploads, escapa atributos y descarta javascript', async () => {
  const h = await storeUI({ admin: true });
  h.get('images').value = ' javascript:alert(1)\nhttp://inseguro/a\nhttps://example.test/a"b\n/uploads/c.png\n';
  await h.get('images').fire('input');
  const html = h.get('photo-preview').innerHTML;
  assert.doesNotMatch(html, /javascript:|http:\/\//);
  assert.match(html, /a&quot;b/); assert.match(html, /\/uploads\/c.png/);
});
test('nuevo producto convierte precio, existencias y visibilidad antes de guardar', async () => {
  const h = await storeUI({ admin: true, route: adminRoute }); h.editor();
  await h.fields('product-form', { id: '', nombre: 'Crema', precio: '12.50', cantidad_disponible: '7', estado_activo: 'false', imagenes: '' }).fire('submit');
  const call = h.calls.find(c => c.url === '/api/admin/products'); const body = JSON.parse(call.body);
  assert.equal(call.method, 'POST'); assert.equal(body.precio, 12.5); assert.equal(body.cantidad_disponible, 7); assert.equal(body.estado_activo, false);
  assert.deepEqual(body.imagenes, []); assert.equal(h.get('editor').open, false);
  assert.equal(h.get('message').textContent, 'Producto guardado.');
});
test('producto existente usa PUT y no incluye un ajuste inicial de stock', async () => {
  const h = await storeUI({ admin: true, route: adminRoute }); h.editor(product);
  await h.get('product-form').fire('submit');
  const call = h.calls.find(c => c.url === '/api/admin/products/4'); const body = JSON.parse(call.body);
  assert.equal(call.method, 'PUT'); assert.equal(body.cantidad_disponible, undefined);
  assert.deepEqual(body.imagenes, ['/uploads/a.png']);
});
test('límite de fotografías detiene el guardado antes de subir archivos', async () => {
  const h = await storeUI({ admin: true }); h.editor();
  h.get('images').value = Array(10).fill('/uploads/a.png').join('\n'); h.get('photo').files = ['one'];
  await h.get('product-form').fire('submit');
  assert.match(h.get('editor-message').textContent, /Máximo diez/);
  assert.equal(h.calls.length, 1); assert.equal(h.get('product-form').querySelector().disabled, false);
});
test('una subida se conserva en el editor si falla guardar el producto', async () => {
  const h = await storeUI({ admin: true, route: url => url === '/api/admin/photos' ? { url: '/uploads/new.png' } : { status: 500, error: 'Guardado fallido' } });
  h.editor(); h.get('photo').files = ['synthetic-photo'];
  await h.get('product-form').fire('submit');
  assert.equal(h.get('images').value, '/uploads/new.png');
  assert.equal(h.get('photo').value, '');
  assert.equal(h.get('editor-message').textContent, 'Guardado fallido');
  assert.equal(h.get('editor').open, true);
  assert.ok(h.calls.find(c => c.url === '/api/admin/photos').body instanceof h.FormDataDouble);
});
test('ajuste de stock identifica el producto y envía cantidad numérica y motivo', async () => {
  const h = await storeUI({ admin: true, route: adminRoute }); h.setInventory([product]); h.renderInventory();
  await h.buttons('stock')[0].fire('click');
  assert.match(h.get('stock-product').textContent, /3 unidades/);
  await h.fields('stock-form', { cantidad: '-2', motivo: 'Corrección' }).fire('submit');
  const body = JSON.parse(h.calls.find(c => c.url === '/api/admin/products/4/stock').body);
  assert.deepEqual(body, { cantidad: -2, motivo: 'Corrección' });
  assert.equal(h.get('stock-dialog').open, false);
  await h.get('close-stock').fire('click'); assert.equal(h.get('stock-dialog').open, false);
});
test('detalle de pedido codifica su identificador y escapa información del cliente', async () => {
  const h = await storeUI({ route: url => url === '/api/orders' ? [{ ...order, code: 'P/8' }] : order });
  h.setUser(customer); await h.enter(); await h.buttons('detail')[0].fire('click');
  assert.equal(h.calls.at(-1).url, '/api/orders/P%2F8');
  assert.match(h.get('detail-content').innerHTML, /&lt;script&gt;/);
  assert.match(h.get('detail-content').innerHTML, /&lt;Crema&gt;/);
  assert.doesNotMatch(h.get('detail-content').innerHTML, /<script>/);
  assert.equal(h.get('detail').open, true);
  await h.get('close-detail').fire('click'); assert.equal(h.get('detail').open, false);
});
test('cancelación requiere confirmación y restaura el botón si el servidor la rechaza', async () => {
  const h = await storeUI({ admin: true, route: (url, options) => options.method === 'PATCH' ? { status: 409, error: 'Estado cambiado' } : adminRoute(url) });
  h.setUser({ role: 'admin' }); await h.enter();
  assert.equal(h.get('admin-link').hidden, false);
  assert.match(h.get('movements').innerHTML, /&lt;venta&gt;/);
  const cancel = h.buttons('order').find(b => b.dataset.status === 'Cancelado');
  h.state.confirm = false; await cancel.fire('click'); assert.equal(h.calls.filter(c => c.method === 'PATCH').length, 0);
  h.state.confirm = true; await cancel.fire('click');
  assert.equal(JSON.parse(h.calls.at(-1).body).estado_actual, 'Cancelado');
  assert.equal(cancel.disabled, false); assert.equal(h.get('message').textContent, 'Estado cambiado');
});
test('avance de pedido refresca inventario y confirma el éxito', async () => {
  const h = await storeUI({ admin: true, route: adminRoute }); await h.refresh();
  await h.buttons('order').find(b => b.dataset.status === 'Preparando').fire('click');
  assert.equal(h.get('message').textContent, 'Pedido actualizado.');
  assert.equal(h.calls.filter(c => c.url === '/api/admin/inventory').length, 2);
});
test('logout recarga solo tras cerrar sesión y muestra fallos de red', async () => {
  let fail = true;
  const h = await storeUI({ route: () => fail ? { status: 503, error: 'Sin conexión' } : {} });
  await h.get('logout').fire('click'); assert.equal(h.state.reloads, 0); assert.equal(h.get('message').textContent, 'Sin conexión');
  fail = false; await h.get('logout').fire('click'); assert.equal(h.state.reloads, 1);
});
test('refresco manual informa errores sin simular una actualización exitosa', async () => {
  const h = await storeUI({ admin: true, route: () => ({ status: 503, error: 'Servicio no disponible' }) });
  await h.get('refresh').fire('click'); assert.equal(h.get('message').textContent, 'Servicio no disponible');
});
