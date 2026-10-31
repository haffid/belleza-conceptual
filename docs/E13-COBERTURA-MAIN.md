# Corrección del quality gate de main

La ejecución de producción [41172084409](https://github.com/haffid/belleza-conceptual/actions/runs/41172084409), posterior al merge del PR #10 (commit `f87a1c1`), detuvo correctamente el despliegue: Sonar midió 71.5 % de cobertura en código nuevo frente al mínimo de 80 %. Los PR previos mostraban 85.6 % sobre un conjunto de código nuevo diferente. No son porcentajes directamente intercambiables.

La corrección conserva el umbral del gate, la definición de código nuevo y el alcance de análisis. Añade 29 pruebas unitarias aisladas, para un total de 101 casos en `test:ci`:

- 18 casos del controlador de cuenta y administración: autenticación, permisos visibles, perfil, filtros, edición, fotografías, ajustes de inventario y estados de pedidos.
- 11 casos de creación de administradores, datos de demostración y migración SQLite → PostgreSQL: validaciones, consultas parametrizadas, catálogo/destino no vacíos, exclusión de sesiones y liberación de recursos ante errores.

Los dobles de DOM y `fetch` permiten comprobar el comportamiento del controlador sin navegador, servidor ni escrituras de inventario. Los dobles de base de datos aíslan las herramientas de datos para no crear cuentas ni migrar información real. El doble de hash verifica que se delegue el cifrado y que la contraseña original no se envíe a la consulta de inserción. Ninguna prueba carga `.env` ni usa secretos.

Se incorporan `manage.js` y `migrate-postgres.js` al informe LCOV que recibe Sonar; ya estaban dentro del código analizado, pero no tenían cobertura registrada. No se excluyen módulos para subir el porcentaje.

Verificación local con Node 24: **101/101 casos**, sin fallos; cobertura de líneas del controlador `store-ui.js`, `manage.js` y `migrate-postgres.js`: **100 %**. El porcentaje agregado de Node (92.30 %) corresponde a los archivos instrumentados y no sustituye la medición de Sonar ni demuestra por sí solo la aprobación del gate de main. El resultado definitivo debe comprobarse en el pipeline posterior a las promociones revisadas DEV → QA → main.
