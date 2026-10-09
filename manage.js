require('dotenv').config();
const { openDatabase } = require('./db');
const { hashPassword } = require('./server');
async function main() {
  const command = process.argv[2];
  const db = await openDatabase();
  try {
    if (command === 'admin') {
      const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase(), password = process.env.ADMIN_PASSWORD || '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 128) throw new Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD (10 a 128 caracteres) en .env.');
      const existing = (await db.query('SELECT id FROM store_users WHERE email=$1', [email])).rows;
      if (existing.length) throw new Error('El correo ya existe. Usa un correo exclusivo para el administrador.');
      await db.query("INSERT INTO store_users(email,password,role,nombre) VALUES($1,$2,'admin',$3)", [email, await hashPassword(password), process.env.ADMIN_NAME || 'Administrador']);
      console.log('Administrador creado. Elimina ADMIN_PASSWORD de .env después de este paso.');
    } else if (command === 'seed') {
      await db.transaction(async tx => {
        if ((await tx.query('SELECT id FROM store_products LIMIT 1')).rows.length) throw new Error('El catálogo ya tiene productos. No se modificaron existencias.');
        const products = [
          ['Limpiador Facial Espuma Suave 150ml','Limpieza diaria para piel sensible, libre de sulfatos.','Cuidado facial',6500,13],
          ['Crema Hidratante Día y Noche 50g','Hidratación profunda con ácido hialurónico.','Cuidado facial',8900,16],
          ['Sérum Vitamina C 30ml','Ilumina y unifica el tono de la piel.','Cuidado facial',14500,0],
          ['Base Líquida Cobertura Media 30ml','Acabado natural.','Maquillaje',12000,22],
          ['Paleta de Sombras Tonos Tierra','12 tonos mate y shimmer.','Maquillaje',9800,10],
          ['Labial Mate Larga Duración','Fórmula libre de resequedad.','Maquillaje',5500,13],
          ['Shampoo Reparador 400ml','Fortalece la fibra capilar.','Cuidado capilar',7200,16],
          ['Aceite Capilar Argán 60ml','Brillo y control del frizz.','Cuidado capilar',9500,19],
          ['Mascarilla Capilar Nutritiva 300ml','Tratamiento semanal intensivo.','Cuidado capilar',8000,22],
        ];
        for (const p of products) await tx.query('INSERT INTO store_products(nombre,descripcion,categoria,price_cents,stock) VALUES($1,$2,$3,$4,$5)', p);
      }); console.log('Nueve productos de demostración creados.');
    } else throw new Error('Usa: node manage.js admin | seed');
  } finally { await db.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
