'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => 'Q' + Number(n).toFixed(2);
  const date = s => new Date(s).toLocaleString('es-GT');
  const values = form => Object.fromEntries(new FormData(form));
  let user, inventory = [];
  const admin = document.body.dataset.page === 'admin';
  async function api(url, method = 'GET', body) {
    const options = { method };
    if (body instanceof FormData) options.body = body;
    else if (body !== undefined) { options.headers = { 'Content-Type': 'application/json' }; options.body = JSON.stringify(body); }
    const res = await fetch('/api' + url, options), data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la operación.'), { status: res.status });
    return data;
  }
  function message(text, success = false, id = 'message') { $(id).textContent = text; $(id).classList.toggle('success', success); }
  function submit(id, fn, errorId = 'message') {
    $(id)?.addEventListener('submit', async e => {
      e.preventDefault(); const btn = e.target.querySelector('button'); btn.disabled = true;
      try { await fn(e.target); } catch (err) { message(err.message, false, errorId); }
      finally { btn.disabled = false; }
    });
  }
  async function enter() {
    if ($('admin-link')) $('admin-link').hidden = user.role !== 'admin';
    $('auth').hidden = true; $('logout').hidden = false;
    if (admin && user.role !== 'admin') { message('Tu cuenta no tiene permisos de administración. Puedes comprar desde la tienda.'); return; }
    $(admin ? 'admin' : 'account').hidden = false;
    if (admin) await refresh();
    else {
      for (const key of ['nombre', 'telefono', 'direccion']) $('profile').elements[key].value = user[key];
      const orders = await api('/orders');
      $('orders').innerHTML = orders.map(o => `<tr><td>${esc(o.code)}</td><td>${esc(date(o.created_at))}</td><td>${money(o.total)}</td><td><span class="badge">${esc(o.status)}</span></td><td><button data-detail="${esc(o.code)}">Ver</button></td></tr>`).join('') || '<tr><td colspan="5">Todavía no tienes pedidos.</td></tr>';
      bindDetails();
    }
  }
  submit('login', async form => { user = await api('/auth/login', 'POST', values(form)); message(''); await enter(); });
  submit('register', async form => { user = await api('/auth/register', 'POST', values(form)); message('Cuenta creada.', true); await enter(); });
  submit('profile', async form => { user = await api('/me', 'PUT', values(form)); message('Datos guardados.', true); });
  $('logout').addEventListener('click', async () => { try { await api('/auth/logout', 'POST'); location.reload(); } catch (e) { message(e.message); } });
  function bindDetails() {
    document.querySelectorAll('[data-detail]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        const o = await api('/orders/' + encodeURIComponent(btn.dataset.detail));
        $('detail-content').innerHTML = `<h2>${esc(o.code)}</h2><p>${esc(o.status)} · ${money(o.total)} · ${esc(o.payment)}</p><p>${esc(o.cliente.nombre)}<br>${esc(o.cliente.telefono)}<br>${esc(o.cliente.email)}<br>${esc(o.cliente.direccion)}</p><ul>${o.detalle.map(i => `<li>${esc(i.nombre)} · ${i.quantity} × ${money(i.price_cents/100)}</li>`).join('')}</ul><p>${esc(o.comments)}</p>`;
        $('detail').showModal();
      } catch (e) { message(e.message); }
    }));
  }
  $('close-detail').addEventListener('click', () => $('detail').close());
  function renderInventory() {
    const query = $('search').value.toLowerCase(), filter = $('stock-filter').value;
    const products = inventory.filter(p => (p.nombre + ' ' + p.categoria).toLowerCase().includes(query) && (filter === 'all' || filter === 'low' && p.cantidad_disponible > 0 && p.cantidad_disponible <= 5 || filter === 'out' && p.cantidad_disponible === 0 || filter === 'inactive' && !p.estado_activo));
    $('inventory').innerHTML = products.map(p => `<tr><td>${esc(p.nombre)}<small>#${p.id_producto}</small></td><td>${esc(p.categoria)}</td><td>${money(p.precio)}</td><td><span class="badge ${p.cantidad_disponible === 0 ? 'out' : p.cantidad_disponible <= 5 ? 'low' : ''}">${p.cantidad_disponible}</span></td><td>${p.estado_activo ? 'Visible' : 'Inactivo'}</td><td><button data-edit="${p.id_producto}">Editar</button> <button class="secondary" data-stock="${p.id_producto}">Ajustar</button></td></tr>`).join('') || '<tr><td colspan="6">No hay productos para este filtro.</td></tr>';
    document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editor(inventory.find(p => p.id_producto === Number(b.dataset.edit)))));
    document.querySelectorAll('[data-stock]').forEach(b => b.addEventListener('click', () => {
      const p = inventory.find(p => p.id_producto === Number(b.dataset.stock));
      $('stock-form').reset(); $('stock-form').elements.id.value = p.id_producto;
      $('stock-product').textContent = `${p.nombre} · ${p.cantidad_disponible} unidades disponibles`;
      message('', false, 'stock-message'); $('stock-dialog').showModal();
    }));
  }
  async function refresh() {
    const [products, movements, orders] = await Promise.all([api('/admin/inventory'), api('/admin/movements'), api('/admin/orders')]);
    inventory = products; renderInventory();
    $('stats').innerHTML = [[products.length,'Productos'],[products.reduce((s,p)=>s+p.cantidad_disponible,0),'Unidades'],[products.filter(p=>p.cantidad_disponible===0).length,'Agotados'],[orders.filter(o=>['Recibido','Preparando'].includes(o.status)).length,'Pedidos pendientes']].map(([n,t])=>`<div class="panel"><span class="muted">${t}</span><strong>${n}</strong></div>`).join('');
    $('movements').innerHTML = movements.map(m => `<tr><td>${esc(date(m.created_at))}</td><td>${esc(m.nombre)}</td><td>${m.delta > 0 ? '+' : ''}${m.delta}</td><td>${esc(m.reason)}</td><td>${esc(m.administrador)}</td></tr>`).join('') || '<tr><td colspan="5">Sin movimientos.</td></tr>';
    const transitions = { Recibido: ['Preparando', 'Cancelado'], Preparando: ['Enviado', 'Cancelado'], Enviado: ['Entregado'], Entregado: [], Cancelado: [] };
    $('orders').innerHTML = orders.map(o => `<tr><td>${esc(o.code)}<small>${esc(o.cliente.nombre)} · ${esc(date(o.created_at))}</small></td><td>${money(o.total)}<small>${esc(o.payment)}</small></td><td><span class="badge">${esc(o.status)}</span></td><td><button data-detail="${esc(o.code)}">Detalle</button> ${(transitions[o.status] || []).map(s=>`<button class="secondary" data-order="${o.id}" data-status="${s}">${s === 'Cancelado' ? 'Cancelar' : s}</button>`).join(' ')}</td></tr>`).join('') || '<tr><td colspan="4">Sin pedidos.</td></tr>';
    bindDetails();
    document.querySelectorAll('[data-order]').forEach(btn => btn.addEventListener('click', async () => {
      if (btn.dataset.status === 'Cancelado' && !confirm('¿Cancelar el pedido y devolver sus unidades al inventario?')) return;
      btn.disabled = true;
      try { await api('/admin/orders/' + btn.dataset.order, 'PATCH', { estado_actual: btn.dataset.status }); await refresh(); message('Pedido actualizado.', true); }
      catch (e) { message(e.message); btn.disabled = false; }
    }));
  }
  function editor(p) {
    const form = $('product-form'); form.reset();
    form.elements.id.value = p?.id_producto || '';
    for (const key of ['nombre','descripcion','categoria','precio']) form.elements[key].value = p?.[key] ?? '';
    form.elements.estado_activo.value = String(p?.estado_activo ?? true);
    form.elements.imagenes.value = (p?.imagenes || []).join('\n');
    $('initial-stock').hidden = !!p; form.elements.cantidad_disponible.disabled = !!p;
    $('editor-title').textContent = p ? 'Editar producto' : 'Nuevo producto';
    message('', false, 'editor-message'); previewPhotos(); $('editor').showModal();
  }
  function previewPhotos() {
    const images = $('images').value.split('\n').map(s=>s.trim()).filter(s => /^https:\/\//.test(s) || /^\/uploads\//.test(s));
    $('photo-preview').innerHTML = images.map(url=>`<img src="${esc(url)}" alt="Fotografía del producto" loading="lazy">`).join('');
  }
  if (admin) {
    $('search').addEventListener('input', renderInventory); $('stock-filter').addEventListener('change', renderInventory);
    $('refresh').addEventListener('click', () => refresh().catch(e=>message(e.message)));
    $('new-product').addEventListener('click', () => editor());
    $('close-editor').addEventListener('click', () => $('editor').close());
    $('close-stock').addEventListener('click', () => $('stock-dialog').close());
    $('images').addEventListener('input', previewPhotos);
    submit('product-form', async form => {
      const b = values(form), files = [...$('photo').files];
      const images = b.imagenes.split('\n').map(s=>s.trim()).filter(Boolean);
      if (images.length + files.length > 10) throw new Error('Máximo diez fotografías.');
      // Uploaded URLs remain in the editor if saving fails, avoiding duplicate uploads on retry.
      for (const file of files) {
        const data = new FormData(); data.append('photo', file);
        const uploaded = await api('/admin/photos', 'POST', data);
        images.push(uploaded.url); form.elements.imagenes.value = images.join('\n');
      }
      $('photo').value = ''; previewPhotos();
      b.imagenes = images; b.precio = Number(b.precio); b.estado_activo = b.estado_activo === 'true';
      if (!b.id) b.cantidad_disponible = Number(b.cantidad_disponible);
      await api('/admin/products' + (b.id ? '/' + b.id : ''), b.id ? 'PUT' : 'POST', b);
      $('editor').close(); await refresh(); message('Producto guardado.', true);
    }, 'editor-message');
    submit('stock-form', async form => {
      const b = values(form); await api('/admin/products/' + b.id + '/stock', 'POST', { cantidad: Number(b.cantidad), motivo: b.motivo });
      $('stock-dialog').close(); await refresh(); message('Inventario actualizado.', true);
    }, 'stock-message');
  }
  api('/me').then(async u => { user = u; await enter(); }).catch(e => { if (e.status !== 401) message(e.message); });
})();
