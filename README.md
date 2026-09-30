# Belleza Conceptual — Tienda en línea

Tienda en línea B2C de artículos de belleza, desarrollada como proyecto de transformación digital para el curso de Aseguramiento de la Calidad del Software (UMG).

El cliente consulta el catálogo, arma un carrito y envía su pedido con sus datos de contacto. El pedido queda registrado en PostgreSQL y el inventario se descuenta. **Registrar un pedido no confirma la venta**: el personal de ventas valida la existencia y coordina el pago.

| Ambiente | Dónde corre | Para qué se usa |
|---|---|---|
| Demo pública | Render (Web Service + Render PostgreSQL) | Evidencia de despliegue en cloud (Fase 1, E6) |
| Staging | Docker Compose en el agente de Jenkins (app + PostgreSQL 17) | Despliegue automatizado y verificación del Sprint 2 |
| Local | `npm start` con PostgreSQL propio | Desarrollo |

Documentación:

- [Arquitectura final](docs/ARQUITECTURA.md)
- [Plan de pruebas](docs/PLAN-DE-PRUEBAS.md)
- [Scrum — Sprint 2](docs/SCRUM-SPRINT-2.md)
- [Guía de staging con Docker y Jenkins](LEEME-STAGING.md)

---

## 1. Estructura del repositorio

```text
.
├── server.js                 API Express; también publica index.html en "/"
├── index.html                Frontend: catálogo, carrito y checkout
├── schema.sql                8 tablas (catálogo, inventario, clientes, pedidos)
├── seed.sql                  Catálogo de prueba (9 productos, uno agotado)
├── package.json              Dependencias Node (express, pg, cors)
├── requirements.txt          Dependencias de pruebas (pytest, requests, selenium, pytest-html)
├── tests/
│   ├── test_api.py           4 pruebas de API
│   ├── test_security.py      6 pruebas de validación y seguridad
│   ├── test_performance.py   2 pruebas de tiempo de respuesta
│   └── selenium/
│       └── test_frontend.py  4 pruebas end-to-end en Chrome
├── Dockerfile                Imagen de la app (node:22-bookworm-slim, usuario node)
├── Dockerfile.db             Imagen de PostgreSQL 17 con schema.sql y seed.sql
├── compose.staging.yaml      Staging: servicios app + db con healthchecks
├── .env.staging.example      Plantilla de variables de staging (sin secretos)
├── Jenkinsfile               Pipeline Linux: Checkout → Build → Test → Deploy Staging → Verify Staging
├── Jenkinsfile.windows       Variante para agente Windows (Deploy Staging opcional)
├── LEEME-STAGING.md          Guía de staging
└── docs/                     Arquitectura, plan de pruebas y artefactos Scrum
```

## 2. API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Frontend (`index.html`) |
| GET | `/health` | Estado del servicio y de la base: `{"status":"ok","db":"up"}` |
| GET | `/api/products` | Catálogo activo con precio, categoría y `cantidad_disponible` |
| POST | `/api/orders` | Registra un pedido. Responde 400 si faltan nombre/teléfono, si no hay productos o si una cantidad es ≤ 0 |
| GET | `/api/orders/:codigo` | Consulta un pedido por código (`BC-00001`). Responde 404 si no existe |

## 3. Variables de entorno de la aplicación

| Variable | Ejemplo | Nota |
|---|---|---|
| `DB_HOST` | `db` / host de Render | |
| `DB_PORT` | `5432` | |
| `DB_NAME` | `belleza_conceptual` | |
| `DB_USER` | | |
| `DB_PASSWORD` | | Nunca en el repositorio |
| `DB_SSL` | `true` en Render, `false` en staging | |
| `PORT` | | Si no se define, la app usa `3002` |

## 4. Ejecución local

Con PostgreSQL disponible y `schema.sql` y `seed.sql` ejecutados en ese orden:

```bash
npm install
# definir las variables DB_* de la sección 3
npm start          # http://localhost:3002
```

## 5. Staging con Docker

Resumen (el detalle está en [LEEME-STAGING.md](LEEME-STAGING.md)):

```bash
cp .env.staging.example .env.staging     # definir STAGING_DB_PASSWORD
docker compose --env-file .env.staging -f compose.staging.yaml up -d --build --wait --wait-timeout 180
```

La app queda en `http://localhost:3003` y `/health` debe responder `status: ok` y `db: up`.

## 6. Pruebas automatizadas

Son 16 pruebas con pytest; 4 de ellas usan Selenium con Chrome. Todas leen la URL objetivo de `BASE_URL`. Si no se define, apuntan a Render.

```bash
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt       # Windows: .venv\Scripts\python.exe

BASE_URL=http://localhost:3003 HEADLESS=true \
  .venv/bin/python -m pytest -v --junitxml=pytest-results.xml --html=report.html --self-contained-html
```

| Variable | Valor por defecto | Uso |
|---|---|---|
| `BASE_URL` | `https://belleza-conceptual.onrender.com` | Ambiente contra el que se prueba |
| `HEADLESS` | `false` | `true` para correr Chrome sin ventana (Jenkins) |
| `MAX_RESPONSE_SECONDS` | `5` | Umbral de las pruebas de rendimiento |

El detalle de cada prueba está en el [plan de pruebas](docs/PLAN-DE-PRUEBAS.md).

## 7. Integración continua con Jenkins

El `Jenkinsfile` define cinco etapas:

```text
Checkout → Build → Test → Deploy Staging → Verify Staging
```

1. **Checkout**: obtiene la rama `devops-sprint2`.
2. **Build**: `npm ci`, crea el entorno virtual de Python e instala `requirements.txt`.
3. **Test**: ejecuta las 16 pruebas contra `BASE_URL`.
4. **Deploy Staging**: `docker compose up --build --wait` con la contraseña de la credencial `staging-db-password`.
5. **Verify Staging**: vuelve a ejecutar las 16 pruebas contra el staging recién desplegado.

En `post` se publican los resultados JUnit (`pytest-results*.xml`) y se archivan los reportes HTML (`report*.html`). La configuración del job está en [LEEME-STAGING.md](LEEME-STAGING.md#5-pipeline-de-jenkins).

## 8. Despliegue en Render (demo pública)

1. Crear una instancia de Render PostgreSQL y ejecutar `schema.sql` y `seed.sql`.
2. Crear un Web Service con Runtime `Node`, Build `npm install`, Start `npm start` y Health Check `/health`.
3. Definir las seis variables `DB_*` con `DB_SSL=true`. No definir `PORT`, porque Render la asigna.
4. Verificar `/health`, `/api/products` y `/`.

El plan gratuito suspende el servicio por inactividad; la primera solicitud después de una pausa puede tardar en responder.

## 9. Equipo

| Integrante | Rol Scrum |
|---|---|
| Omar Haffid Espina Sarceño | Líder de Grupo · Product Owner |
| Angel Estuardo Barrios Gómez | Scrum Master |
| Juan Carlos Pineda Bran | Development Team |
| David Eduardo Romero Gerónimo | Development Team · QA |
