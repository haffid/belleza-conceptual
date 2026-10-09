const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
async function openDatabase(options = {}) {
  const url = options.url || (!options.filename && process.env.DATABASE_URL);
  let sqlite, pool;
  if (url) pool = new Pool({ connectionString: url, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false });
  else {
    const filename = options.filename || process.env.SQLITE_PATH || path.join(__dirname, 'data', 'store.sqlite');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    sqlite = new (require('better-sqlite3'))(filename);
    sqlite.pragma('journal_mode = WAL'); sqlite.pragma('foreign_keys = ON'); sqlite.pragma('busy_timeout = 5000');
  }
  const queryWith = async (client, sql, params = []) => {
    if (pool) return client.query(sql, params);
    const statement = sqlite.prepare(sql.replace(/\$\d+/g, '?'));
    if (statement.reader) return { rows: statement.all(...params) };
    return { rows: [], rowCount: statement.run(...params).changes };
  };
  let tail = Promise.resolve();
  const exclusive = fn => { const result = tail.then(fn); tail = result.catch(() => {}); return result; };
  const db = {
    postgres: !!pool,
    query: (sql, params) => pool ? queryWith(pool, sql, params) : exclusive(() => queryWith(null, sql, params)),
    transaction: async fn => {
      const run = async () => {
        const client = pool ? await pool.connect() : null;
        const query = (sql, params) => queryWith(client, sql, params);
        try { await query(pool ? 'BEGIN' : 'BEGIN IMMEDIATE'); const result = await fn({ query }); await query('COMMIT'); return result; }
        catch (error) { await query('ROLLBACK'); throw error; }
        finally { if (client) client.release(); }
      };
      return pool ? run() : exclusive(run);
    },
    close: async () => pool ? pool.end() : sqlite.close(),
  };
  const id = pool ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const statements = [
    `CREATE TABLE IF NOT EXISTS store_users (id ${id}, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('customer','admin')), nombre TEXT NOT NULL, telefono TEXT NOT NULL DEFAULT '', direccion TEXT NOT NULL DEFAULT '')`,
    `CREATE TABLE IF NOT EXISTS store_sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES store_users(id), expires BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS store_products (id ${id}, nombre TEXT NOT NULL, descripcion TEXT NOT NULL DEFAULT '', categoria TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents >= 0), stock INTEGER NOT NULL CHECK(stock >= 0), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), images TEXT NOT NULL DEFAULT '[]')`,
    `CREATE TABLE IF NOT EXISTS store_orders (id ${id}, code TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL REFERENCES store_users(id), customer TEXT NOT NULL, total_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Recibido', payment TEXT NOT NULL, comments TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS store_order_items (id ${id}, order_id INTEGER NOT NULL REFERENCES store_orders(id), product_id INTEGER NOT NULL REFERENCES store_products(id), nombre TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), price_cents INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS store_movements (id ${id}, product_id INTEGER NOT NULL REFERENCES store_products(id), user_id INTEGER NOT NULL REFERENCES store_users(id), delta INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL)`,
    'CREATE INDEX IF NOT EXISTS store_orders_user ON store_orders(user_id)',
    'CREATE INDEX IF NOT EXISTS store_movements_product ON store_movements(product_id)',
  ];
  for (const sql of statements) await db.query(sql);
  return db;
}
module.exports = { openDatabase };
