# E13 Pipeline de integración y despliegue continuo

El workflow `e13-cicd.yml` ejecuta en orden: compilación esbuild, pruebas unitarias, análisis SonarCloud con `sonar.qualitygate.wait=true` y API mediante Newman contra `dist`. El job de despliegue depende del éxito del job de validación y solo se ejecuta tras un push a `main`. Si cualquier validación falla, no se despliega; los reportes se conservan con `if: always()`.

La aplicación es JavaScript interpretado. La compilación transpila el backend a Node.js 22, transforma y minimiza JavaScript del navegador y CSS y produce nueve archivos de aplicación y un manifiesto de revisión en `dist/`. No se describe como compilación de TypeScript ni se confunde un simple chequeo de sintaxis con generar un artefacto.

Las 39 unitarias originales y sus arneses provienen del PR #2, SHA 871b5d9. El control y sus nueve pruebas provienen del PR #3, SHA 340d4a4. Las siete regresiones de seguridad y la colección API proceden del PR #5, SHA 6a59a31. Se agregan 17 pruebas de compilación, despliegue y herramientas del pipeline: 72 casos distintos en la ejecución conjunta. Las 39 se ejecutan también por el comando E10 para conservar su reporte compatible; no se cuentan dos veces.

Los workflows separados de E9/E10, E11 y E12 se sustituyen en esta rama por E13 para conservar un solo orden y evitar análisis de Sonar simultáneos con coberturas diferentes. Las pruebas y herramientas anteriores siguen disponibles. Tras integrar, el check que se debe exigir en QA/main es `E13 / compilacion-pruebas-gate-api-despliegue`.

## Ambientes

| Rama | GitHub Environment | Despliegue |
| --- | --- | --- |
| DEV | Ninguno | Solo validación; no despliega |
| QA | Ninguno | Solo validación; no despliega |
| main | production | Hook y URL del servicio de producción |
| PR | Ninguno | Solo validación; no despliega |

Solo los push a `main` publican al único servicio existente en Render. Una ejecución manual valida sin desplegar. No se requieren servicios ni ambientes `dev` o `qa`. El workflow no crea servicios ni bases de datos. `SONAR_TOKEN` debe estar disponible como secreto del repositorio; el hook y la URL de Render se configuran en el ambiente `production`.

## Configurar el servicio existente de Render

1. Integrar por el recorrido de ramas acordado después de revisión. No saltar un check fallido.
2. En Render, abrir el Web Service existente de la tienda, Settings. Configurar Build Command: `npm ci --ignore-scripts && npm run build`. Start Command: `npm run start:production`. Runtime Node.js 24 o superior compatible. Health Check Path: `/health`.
3. Desactivar Auto-Deploy (`Off`) para que un push no despliegue antes de terminar E13. El workflow será quien active el despliegue después de API. Esto no desactiva análisis ni protecciones de seguridad.
4. Conservar la configuración real de base de datos y fotografías. La instancia observada usa SQLite y catálogo vacío; un disco efímero no garantiza persistencia tras redeploy. Para la tienda real utilizar PostgreSQL y almacenamiento persistente para fotografías, según la guía del proyecto.
5. En GitHub, Settings > Environments, crear `production` para el servicio existente. En Environment secrets agregar `RENDER_DEPLOY_HOOK_URL` con el Deploy Hook de ese servicio. Nunca guardar el hook en el repositorio o el chat.
6. En Environment variables agregar `APP_BASE_URL=https://belleza-conceptual.onrender.com`. `SONAR_TOKEN` permanece como secreto de repositorio y Automatic Analysis debe seguir desactivado.
7. No crear servicios ni ambientes adicionales: `DEV`, `QA` y los PR ejecutan validaciones sin desplegar. Promover los cambios por `DEV` → `QA` → `main` según el control de promoción existente.
8. Tras un push autorizado, conservar el run completo y `reports/deploy/deployment.json`. El helper envía a Render el SHA validado mediante `ref` y solo aprueba cuando `/health` responde sano con exactamente esa revisión.

Hasta configurar los secretos/servicios y conservar un despliegue real, la etapa de despliegue permanece pendiente. No sustituir esa evidencia por pruebas con mocks ni por el hecho de que una versión anterior ya exista en Render.

## Pruebas de los controles

Los dobles del compilador comprueban el artefacto y la propagación del fallo. Los dobles HTTP comprueban hook válido, rechazo de fallos, timeout, reinicios y rechazo de health de un commit anterior. Estos casos no envían hooks ni despliegan servicios reales.

## Resultado observado en GitHub

PR #6, revisión daa3075755a7071befa1424216391ef35cc7af05, run 41163026006: compilación, 72 casos distintos, SonarCloud y Newman aprobados; despliegue omitido por tratarse de un PR. Newman ejecutó 35 solicitudes y 105 aserciones contra el artefacto compilado. SonarCloud reportó gate OK y 85.6 % de cobertura de código nuevo. No hubo Blocker, Critical ni vulnerabilidades abiertas en ese alcance; permanecen tres code smells y 15 minutos de deuda estimada.

El run anterior 41162729087 falló correctamente en el gate y omitió API/despliegue. La corrección fijó la ruta del ejecutable de GitHub CLI, clasificó los archivos de pruebas y amplió las pruebas de las herramientas, sin reducir el umbral de 80 %. Se conservan ambos estados. El despliegue real continúa pendiente de configurar los ambientes y secretos indicados arriba.

Referencias: https://esbuild.github.io/api/#transform ; https://render.com/docs/deploy-hooks ; https://render.com/docs/deploys .

## Alcance compatible con el plan de SonarCloud

Las promociones a DEV y QA se validan en sus Pull Requests; el workflow se ejecuta en todos los PR y en push a main. El plan actual permite consultar el quality gate de main y de los PR, pero rechazó la consulta de DEV como rama independiente en el run 41167691176. Se retiraron los triggers de push a DEV y QA para no ejecutar análisis de ramas que el plan no permite consultar. No se omite el scanner ni se desactiva la espera del gate en ninguna ejecución de promoción o despliegue.

Una ejecución manual debe seleccionarse sobre main. Las protecciones QA/main exigen el check completo del PR antes del merge. El run fallido original se conserva como evidencia del límite observado y de la propagación del error.
