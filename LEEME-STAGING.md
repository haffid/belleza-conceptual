# Staging de Belleza Conceptual con Docker

Preparado desde `devops-sprint2`, commit `c37b978a2d8a69660dd0e49174bf5e5298aa3918`.
Este paquete contiene una copia de la aplicación y los archivos nuevos de staging.
No se han enviado cambios a GitHub. El Jenkinsfile incluye una etapa opcional Deploy Staging.

## Qué crea

- Aplicación Node.js en http://localhost:3003.
- PostgreSQL 17 exclusivo de staging, con tablas y catálogo inicial del repositorio.
- Volumen persistente `belleza-staging_staging_data`.
- Verificación de PostgreSQL y de `/health` antes de dar por terminado el despliegue.

Por defecto solo es accesible desde la computadora que ejecuta Docker. Esto es
staging local: no constituye una publicación accesible por Internet.

## 1. Preparar Docker

Abrir Docker Desktop y esperar hasta que el motor esté listo. En Windows debe
usar contenedores Linux. Comprobar en la terminal:

```sh
docker version
docker compose version
```

`docker version` debe mostrar Client y Server. Un error de conexión al daemon
significa que todavía no se pueden crear los contenedores.

## 2. Crear la configuración privada

Abrir una terminal dentro de esta carpeta descomprimida. Copiar
`.env.staging.example` como `.env.staging`:

Windows (PowerShell):

```powershell
Copy-Item .env.staging.example .env.staging
notepad .env.staging
```

macOS o Linux:

```sh
cp .env.staging.example .env.staging
```

Editar el archivo y reemplazar el texto de STAGING_DB_PASSWORD por una clave larga
y única, preferentemente letras y números. Guardar. No subir este archivo a GitHub.

## 3. Iniciar staging

```sh
docker compose --env-file .env.staging -f compose.staging.yaml up -d --build --wait --wait-timeout 180
docker compose --env-file .env.staging -f compose.staging.yaml ps
```

La primera ejecución descarga imágenes y puede tardar varios minutos.
Abrir http://localhost:3003 y http://localhost:3003/health.
En health se espera `status: ok` y `db: up`. En la aplicación debe aparecer el catálogo.

Para ver errores:

```sh
docker compose --env-file .env.staging -f compose.staging.yaml logs --tail 100 app db
```

Para detener sin borrar los datos:

```sh
docker compose --env-file .env.staging -f compose.staging.yaml stop
```

No usar `down -v` para reiniciar: elimina el volumen y sus datos.
Los SQL de inicialización solo se ejecutan con un volumen vacío. Cambiar la clave
en el archivo después del primer arranque no cambia la contraseña almacenada en
PostgreSQL; coordinar esa modificación por separado. Cambios posteriores al esquema
necesitan migraciones, no se aplican por reconstruir la imagen.

## 4. Integración en devops-sprint2

Los archivos de Docker ya están integrados en esta copia de la rama devops-sprint2.
El Jenkinsfile conserva Checkout, Build y Test y agrega Deploy Staging como etapa
opcional. No se han enviado estos cambios a GitHub.

## 5. Conectar Jenkins (Windows)

El Jenkinsfile usa bat y requiere un agente Windows. Para activar el despliegue:

1. Confirmar que el agente tiene acceso al motor Docker del equipo elegido para
   staging, con contenedores Linux y Docker Compose instalado.
2. Configurar el job para obtener */devops-sprint2. Usar un solo job para staging.
3. Crear una credencial Jenkins de tipo Secret text, ID staging-db-password, con
   la misma contraseña usada al inicializar la base de staging.
4. Ejecutar el pipeline para cargar sus parámetros; Deploy Staging se omite por defecto.
5. En Construir con parámetros, marcar DEPLOY_STAGING y ejecutar.

El pipeline impide ejecuciones concurrentes del mismo job. El despliegue espera
que ambos servicios estén saludables y falla si no lo consigue en 180 segundos.
Se despliega en el motor Docker del agente; no configura un servidor remoto.
Si Jenkins está en un contenedor o en otro equipo, primero hay que configurar
el acceso del agente al host de staging.

Las pruebas existentes siguen apuntando a Render. Su éxito no valida el código
recién construido. Para probar staging, usar la sección siguiente después de
levantarlo. Una puerta de calidad previa al despliegue necesita un ambiente temporal
adicional donde probar el nuevo código antes de promoverlo.

## 6. Ejecutar las 16 pruebas contra staging (Windows)

En el equipo que ejecuta staging, con Python y Chrome disponibles:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:BASE_URL = 'http://localhost:3003'
$env:HEADLESS = 'true'
.\.venv\Scripts\python.exe -m pytest -v --junitxml=pytest-results-staging.xml --html=report-staging.html --self-contained-html
```

Selenium puede necesitar Internet para obtener el controlador de Chrome.
Estas órdenes todavía deben ejecutarse en el equipo de staging: no hay un resultado
de 16 pruebas aprobadas para este ambiente hasta disponer del reporte.

## Evidencias para entregar

Capturar la aplicación en localhost:3003, la respuesta de /health, los dos servicios
healthy y, cuando esté integrado, la ejecución de Jenkins con Deploy Staging en verde.
No incluir contraseñas en las capturas.

## Referencias

- https://docs.docker.com/compose/how-tos/startup-order/
- https://docs.docker.com/reference/cli/docker/compose/up/
