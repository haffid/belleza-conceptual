require('dotenv').config();
const { openDatabase } = require('./db');
const tables = ['store_users','store_products','store_orders','store_order_items','store_movements'];
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL para el PostgreSQL de destino.');
  // Read the SQLite source explicitly; do not allow its URL to be inherited.
  const targetUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const source = await openDatabase();
  let target;
  try {
    target = await openDatabase({ url: targetUrl });
    await target.transaction(async tx => {
      for (const table of [...tables, 'store_sessions']) if ((await tx.query(`SELECT 1 FROM ${table} LIMIT 1`)).rows.length) throw new Error('El PostgreSQL de destino debe estar vacío. No se modificó ningún dato.');
      for (const table of tables) {
        for (const row of (await source.query(`SELECT * FROM ${table}`)).rows) {
          const keys = Object.keys(row);
          await tx.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`, keys.map(k=>row[k]));
        }
        await tx.query(`SELECT setval(pg_get_serial_sequence('${table}','id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM ${table}`);
      }
    });
    console.log('Usuarios, productos, pedidos y movimientos migrados. Las sesiones no se copian: inicia sesión nuevamente. Copia también UPLOAD_DIR al servidor.');
  } finally { await source.close(); if (target) await target.close(); }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
