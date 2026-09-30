# Staging de Belleza Conceptual con Docker y Jenkins

Staging es un ambiente previo a producción. Levanta la misma aplicación con su propia base PostgreSQL, sin tocar la demo de Render. Jenkins lo despliega y lo verifica automáticamente con las 16 pruebas.

Rama: `devops-sprint2`. Los archivos de staging entraron en el commit `d0f59c9`.

## Qué crea

| Componente | Detalle |
|---|---|
| Proyecto Compose | `belleza-staging` |
| Servicio `app` | Imagen desde `Dockerfile` (Node 22, usuario sin privilegios). Escucha en el puerto 3002 del contenedor y se publica en `127.0.0.1:3003` |
| Servicio `db` | Imagen desde `Dockerfile.db` (PostgreSQL 17). Base y usuario `belleza_staging`. Ejecuta `schema.sql` y `seed.sql` al crear el volumen |
| Volumen | `belleza-staging_staging_data`, persistente entre despliegues |
| Healthchecks | `db`: `pg_isready`. `app`: `/health` debe responder con `db: "up"`. La app no arranca hasta que `db` está sana |

Por defecto staging solo es accesible desde el equipo que ejecuta Docker (`STAGING_BIND_ADDRESS=127.0.0.1`). No es una publicación en Internet.

## 1. Requisitos

- Docker Engine o Docker Desktop con contenedores Linux y Docker Compose v2.
- Para ejecutar las pruebas a mano: Python 3 y Google Chrome.

```sh
docker version          # debe mostrar Client y Server
docker compose version
```

## 2. Configuración privada

Copiar la plantilla y definir una contraseña larga y única:

```sh
cp .env.staging.example .env.staging                      # Linux / macOS
Copy-Item .env.staging.example .env.staging               # Windows PowerShell
```

| Variable | Por defecto | Uso |
|---|---|---|
| `STAGING_DB_PASSWORD` | (obligatoria) | Contraseña de PostgreSQL de staging |
| `STAGING_BIND_ADDRESS` | `127.0.0.1` | Interfaz donde se publica la app |
| `STAGING_PORT` | `3003` | Puerto del host |

`.env.staging` está en `.gitignore`: no se sube al repositorio.

## 3. Despliegue manual

```sh
docker compose --env-file .env.staging -f compose.staging.yaml up -d --build --wait --wait-timeout 180
docker compose --env-file .env.staging -f compose.staging.yaml ps
```

Abrir `http://localhost:3003` y `http://localhost:3003/health`. En `/health` se espera `status: ok` y `db: up`.

| Acción | Comando |
|---|---|
| Ver logs | `docker compose --env-file .env.staging -f compose.staging.yaml logs --tail 100 app db` |
| Detener sin perder datos | `docker compose --env-file .env.staging -f compose.staging.yaml stop` |
| Reconstruir tras un cambio de código | repetir el `up -d --build --wait` |

No usar `down -v`, porque elimina el volumen y sus datos. Hay que tomar en cuenta tres cosas:

- `schema.sql` y `seed.sql` solo se ejecutan cuando el volumen está vacío. Un cambio posterior al esquema necesita una migración, porque reconstruir la imagen no lo aplica.
- Cambiar `STAGING_DB_PASSWORD` después del primer arranque no cambia la contraseña que ya guardó PostgreSQL.
- La contraseña de `.env.staging` y la credencial de Jenkins deben ser la misma.

## 4. Ejecutar las 16 pruebas contra staging

```sh
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt          # Windows: .venv\Scripts\python.exe
BASE_URL=http://localhost:3003 HEADLESS=true \
  .venv/bin/python -m pytest -v --junitxml=pytest-results-staging.xml --html=report-staging.html --self-contained-html
```

En PowerShell las variables se definen con `$env:BASE_URL = 'http://localhost:3003'` y `$env:HEADLESS = 'true'`.

Selenium Manager puede necesitar Internet la primera vez para descargar el controlador de Chrome.

## 5. Pipeline de Jenkins

Hay dos pipelines en el repositorio:

| Archivo | Agente | Etapas |
|---|---|---|
| `Jenkinsfile` | Linux (`sh`) | Checkout → Build → Test → Deploy Staging → Verify Staging. Todas se ejecutan siempre |
| `Jenkinsfile.windows` | Windows (`bat`) | Checkout → Build → Test → Deploy Staging (opcional, parámetro `DEPLOY_STAGING`). Prueba contra Render |

El pipeline con el que se trabaja en el Sprint 2 es el `Jenkinsfile` de Linux.

### Configuración del job

1. Crear un job de tipo *Pipeline* con *Pipeline script from SCM*, rama `*/devops-sprint2` y *Script Path* `Jenkinsfile`.
2. Crear la credencial *Secret text* con ID `staging-db-password`, usando la misma contraseña con la que se inicializó la base de staging.
3. El agente necesita `node`/`npm`, `python3` con `venv`, Chrome o Chromium y acceso al motor Docker (`docker compose`).
4. `BASE_URL` apunta a `http://belleza-staging-app-1:3002`, el nombre del contenedor de la app dentro de la red de Docker. Por eso Jenkins debe correr en un contenedor conectado a la red `belleza-staging_default`, o hay que cambiar `BASE_URL` a `http://localhost:3003` si el agente corre directamente en el host.

### Qué hace cada etapa

| Etapa | Acción | Falla si… |
|---|---|---|
| Checkout | `git` de la rama `devops-sprint2` | no se puede clonar |
| Build | `npm ci`, crea `.venv`, `pip install -r requirements.txt`, limpia reportes previos | faltan dependencias |
| Test | `pytest` con las 16 pruebas contra `BASE_URL` | alguna prueba falla |
| Deploy Staging | `docker compose -f compose.staging.yaml up -d --build --wait --wait-timeout 180` | un servicio no queda *healthy* en 180 s |
| Verify Staging | `pytest` otra vez contra staging ya actualizado | alguna prueba falla sobre la versión nueva |
| post (siempre) | publica `pytest-results*.xml` en JUnit y archiva `report*.html` | — |

Además, el pipeline impide ejecuciones concurrentes (`disableConcurrentBuilds`) y corta cualquier build que pase de 20 minutos.

### Puntos a tomar en cuenta

- **La etapa Test prueba la versión anterior.** Corre antes de Deploy Staging contra el mismo `BASE_URL`, así que valida lo que ya estaba desplegado y no el código recién construido. En el primer build, sin staging levantado, falla. **Verify Staging es la verificación real** de la versión nueva.
- **Origen del Checkout.** La etapa Checkout clona `https://github.com/AnEstuardoBarriosg/belleza-conceptual.git`. Ese repositorio debe tener el mismo `devops-sprint2` que este, incluido el commit `d0f59c9` con `compose.staging.yaml`. Si no lo tiene, Deploy Staging no encuentra el archivo.

## 6. Evidencias para la entrega

- Vista de etapas del pipeline con las cinco etapas en verde (ejecución positiva).
- Ejecución negativa en rojo: qué prueba falló y en qué etapa se detuvo.
- Ejecución posterior a la corrección, en verde.
- Reporte `report-staging.html` y la pestaña *Test Result* de Jenkins con 16 pruebas aprobadas.
- `docker compose ps` con `app` y `db` en estado *healthy*.
- `http://localhost:3003` y `http://localhost:3003/health`.

No incluir contraseñas en las capturas.

## Referencias

- https://docs.docker.com/compose/how-tos/startup-order/
- https://docs.docker.com/reference/cli/docker/compose/up/
- https://www.jenkins.io/doc/book/pipeline/jenkinsfile/
