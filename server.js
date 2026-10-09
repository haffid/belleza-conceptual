require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const multer = require('multer');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const { openDatabase } = require('./db');
const scrypt = promisify(crypto.scrypt);
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const email = value => text(value).toLowerCase();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + (await scrypt(password, salt, 64)).toString('hex');
}
async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.timingSafeEqual(await scrypt(password, salt, 64), Buffer.from(hash, 'hex'));
}
const publicUser = u => ({ id: u.id, email: u.email, role: u.role, nombre: u.nombre, telefono: u.telefono, direccion: u.direccion });
const product = p => ({ id_producto: p.id, nombre: p.nombre, descripcion: p.descripcion, categoria: p.categoria, precio: p.price_cents / 100, cantidad_disponible: p.stock, estado_activo: !!p.active, imagenes: JSON.parse(p.images) });
async function createApp(options = {}) {
  const db = options.db || await openDatabase();
  const app = express();
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { scriptSrc: ["'self'", "'unsafe-inline'"], scriptSrcAttr: ["'none'"], imgSrc: ["'self'", 'data:', 'https:'], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'], upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null } } }));
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => { req.body ||= {}; next(); });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.get('host')) throw new Error(); }
      catch { return res.status(403).json({ error: 'Origen no permitido.' }); }
    }
    next();
  });
  const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  app.param('id', (req, res, next, value) => {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return res.status(400).json({ error: 'Identificador inválido.' });
    next();
  });
  async function authenticate(req) {
    const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('bc_session='));
    const token = cookie && cookie.slice(11);
    if (!token) throw fail(401, 'Inicia sesión para continuar.');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await db.query('SELECT u.* FROM store_sessions s JOIN store_users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires>$2', [hashed, Date.now()]);
    if (!rows.length) throw fail(401, 'Tu sesión venció. Inicia sesión de nuevo.');
    req.user = rows[0]; req.sessionHash = hashed;
  }
  const protectedRoute = (fn, admin = false) => route(async (req, res) => {
    await authenticate(req);
    if (admin && req.user.role !== 'admin') throw fail(403, 'Acceso exclusivo para administradores.');
    return fn(req, res);
  });
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' };
  async function session(res, user) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.query('DELETE FROM store_sessions WHERE expires<$1', [Date.now()]);
    await db.query('INSERT INTO store_sessions(token,user_id,expires) VALUES($1,$2,$3)', [crypto.createHash('sha256').update(token).digest('hex'), user.id, Date.now() + 7 * 86400000]);
    res.cookie('bc_session', token, { ...cookieOptions, maxAge: 7 * 86400000 });
  }
  const limiter = rateLimit({ windowMs: 15 * 60000, limit: options.test ? 1000 : 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados intentos. Intenta más tarde.' } });
  app.post('/api/auth/register', limiter, route(async (req, res) => {
    const b = req.body || {};
    if (!validEmail(email(b.email)) || !text(b.nombre) || typeof b.password !== 'string' || b.password.length < 10 || b.password.length > 128) throw fail(400, 'Nombre, correo válido y contraseña de 10 a 128 caracteres son obligatorios.');
    const hashed = await hashPassword(b.password);
    let user;
    try { user = (await db.query("INSERT INTO store_users(email,password,role,nombre,telefono,direccion) VALUES($1,$2,'customer',$3,$4,$5) RETURNING *", [email(b.email), hashed, text(b.nombre), text(b.telefono, 30), text(b.direccion, 1000)])).rows[0]; }
    catch (e) { if (e.code === '23505' || e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw fail(409, 'Este correo ya está registrado.'); throw e; }
    await session(res, user); res.status(201).json(publicUser(user));
  }));
  app.post('/api/auth/login', limiter, route(async (req, res) => {
    const password = req.body?.password;
    if (typeof password !== 'string' || password.length > 128) throw fail(400, 'Datos inválidos.');
    const { rows } = await db.query('SELECT * FROM store_users WHERE email=$1', [email(req.body.email)]);
    if (!rows.length || !await verifyPassword(password, rows[0].password)) throw fail(401, 'Correo o contraseña incorrectos.');
    await session(res, rows[0]); res.json(publicUser(rows[0]));
  }));
  app.post('/api/auth/logout', protectedRoute(async (req, res) => {
    await db.query('DELETE FROM store_sessions WHERE token=$1', [req.sessionHash]);
    res.clearCookie('bc_session', cookieOptions); res.json({ ok: true });
  }));
  app.get('/api/me', protectedRoute(async (req, res) => res.json(publicUser(req.user))));
  app.put('/api/me', protectedRoute(async (req, res) => {
    if (!text(req.body.nombre)) throw fail(400, 'Nombre obligatorio.');
    const { rows } = await db.query('UPDATE store_users SET nombre=$1,telefono=$2,direccion=$3 WHERE id=$4 RETURNING *', [text(req.body.nombre), text(req.body.telefono, 30), text(req.body.direccion, 1000), req.user.id]);
    res.json(publicUser(rows[0]));
  }));
  app.get('/api/products', route(async (req, res) => res.json((await db.query('SELECT * FROM store_products WHERE active=1 ORDER BY categoria,nombre')).rows.map(product))));
  app.get('/api/admin/inventory', protectedRoute(async (req, res) => res.json((await db.query('SELECT * FROM store_products ORDER BY nombre')).rows.map(product)), true));
  app.get('/api/admin/movements', protectedRoute(async (req, res) => res.json((await db.query('SELECT m.*,p.nombre,u.nombre AS administrador FROM store_movements m JOIN store_products p ON p.id=m.product_id JOIN store_users u ON u.id=m.user_id ORDER BY m.id DESC LIMIT 200')).rows), true));
  function validateProduct(b) {
    const price = Number(b.precio), images = b.imagenes || [];
    if (!text(b.nombre) || !text(b.categoria) || b.precio === '' || b.precio == null || !Number.isFinite(price) || price < 0 || price > 1000000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001) throw fail(400, 'Nombre, categoría y precio válido con máximo dos decimales son obligatorios.');
    if (!Array.isArray(images) || images.length > 10 || images.some(url => typeof url !== 'string' || url.length > 2000 || !(/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(url) || /^https:\/\/[^\s"<>]+$/.test(url)))) throw fail(400, 'Usa hasta diez fotografías HTTPS o archivos cargados.');
    return [text(b.nombre), text(b.descripcion, 5000), text(b.categoria), Math.round(price * 100), b.estado_activo === false ? 0 : 1, JSON.stringify(images)];
  }
  app.post('/api/admin/products', protectedRoute(async (req, res) => {
    const values = validateProduct(req.body), stock = req.body.cantidad_disponible ?? 0;
    if (!Number.isSafeInteger(stock) || stock < 0 || stock > 100000000) throw fail(400, 'Existencia inválida.');
    const p = await db.transaction(async tx => {
      const { rows } = await tx.query('INSERT INTO store_products(nombre,descripcion,categoria,price_cents,active,images,stock) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [...values, stock]);
      await tx.query('INSERT INTO store_movements(product_id,user_id,delta,reason,created_at) VALUES($1,$2,$3,$4,$5)', [rows[0].id, req.user.id, stock, 'Inventario inicial', new Date().toISOString()]);
      return product(rows[0]);
    }); res.status(201).json(p);
  }, true));
  app.put('/api/admin/products/:id', protectedRoute(async (req, res) => {
    const { rows } = await db.query('UPDATE store_products SET nombre=$1,descripcion=$2,categoria=$3,price_cents=$4,active=$5,images=$6 WHERE id=$7 RETURNING *', [...validateProduct(req.body), req.params.id]);
    if (!rows.length) throw fail(404, 'Producto no encontrado.');
    res.json(product(rows[0]));
  }, true));
  app.post('/api/admin/products/:id/stock', protectedRoute(async (req, res) => {
    const { cantidad, motivo } = req.body;
    if (!Number.isSafeInteger(cantidad) || !cantidad || Math.abs(cantidad) > 100000000 || !text(motivo)) throw fail(400, 'Indica un ajuste entero distinto de cero y su motivo.');
    const p = await db.transaction(async tx => {
      const { rows } = await tx.query('UPDATE store_products SET stock=stock+$1 WHERE id=$2 AND stock+$3>=0 AND stock+$4<=100000000 RETURNING *', [cantidad, req.params.id, cantidad, cantidad]);
      if (!rows.length) throw fail(409, 'Producto inexistente o ajuste fuera de límites.');
      await tx.query('INSERT INTO store_movements(product_id,user_id,delta,reason,created_at) VALUES($1,$2,$3,$4,$5)', [rows[0].id, req.user.id, cantidad, text(motivo), new Date().toISOString()]);
      return product(rows[0]);
    }); res.json(p);
  }, true));
  fs.mkdirSync(uploadDir, { recursive: true });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('photo');
  app.post('/api/admin/photos', (req, res, next) => authenticate(req).then(() => {
    if (req.user.role !== 'admin') throw fail(403, 'Acceso exclusivo para administradores.');
    upload(req, res, next);
  }).catch(next), route(async (req, res) => {
    const b = req.file?.buffer; let ext;
    if (b && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ext = 'png';
    else if (b && b[0] === 255 && b[1] === 216 && b[2] === 255) ext = 'jpg';
    else if (b && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') ext = 'webp';
    else throw fail(400, 'Carga una fotografía PNG, JPEG o WebP de hasta 5 MB.');
    const filename = crypto.randomUUID() + '.' + ext;
    await fs.promises.writeFile(path.join(uploadDir, filename), b);
    res.status(201).json({ url: '/uploads/' + filename });
  }));
  app.use('/uploads', express.static(uploadDir, { dotfiles: 'deny' }));
  app.post('/api/orders', protectedRoute(async (req, res) => {
    const { cliente, items } = req.body;
    if (!cliente || !text(cliente.nombre) || !text(cliente.telefono, 30) || !text(cliente.direccion, 1000)) throw fail(400, 'Nombre, teléfono y dirección son obligatorios.');
    if (!Array.isArray(items) || !items.length || items.length > 100) throw fail(400, 'El pedido debe incluir de 1 a 100 líneas.');
    const grouped = new Map();
    for (const item of items) {
      if (!item || !Number.isSafeInteger(item.id_producto) || item.id_producto <= 0 || !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 || item.cantidad > 100000) throw fail(400, 'Producto o cantidad inválidos.');
      const quantity = (grouped.get(item.id_producto) || 0) + item.cantidad;
      if (quantity > 100000) throw fail(400, 'Cantidad fuera de límites.');
      grouped.set(item.id_producto, quantity);
    }
    const payment = req.body.metodo_pago_preferido || 'Contra entrega';
    if (!['Contra entrega', 'Depósito bancario'].includes(payment)) throw fail(400, 'Método de pago no disponible.');
    const result = await db.transaction(async tx => {
      const details = []; let total = 0;
      for (const [id, quantity] of [...grouped].sort((a, b) => a[0] - b[0])) {
        const { rows } = await tx.query('UPDATE store_products SET stock=stock-$1 WHERE id=$2 AND active=1 AND stock>=$3 RETURNING *', [quantity, id, quantity]);
        if (!rows.length) throw fail(409, `El producto ${id} no tiene existencia suficiente o ya no está disponible. Actualiza el catálogo.`);
        const p = rows[0]; total += p.price_cents * quantity; details.push({ p, quantity });
      }
      if (!Number.isSafeInteger(total) || total > 2000000000) throw fail(400, 'El total del pedido supera el límite permitido.');
      const code = 'BC-' + crypto.randomBytes(8).toString('hex').toUpperCase();
      const customer = { nombre: text(cliente.nombre), telefono: text(cliente.telefono, 30), direccion: text(cliente.direccion, 1000), email: req.user.email };
      const { rows } = await tx.query('INSERT INTO store_orders(code,user_id,customer,total_cents,payment,comments,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [code, req.user.id, JSON.stringify(customer), total, payment, text(req.body.comentarios, 2000), new Date().toISOString()]);
      for (const { p, quantity } of details) {
        await tx.query('INSERT INTO store_order_items(order_id,product_id,nombre,quantity,price_cents) VALUES($1,$2,$3,$4,$5)', [rows[0].id, p.id, p.nombre, quantity, p.price_cents]);
        await tx.query('INSERT INTO store_movements(product_id,user_id,delta,reason,created_at) VALUES($1,$2,$3,$4,$5)', [p.id, req.user.id, -quantity, `Pedido ${code}`, new Date().toISOString()]);
      }
      return { codigo_pedido: code, estado_actual: 'Recibido', total: total / 100, mensaje: 'Pedido confirmado y existencias reservadas. Pago pendiente por ' + payment.toLowerCase() + '.', revision_requerida: false };
    }); res.status(201).json(result);
  }));
  const orderView = o => ({ ...o, cliente: JSON.parse(o.customer), codigo_pedido: o.code, total: o.total_cents / 100, estado_actual: o.status });
  app.get('/api/orders', protectedRoute(async (req, res) => res.json((await db.query('SELECT * FROM store_orders WHERE user_id=$1 ORDER BY id DESC', [req.user.id])).rows.map(orderView))));
  app.get('/api/orders/:code', protectedRoute(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM store_orders WHERE code=$1', [req.params.code]);
    if (!rows.length || (req.user.role !== 'admin' && rows[0].user_id !== req.user.id)) throw fail(404, 'Pedido no encontrado.');
    res.json({ ...orderView(rows[0]), detalle: (await db.query('SELECT * FROM store_order_items WHERE order_id=$1', [rows[0].id])).rows });
  }));
  app.get('/api/admin/orders', protectedRoute(async (req, res) => res.json((await db.query('SELECT * FROM store_orders ORDER BY id DESC LIMIT 500')).rows.map(orderView)), true));
  app.patch('/api/admin/orders/:id', protectedRoute(async (req, res) => {
    const status = req.body.estado_actual;
    const transitions = { Recibido: ['Preparando', 'Cancelado'], Preparando: ['Enviado', 'Cancelado'], Enviado: ['Entregado'], Entregado: [], Cancelado: [] };
    const order = await db.transaction(async tx => {
      const { rows } = await tx.query('SELECT * FROM store_orders WHERE id=$1' + (db.postgres ? ' FOR UPDATE' : ''), [req.params.id]);
      const o = rows[0];
      if (!o) throw fail(404, 'Pedido no encontrado.');
      if (!transitions[o.status]?.includes(status)) throw fail(409, 'Cambio de estado no permitido.');
      if (status === 'Cancelado') {
        for (const item of (await tx.query('SELECT * FROM store_order_items WHERE order_id=$1 ORDER BY product_id', [o.id])).rows) {
          await tx.query('UPDATE store_products SET stock=stock+$1 WHERE id=$2', [item.quantity, item.product_id]);
          await tx.query('INSERT INTO store_movements(product_id,user_id,delta,reason,created_at) VALUES($1,$2,$3,$4,$5)', [item.product_id, req.user.id, item.quantity, 'Cancelación ' + o.code, new Date().toISOString()]);
        }
      }
      return (await tx.query('UPDATE store_orders SET status=$1 WHERE id=$2 RETURNING *', [status, o.id])).rows[0];
    }); res.json(orderView(order));
  }, true));
  app.get('/health', route(async (req, res) => { await db.query('SELECT 1'); res.json({ status: 'ok', db: db.postgres ? 'postgresql' : 'sqlite' }); }));
  for (const [url, file] of [['/', 'index.html'], ['/cuenta', 'account.html'], ['/admin', 'admin.html'], ['/store-ui.js', 'store-ui.js'], ['/store.css', 'store.css']]) app.get(url, (req, res) => res.sendFile(path.join(__dirname, file)));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((err, req, res, next) => {
    const status = err.status || (err instanceof multer.MulterError ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'No se pudo completar la operación.' : err.message });
  });
  return { app, db };
}
if (require.main === module) createApp().then(({ app }) => app.listen(process.env.PORT || 3002, '0.0.0.0', () => console.log('Belleza Conceptual lista en puerto ' + (process.env.PORT || 3002)))).catch(error => { console.error(error); process.exit(1); });
module.exports = { createApp, hashPassword };
