# E10 — Pruebas unitarias

Implementación sobre la aplicación publicada en el commit `f3768a14fc7345ff0145b0705574308bf6f19110`. El código funcional de `server.js`, `db.js`, `index.html` y `store-ui.js` se conserva. Se agregan pruebas, medición y comandos; las mejoras funcionales quedan para una etapa posterior.

## Ejecución

Con Node.js 24:

```powershell
npm run test:unit
npm run test:unit:check
```

Las unitarias utilizan `node:test`, `node:assert/strict` y `mock.fn`, todos incluidos en Node. No necesitan instalar dependencias, abrir un servidor HTTP, ejecutar un navegador ni conectar una base. El comando `npm test` conserva la prueba HTTP de integración que ya existía; no se suma al conteo unitario.

Se aportan **39 pruebas independientes: 25 de backend y persistencia, y 14 de frontend**. Cada caso tiene un ID UT reconocido por el framework. No se cuentan aserciones como si fueran pruebas adicionales.

## Unidades ejecutadas

| Módulo crítico de E2 | Código real ejecutado | Aislamiento |
| --- | --- | --- |
| Catálogo y disponibilidad | Controladores y validación de productos de `server.js`; carga, filtro y presentación del catálogo del script de `index.html`. | Registro de rutas Express simulado, repositorio y DOM simulados. |
| Pedidos y carrito | Controladores de creación, consulta y cambio de estado de `server.js`; carrito, validación y confirmación de `index.html`. | Solicitud/respuesta en memoria, transacción simulada, almacenamiento y fetch simulados. |
| PostgreSQL como dependencia crítica | Adaptador de persistencia de la aplicación en `db.js`. | Pool y cliente PostgreSQL simulados. Se prueban reenvío, COMMIT, ROLLBACK y liberación; no el motor real. |

Los controladores se cargan desde el archivo original con `Module._compile` y se invocan directamente. El frontend se carga desde el script original en un contexto `vm`; el arnés agrega únicamente un acceso de prueba a sus funciones léxicas. No copia ni reescribe sus reglas de negocio y no modifica el HTML. Los dobles del DOM permiten comprobar estado, mensajes y eventos; no sustituyen una prueba de renderizado en un navegador real.

## Dobles de prueba y justificación

| Prueba | Doble | Qué se verifica y por qué se aísla |
| --- | --- | --- |
| UT-BE-07 | `db.query` y `db.transaction` con `mock.fn`. | Ante falta de stock, el controlador rechaza y no inserta el pedido. Se controla la respuesta del repositorio sin PostgreSQL ni datos compartidos. |
| UT-BE-14 | Repositorio que lanza un error deliberado. | El error se propaga sin confirmar ni guardar. Permite provocar el fallo de manera repetible sin interrumpir una base. |
| UT-FE-10 | `fetch` simulado mediante `mock.fn`. | Una consulta fallida deja un mensaje visible. Se comprueba la lógica del catálogo sin red ni backend activo. |
| UT-BE-23 y UT-BE-24 | Pool y cliente PostgreSQL simulados. | Se comprueba ROLLBACK y liberación del cliente ante fallos de la unidad o del COMMIT. No se afirma haber validado el comportamiento del servidor PostgreSQL. |

Cada prueba crea su propio arnés y estado. Ninguna utiliza credenciales del proyecto ni modifica la base desplegada.

## Resultados y cobertura

Los reportes TAP, LCOV, conteos y métricas se generan en `reports/unit/`. El reporte con nombre `raw.lcov` incluye la medición original de V8. `critical.lcov` y `critical-summary.json` conservan únicamente el alcance explicado en `scripts/critical-coverage.cjs`: catálogo, pedidos/carrito y adaptador de persistencia.

Se excluyen el HTML y CSS exteriores al script, líneas vacías y comentarios completos. La instrumentación de un script embebido puede dar cobertura aparente al texto que lo precede; por eso no se utiliza el porcentaje global de `index.html`. El agregado se calcula como líneas cubiertas / líneas consideradas, sin promediar porcentajes de archivos.

`docs/evidence/E10-RESULTADO-LOCAL.json` conserva el resultado local. La ejecución del pipeline incorpora `GITHUB_SHA` a su reporte y publica sus propios artefactos. La evidencia local no se presenta como una ejecución cloud.

El control inicial de esta intervención y su diferencia técnica se explican en `E10-LINEA-BASE.md`. Falta recuperar o acordar la reconstrucción del registro histórico solicitado por el enunciado; no se da por acreditado ese requisito con el control actual.

## Pipeline

El PR de CI agrega `.github/workflows/e9-e10.yml`. Ejecuta la suite y la comparación, conserva sus códigos de salida y publica reportes incluso cuando falle una prueba. Su check se llama `E9-E10 / pruebas-unitarias`. La configuración cubre PR, incluidas las promociones a QA y main. Este pipeline corresponde al alcance E9/E10; el pipeline completo de E13 se integra posteriormente.

## Alcance de las reglas actuales

La aplicación actual rechaza stock insuficiente con 409 y admite `Recibido -> Preparando -> Enviado -> Entregado`; permite cancelar desde los dos primeros estados. Las pruebas siguen ese código, dejando visible su diferencia respecto de algunos casos y estados descritos en Fase 1. No se cambia la regla del negocio durante este trabajo.

Referencias: [Node.js Test Runner](https://nodejs.org/download/release/latest-jod/docs/api/test.html), [cobertura con Node.js](https://nodejs.org/learn/test-runner/collecting-code-coverage).
