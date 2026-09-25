# Belleza Conceptual — versión lista para Render

Proyecto mínimo funcional para la entrega de Calidad de Software:

- Frontend: `index.html`
- Backend/API: Node.js + Express (`server.js`)
- Base de datos: PostgreSQL
- Flujo: catálogo → carrito → datos del cliente → pedido → persistencia en PostgreSQL

## Arquitectura de despliegue

La versión incluida en esta carpeta está preparada para usar **un solo Web Service de Render** para el frontend y la API, más una instancia de **Render PostgreSQL**.

El navegador abre `/`, Express devuelve `index.html` y el frontend consume la API con rutas relativas (`/api/products`, `/api/orders`). Por eso no es necesario cambiar manualmente una URL del backend después del despliegue.

## Archivos

- `index.html`: frontend del catálogo, carrito y checkout.
- `server.js`: API Express y publicación de `index.html` en `/`.
- `package.json`: dependencias y comando `npm start`.
- `schema.sql`: creación de tablas requeridas.
- `seed.sql`: datos de prueba (9 productos; uno queda agotado para demostrar ese caso).
- `.gitignore`: evita subir dependencias y archivos locales innecesarios.

## 1. Crear PostgreSQL en Render

Crea una base PostgreSQL y conserva los datos de conexión. Para este proyecto se usan estas variables de entorno:

```text
DB_HOST
DB_PORT=5432
DB_NAME
DB_USER
DB_PASSWORD
DB_SSL=true
```

Usa preferentemente los datos de conexión **Internal** cuando el Web Service y PostgreSQL estén en la misma región.

## 2. Crear las tablas y datos de prueba

Conéctate a PostgreSQL (por ejemplo con pgAdmin usando los datos externos) y ejecuta, en este orden:

1. `schema.sql`
2. `seed.sql`

`seed.sql` está pensado para una base vacía de esta entrega. Ejecútalo una sola vez.

## 3. Subir a GitHub

Sube esta carpeta al repositorio. No subas `node_modules`.

## 4. Crear el Web Service en Render

Configuración recomendada:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
Instance Type: Free
Health Check Path: /health
```

Agrega las seis variables de entorno indicadas arriba. **No agregues `PORT` manualmente**; Render la proporciona y `server.js` ya la utiliza.

## 5. Pruebas después del despliegue

Si la URL generada fuera:

```text
https://belleza-conceptual.onrender.com
```

comprueba:

```text
/health
/api/products
/
```

`/health` debe responder con `status: "ok"` y `db: "up"`. `/api/products` debe devolver el catálogo y `/` debe mostrar la página.

Después crea un pedido desde el frontend y consulta su código con:

```text
/api/orders/BC-00001
```

## Ejecución local opcional

Con PostgreSQL local disponible:

```bash
npm install
```

En Windows PowerShell puedes definir las variables y ejecutar `npm start`; el servidor local usa el puerto 3002 si `PORT` no está definida.
