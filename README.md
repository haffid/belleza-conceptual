# Belleza Conceptual

Tienda en Node.js/Express con SQLite local y PostgreSQL para el servidor. Conserva el diseño del catálogo original. No requiere Python.

## Funciones

- Registro e inicio de sesión de clientes; perfil con teléfono y dirección; historial y detalle de pedidos propios.
- Administradores creados desde terminal, con el mismo inicio de sesión y permisos comprobados en la API.
- Productos con nombre, descripción, categoría, precio en quetzales, hasta diez fotografías y visibilidad.
- Fotografías por URL HTTPS o carga de JPEG, PNG y WebP de hasta 5 MB por archivo.
- `/admin`: inventario con búsqueda, filtros, existencias bajas y agotados, ajustes con motivo y movimientos.
- Pedidos calculados con los precios del servidor. Las líneas repetidas se agrupan y las existencias se descuentan dentro de la misma transacción que guarda el pedido. Si falta un producto se revierte TODO y se responde HTTP 409.
- Estados: Recibido → Preparando → Enviado → Entregado. Se permite cancelar desde Recibido o Preparando; se devuelve inventario una sola vez y se registra el movimiento.
- Contraseñas con scrypt, sesiones opacas en cookies HttpOnly y SameSite, límites a intentos de acceso, consultas parametrizadas y controles de permisos.

## Empezar con SQLite

Requiere Node.js 22 o superior y npm. Desde esta carpeta:

```powershell
npm install
Copy-Item .env.example .env
```

Edita `.env` y define tu correo y una contraseña de 10 a 128 caracteres en `ADMIN_EMAIL` y `ADMIN_PASSWORD`. No hay credenciales predeterminadas. Después:

```powershell
npm run admin:create
npm run seed
npm start
```

`seed` es opcional: agrega los nueve productos originales de demostración solo si el catálogo está vacío. No modifica un inventario existente. Elimina `ADMIN_PASSWORD` de `.env` después de crear el administrador. Puedes crear más administradores cambiando el correo y contraseña y ejecutando el comando nuevamente.

Abre:

- Tienda: http://localhost:3002/
- Clientes: http://localhost:3002/cuenta
- Administración: http://localhost:3002/admin
- Estado del servicio: http://localhost:3002/health

Las tablas se crean automáticamente al iniciar. SQLite guarda sus datos en `data/store.sqlite`; las fotos se guardan en `uploads`. El carrito permanece en el navegador para poder iniciar sesión antes de comprar. Crea un cliente, agrega productos al carrito y confirma con nombre, teléfono y dirección. El pedido aparece en ambas áreas y disminuye el inventario.

## PostgreSQL y traslado de datos

Configura una base y un usuario PostgreSQL con permisos para crear tablas. El código utiliza el mismo esquema para ambos motores. `DATABASE_URL` selecciona PostgreSQL; vacío selecciona SQLite. `DB_SSL=true` activa TLS con validación del certificado. Si tu servidor usa una CA privada, configura `NODE_EXTRA_CA_CERTS` con el archivo de la CA; no desactives la validación.

Para trasladar una tienda existente de SQLite:

1. Detén la aplicación y respalda `data/store.sqlite` y `uploads`. No migres mientras haya escrituras. Usa una copia íntegra de SQLite; tras detener el proceso incluye archivos WAL/SHM si todavía existen.
2. Mantén `SQLITE_PATH` apuntando a la base origen. Configura `DATABASE_URL` con el PostgreSQL de destino.
3. Ejecuta `npm run db:migrate:postgres`. El destino debe tener las tablas de tienda vacías. El traslado es transaccional y conserva IDs, usuarios, contraseñas, productos, pedidos y movimientos. Ajusta las secuencias de PostgreSQL.
4. Copia `uploads` al servidor y configura `UPLOAD_DIR` con esa ruta persistente.
5. Inicia con `DATABASE_URL` y verifica `/health`, el catálogo, el inventario y los pedidos. Los usuarios deben iniciar sesión nuevamente porque las sesiones no se trasladan.

El script no borra el SQLite original. Cambiar únicamente `DATABASE_URL` conecta con otra base; no mueve los datos automáticamente.

### Archivos del prototipo anterior

`schema.sql` y `seed.sql` corresponden al modelo anterior basado en tablas `producto`, `cliente` y `pedido`. Se conservan como referencia; **no los ejecutes para esta versión**. La tienda usa tablas `store_*` para evitar alterar o borrar datos anteriores. Si existe una base de producción del prototipo, su historial requiere una importación específica: el script incluido traslada exclusivamente esta versión de SQLite a PostgreSQL. Ninguna base de producción fue proporcionada o modificada durante este trabajo.

## Servidor Azure

Para una VM Azure con Node.js y PostgreSQL instalados:

1. Copia el proyecto, `package-lock.json` y las fotografías a una carpeta persistente. Ejecuta `npm ci` con Node.js 22 o superior.
2. Configura `.env` o variables del servicio: `DATABASE_URL`, `DB_SSL` según tu PostgreSQL, `NODE_ENV=production`, `PORT=3002`, `UPLOAD_DIR` en almacenamiento persistente y `TRUST_PROXY=1` solo si hay un único proxy confiable delante del proceso.
3. Migra tus datos o crea el administrador con `npm run admin:create`. Para un catálogo nuevo agrega tus productos desde `/admin`. No cargues datos de demostración en una tienda real por accidente.
4. Ejecuta `npm start` mediante un servicio que reinicie el proceso (systemd en Linux o un servicio Node en Windows).
5. Configura un proxy inverso con HTTPS, por ejemplo Nginx o IIS, hacia `127.0.0.1:3002`. Conserva la cabecera Host y reenvía el protocolo y la dirección del cliente. Restringe el puerto de Node a la red interna. Las cookies de producción requieren HTTPS.
6. Permite PostgreSQL solo desde el servidor de la aplicación y programa respaldos de la base y las fotos.

También puedes usar Azure App Service con un runtime Node.js compatible y comando de inicio `npm start`. Define las variables en su configuración, deja que Azure proporcione `PORT`, activa HTTPS y usa almacenamiento persistente para `UPLOAD_DIR`. Usa PostgreSQL si ejecutas varias instancias; las fotografías requieren un volumen compartido o una futura integración de Blob Storage. SQLite es para el arranque local o un único servidor con disco persistente.

Documentación oficial: [Node.js en Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs) y [variables de configuración](https://learn.microsoft.com/en-us/azure/app-service/configure-common).

## Validación

```powershell
npm test
```

Las pruebas HTTP comprueban cuentas y roles, actualización del perfil, aislamiento de pedidos, líneas duplicadas, reversión por falta de stock, compras simultáneas, devolución al cancelar una sola vez, ajustes inválidos, productos inactivos, carga de fotos y cierre de sesión. Se ejecutan con una base SQLite temporal. Puedes ejecutar las mismas pruebas en una **base PostgreSQL vacía y desechable** definiendo `TEST_DATABASE_URL`. Nunca uses una base real para las pruebas. La migración y el despliegue real requieren conexión al servidor de destino para verificarlos.

## Alcance de pagos

Esta versión registra compras con pago pendiente por depósito bancario o contra entrega. No procesa tarjetas, no verifica depósitos y no cobra automáticamente. Para cobros en línea falta seleccionar una pasarela, integrar su checkout y verificar sus webhooks. Tampoco incluye todavía recuperación de contraseña por correo, cálculo de envío/impuestos o notificaciones automáticas.
