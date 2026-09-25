const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// Render: frontend y API se publican desde el mismo Web Service.
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "belleza_conceptual",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  ssl: (process.env.DB_SSL || "false").toLowerCase() === "true" ? { rejectUnauthorized: false } : false,
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ service: "catalog-orders-service", status: "ok", db: "up" });
  } catch (err) {
    res.status(500).json({ service: "catalog-orders-service", status: "error", db: "down", detail: err.message });
  }
});

// RF-01 / RF-09 — catálogo con nombre, precio y disponibilidad.
app.get("/api/products", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id_producto, p.nombre, p.descripcion, p.precio, c.nombre AS categoria,
             COALESCE(i.cantidad_disponible, 0) AS cantidad_disponible
      FROM producto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
      LEFT JOIN inventario i ON i.id_producto = p.id_producto
      WHERE p.estado_activo = true
      ORDER BY c.nombre, p.nombre;
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "No se pudo cargar el catálogo.", detail: err.message });
  }
});

// RF-03 / RN-02 / RN-03 — registro de pedido con validación de disponibilidad.
app.post("/api/orders", async (req, res) => {
  const { cliente, items, metodo_pago_preferido, comentarios } = req.body || {};

  if (!cliente || !cliente.nombre || !cliente.telefono) {
    return res.status(400).json({ error: "Nombre y teléfono del cliente son obligatorios." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "El pedido debe incluir al menos un producto." });
  }
  for (const it of items) {
    if (!it.id_producto || !Number.isInteger(it.cantidad) || it.cantidad <= 0) {
      return res.status(400).json({ error: "Cada línea debe indicar id_producto y una cantidad entera mayor a 0." });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Verificar disponibilidad real de cada línea (RN-03).
    const productIds = items.map(it => it.id_producto);
    const { rows: productos } = await client.query(
      `SELECT p.id_producto, p.nombre, p.precio, i.cantidad_disponible, i.id_inventario
       FROM producto p JOIN inventario i ON i.id_producto = p.id_producto
       WHERE p.id_producto = ANY($1::int[]) FOR UPDATE OF i`,
      [productIds]
    );
    const porId = Object.fromEntries(productos.map(p => [p.id_producto, p]));

    const faltantes = [];
    for (const it of items) {
      const prod = porId[it.id_producto];
      if (!prod) { faltantes.push(`Producto ${it.id_producto} no existe`); continue; }
      if (prod.cantidad_disponible < it.cantidad) {
        faltantes.push(`${prod.nombre}: solicitado ${it.cantidad}, disponible ${prod.cantidad_disponible}`);
      }
    }
    const todoDisponible = faltantes.length === 0;

    // 2) Registrar cliente (RF-03).
    const { rows: clienteRows } = await client.query(
      `INSERT INTO cliente (nombre, telefono, email, direccion) VALUES ($1,$2,$3,$4) RETURNING id_cliente`,
      [cliente.nombre, cliente.telefono, cliente.email || null, cliente.direccion || null]
    );
    const idCliente = clienteRows[0].id_cliente;

    // 3) Calcular total con el precio vigente del producto.
    let total = 0;
    const detalle = items.map(it => {
      const prod = porId[it.id_producto];
      const precio = prod ? Number(prod.precio) : 0;
      const subtotal = precio * it.cantidad;
      total += subtotal;
      return { ...it, precio, subtotal, nombre: prod ? prod.nombre : `#${it.id_producto}` };
    });

    // 4) Estado inicial: si falta existencia en alguna línea, el pedido queda en
    //    revisión manual en vez de bloquearse (RF-03 regla R2 / CU-03 flujo alterno A2).
    const estadoInicial = todoDisponible ? "Recibido" : "En revisión";

    const { rows: pedidoRows } = await client.query(
      `INSERT INTO pedido (id_cliente, codigo_pedido, total, estado_actual, metodo_pago_preferido, comentarios)
       VALUES ($1, 'TEMP', $2, $3, $4, $5) RETURNING id_pedido`,
      [idCliente, total, estadoInicial, metodo_pago_preferido || null, comentarios || null]
    );
    const idPedido = pedidoRows[0].id_pedido;
    const codigoPedido = "BC-" + String(idPedido).padStart(5, "0");
    await client.query(`UPDATE pedido SET codigo_pedido = $1 WHERE id_pedido = $2`, [codigoPedido, idPedido]);

    for (const d of detalle) {
      await client.query(
        `INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5)`,
        [idPedido, d.id_producto, d.cantidad, d.precio, d.subtotal]
      );
    }

    // 5) Solo se descuenta inventario cuando TODO el pedido tiene existencia real (RF-06 / RNF-07).
    if (todoDisponible) {
      for (const it of items) {
        const prod = porId[it.id_producto];
        await client.query(
          `UPDATE inventario SET cantidad_disponible = cantidad_disponible - $1, ultima_actualizacion = now()
           WHERE id_producto = $2 AND cantidad_disponible >= $1`,
          [it.cantidad, it.id_producto]
        );
        await client.query(
          `INSERT INTO movimiento_inventario (id_inventario, tipo_movimiento, cantidad, motivo)
           VALUES ($1, 'SALIDA', $2, $3)`,
          [prod.id_inventario, it.cantidad, `Pedido ${codigoPedido}`]
        );
      }
    }

    await client.query(
      `INSERT INTO seguimiento_estado (id_pedido, estado, observaciones) VALUES ($1,$2,$3)`,
      [idPedido, estadoInicial, todoDisponible ? "Pedido recibido con existencia confirmada." : `Pendiente de revisión manual: ${faltantes.join("; ")}`]
    );

    await client.query("COMMIT");

    res.status(201).json({
      codigo_pedido: codigoPedido,
      estado_actual: estadoInicial,
      total: total.toFixed(2),
      revision_requerida: !todoDisponible,
      detalle_no_disponible: todoDisponible ? [] : faltantes,
      mensaje: todoDisponible
        ? "Pedido recibido. Nuestro equipo lo revisará y te contactará para coordinar el pago."
        : "Pedido recibido, pero una o más líneas no tienen existencia suficiente; quedó marcado para revisión manual antes de confirmarse.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "No se pudo registrar el pedido.", detail: err.message });
  } finally {
    client.release();
  }
});

// Consulta de seguimiento por código (útil para demostrar CU-03 / CU-06 en el video).
app.get("/api/orders/:codigo", async (req, res) => {
  try {
    const { rows: pedidos } = await pool.query(
      `SELECT p.*, c.nombre AS cliente_nombre, c.telefono, c.email
       FROM pedido p JOIN cliente c ON c.id_cliente = p.id_cliente
       WHERE p.codigo_pedido = $1`,
      [req.params.codigo]
    );
    if (pedidos.length === 0) return res.status(404).json({ error: "Pedido no encontrado." });
    const { rows: detalle } = await pool.query(
      `SELECT dp.*, pr.nombre FROM detalle_pedido dp JOIN producto pr ON pr.id_producto = dp.id_producto WHERE id_pedido = $1`,
      [pedidos[0].id_pedido]
    );
    res.json({ ...pedidos[0], detalle });
  } catch (err) {
    res.status(500).json({ error: "No se pudo consultar el pedido.", detail: err.message });
  }
});

const PORT = process.env.PORT || process.env.CATALOG_PORT || 3002;
app.listen(PORT, () => console.log(`catalog-orders-service escuchando en el puerto ${PORT}`));
