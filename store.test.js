const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('./db');
const { createApp, hashPassword } = require('./server');

test('cuentas, permisos, inventario transaccional, fotos y cancelación', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-test-'));
  const db = await openDatabase({ filename: path.join(dir, 'test.sqlite'), url: process.env.TEST_DATABASE_URL });
  if (db.postgres) {
    for (const table of ['store_users','store_products','store_orders','store_order_items','store_movements','store_sessions']) {
      if ((await db.query(`SELECT 1 FROM ${table} LIMIT 1`)).rows.length) {
        await db.close(); fs.rmSync(dir,{recursive:true,force:true});
        throw new Error('TEST_DATABASE_URL debe apuntar a una base vacía y desechable.');
      }
    }
  }
  const { app } = await createApp({ db, test: true });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookies = {};
  const request = async (url, method='GET', body, actor='guest', extra={}) => {
    const headers = { ...extra };
    if (cookies[actor]) headers.Cookie = cookies[actor];
    if (body && !(body instanceof FormData)) headers['Content-Type']='application/json';
    const res = await fetch(base + url, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
    if (res.headers.get('set-cookie')) cookies[actor]=res.headers.get('set-cookie').split(';')[0];
    return { status:res.status, data:await res.json() };
  };
  const payload = items => ({ cliente:{nombre:'Cliente',telefono:'12345678',direccion:'Guatemala'},items,metodo_pago_preferido:'Contra entrega' });
  try {
    assert.equal((await request('/health')).status,200);
    assert.equal((await request('/api/admin/inventory')).status,401);
    assert.equal((await request('/api/orders','POST',payload([]))).status,401);
    assert.equal((await request('/api/auth/register','POST',{nombre:'Ana',email:'ana@example.com',password:'Contraseña123',role:'admin'},'ana')).data.role,'customer');
    assert.equal((await request('/api/auth/register','POST',{nombre:'Ana',email:'ANA@example.com',password:'Contraseña123'},'duplicate')).status,409);
    assert.equal((await request('/api/admin/inventory','GET',null,'ana')).status,403);
    await request('/api/auth/register','POST',{nombre:'Eva',email:'eva@example.com',password:'Contraseña123'},'eva');
    await db.query("INSERT INTO store_users(email,password,role,nombre) VALUES($1,$2,'admin',$3)",['admin@example.com',await hashPassword('Administrador123'),'Admin']);
    assert.equal((await request('/api/auth/login','POST',{email:'admin@example.com',password:'wrong'},'admin')).status,401);
    assert.equal((await request('/api/auth/login','POST',{email:'admin@example.com',password:'Administrador123'},'admin')).status,200);
    assert.equal((await request('/api/me','PUT',{nombre:'Ana',telefono:'87654321',direccion:'Mi dirección'},'ana')).data.telefono,'87654321');
    const newProduct = (name,stock) => request('/api/admin/products','POST',{nombre:name,categoria:'Facial',descripcion:'Descripción',precio:10.25,cantidad_disponible:stock},'admin');
    const first = await newProduct('Producto A',5), second = await newProduct('Producto B',1);
    assert.equal(first.status,201);
    const a=first.data.id_producto,b=second.data.id_producto;
    assert.equal((await request('/api/orders','POST',payload([{id_producto:a,cantidad:3},{id_producto:a,cantidad:3}]),'ana')).status,409);
    assert.equal((await request('/api/orders','POST',payload([{id_producto:a,cantidad:2},{id_producto:b,cantidad:2}]),'ana')).status,409);
    assert.equal((await db.query('SELECT stock FROM store_products WHERE id=$1',[a])).rows[0].stock,5);
    assert.equal((await db.query('SELECT * FROM store_orders')).rows.length,0);
    const concurrent=await Promise.all(['ana','eva'].map(actor=>request('/api/orders','POST',payload([{id_producto:a,cantidad:4}]),actor)));
    assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
    assert.equal((await db.query('SELECT stock FROM store_products WHERE id=$1',[a])).rows[0].stock,1);
    const winner=concurrent[0].status===201?'ana':'eva',other=winner==='ana'?'eva':'ana',code=concurrent.find(r=>r.status===201).data.codigo_pedido;
    assert.equal((await request('/api/orders/'+code,'GET',null,other)).status,404);
    assert.equal((await request('/api/orders/'+code,'GET',null,winner)).data.detalle.length,1);
    const order=(await request('/api/admin/orders','GET',null,'admin')).data[0];
    assert.equal((await request('/api/admin/orders/'+order.id,'PATCH',{estado_actual:'Cancelado'},'admin')).status,200);
    assert.equal((await request('/api/admin/orders/'+order.id,'PATCH',{estado_actual:'Cancelado'},'admin')).status,409);
    assert.equal((await db.query('SELECT stock FROM store_products WHERE id=$1',[a])).rows[0].stock,5);
    assert.equal((await request('/api/admin/products/'+a+'/stock','POST',{cantidad:-6,motivo:'Corrección'},'admin')).status,409);
    assert.equal((await request('/api/admin/products/'+a+'/stock','POST',{cantidad:3,motivo:'Reposición'},'admin')).status,200);
    assert.equal((await request('/api/admin/products/'+a,'PUT',{nombre:'A',categoria:'Facial',precio:12.5,estado_activo:false},'admin')).status,200);
    assert.equal((await request('/api/orders','POST',payload([{id_producto:a,cantidad:1}]),'ana')).status,409);
    assert.equal((await request('/api/admin/products','POST',{nombre:'X',categoria:'Facial',precio:-1},'admin')).status,400);
    assert.equal((await request('/api/me','PUT',{nombre:'Ana'},'ana',{Origin:'https://evil.example'})).status,403);
    const badPhoto=new FormData();badPhoto.append('photo',new Blob(['<script>alert(1)</script>'],{type:'image/png'}),'fake.png');
    assert.equal((await request('/api/admin/photos','POST',badPhoto,'admin')).status,400);
    const photo=new FormData();photo.append('photo',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'pixel.png');
    const uploaded=await request('/api/admin/photos','POST',photo,'admin');assert.equal(uploaded.status,201);
    const photoResponse=await fetch(base+uploaded.data.url);assert.equal(photoResponse.status,200);
    fs.unlinkSync(path.join(process.env.UPLOAD_DIR || path.join(__dirname,'uploads'),path.basename(uploaded.data.url)));
    assert.equal((await request('/api/auth/logout','POST',null,'ana')).status,200);
    assert.equal((await request('/api/me','GET',null,'ana')).status,401);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    if (db.postgres) await db.transaction(async tx => {
      for (const table of ['store_movements','store_order_items','store_orders','store_sessions','store_products','store_users']) await tx.query(`DELETE FROM ${table}`);
    });
    await db.close();fs.rmSync(dir,{recursive:true,force:true});
  }
});
