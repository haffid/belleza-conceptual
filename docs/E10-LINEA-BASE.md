# E10 — Línea base y comparación

Fecha de preparación: 29 de octubre de 2026. Código de aplicación de referencia: `f3768a14fc7345ff0145b0705574308bf6f19110`.

## Registro histórico solicitado

El PDF de Fase 1 no contiene un reporte de cobertura unitaria inicial; la sección 2.4 de ese documento describe tecnologías. La cifra de 25 % corresponde a ejecución de casos funcionales. El registro original mencionado en el enunciado debe recuperarse o su reconstrucción debe acordarse con el catedrático. Un campo ausente no se registra como cero.

Por ese motivo, **el incremento contra la línea base histórica queda pendiente de acreditar**. Los resultados siguientes son un control reproducible de esta intervención y no se presentan como mediciones realizadas en septiembre.

## Control inicial de esta intervención

Antes de ejecutar los 39 casos nuevos se mide un control que carga e inicializa los módulos con el mismo arnés. Este control tiene una prueba de inicialización, no pruebas de negocio, y no se suma a las 39 unitarias aportadas. La carga inicial del frontend sí ejecuta su arranque con una respuesta vacía simulada; esa cobertura se conserva. `db.js` no se carga en ese control y sus líneas se incorporan explícitamente como no ejecutadas dentro del alcance declarado.

```powershell
npm run test:unit:baseline
npm run test:unit
npm run test:unit:check
```

`docs/evidence/E10-CONTROL-INICIAL.json` conserva el control medido y los hashes SHA-256 de los archivos originales. El último comando lo compara con el resultado de la suite. No reemplaza el control automáticamente ni convierte esta evidencia en una línea base histórica.

| Alcance | Control inicial de intervención | Suite nueva | Diferencia técnica |
| --- | ---: | ---: | ---: |
| Catálogo | 35/106 = 33.02 % | 86/106 = 81.13 % | +48.11 puntos |
| Pedidos y carrito | 20/184 = 10.87 % | 173/184 = 94.02 % | +83.15 puntos |
| Persistencia de la aplicación | 0/51 = 0.00 % | 42/51 = 82.35 % | +82.35 puntos |
| Agregado del alcance crítico | 55/341 = 16.13 % | 301/341 = 88.27 % | +72.14 puntos |

La métrica es cobertura de líneas no vacías del alcance crítico con conteos V8/LCOV, excluyendo comentarios completos y el HTML exterior al script. La selección de líneas es idéntica antes y después; no se extrajeron funciones a un archivo nuevo para modificar el denominador. Se conservan los reportes nativos y el alcance de cada módulo para que el cálculo sea verificable.

## Para cerrar el requisito histórico

Recuperar el documento o reporte original de la sección 2.4, su fecha, commit, herramienta, métrica y alcance. Verificar la equivalencia de los módulos antes de comparar. Si no existe, registrar el criterio acordado con el catedrático y su evidencia. Hasta entonces, `historical_baseline_confirmed` permanece en `false` en los reportes.
