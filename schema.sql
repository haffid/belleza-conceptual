-- Subconjunto del modelo relacional de Belleza Conceptual necesario para el
-- flujo mínimo catálogo -> carrito -> pedido -> base de datos.
-- Mismos nombres de tabla y columna que el modelo ya definido (Entregable 7 / E2).
-- No crea USUARIO/ROL/CARRITO/LINEA_CARRITO/PAGO/ENTREGA/NOTIFICACION/REPORTE/IMAGEN_PRODUCTO:
-- esas quedan fuera del alcance de esta versión mínima (el carrito vive en el navegador
-- hasta que se envía el pedido).

CREATE TABLE IF NOT EXISTS categoria (
  id_categoria   SERIAL PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  descripcion    TEXT,
  estado         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS producto (
  id_producto    SERIAL PRIMARY KEY,
  id_categoria   INT NOT NULL REFERENCES categoria(id_categoria),
  nombre         VARCHAR(150) NOT NULL,
  descripcion    TEXT,
  precio         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estado_activo  BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventario (
  id_inventario       SERIAL PRIMARY KEY,
  id_producto         INT NOT NULL UNIQUE REFERENCES producto(id_producto),
  cantidad_disponible INT NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  ultima_actualizacion TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movimiento_inventario (
  id_movimiento   SERIAL PRIMARY KEY,
  id_inventario   INT NOT NULL REFERENCES inventario(id_inventario),
  tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('ENTRADA','SALIDA','AJUSTE')),
  cantidad        INT NOT NULL,
  motivo          VARCHAR(200),
  fecha_movimiento TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cliente (
  id_cliente     SERIAL PRIMARY KEY,
  nombre         VARCHAR(150) NOT NULL,
  telefono       VARCHAR(30) NOT NULL,
  email          VARCHAR(150),
  direccion      TEXT,
  fecha_registro TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedido (
  id_pedido            SERIAL PRIMARY KEY,
  id_cliente           INT NOT NULL REFERENCES cliente(id_cliente),
  codigo_pedido        VARCHAR(20) NOT NULL UNIQUE,
  fecha_pedido         TIMESTAMP NOT NULL DEFAULT now(),
  total                DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estado_actual        VARCHAR(30) NOT NULL DEFAULT 'Recibido',
  metodo_pago_preferido VARCHAR(30),
  comentarios          TEXT
);

CREATE TABLE IF NOT EXISTS detalle_pedido (
  id_detalle     SERIAL PRIMARY KEY,
  id_pedido      INT NOT NULL REFERENCES pedido(id_pedido),
  id_producto    INT NOT NULL REFERENCES producto(id_producto),
  cantidad       INT NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal       DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS seguimiento_estado (
  id_seguimiento SERIAL PRIMARY KEY,
  id_pedido      INT NOT NULL REFERENCES pedido(id_pedido),
  estado         VARCHAR(30) NOT NULL,
  fecha_cambio   TIMESTAMP NOT NULL DEFAULT now(),
  observaciones  TEXT
);
