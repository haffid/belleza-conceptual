# E12 Análisis estático de código

Proyecto SonarCloud: `haffid_belleza-conceptual`, organización `haffid`.

Panel: https://sonarcloud.io/dashboard?id=haffid_belleza-conceptual

PR de remediación: https://github.com/haffid/belleza-conceptual/pull/5 . La rama parte de E11 y conserva DEV como destino. Es acumulativa respecto al PR 4; coordinar su revisión e integración sin sustituir los aportes de compañeros ni promover cambios sin aprobar.

## Estado inicial real

El snapshot de main corresponde al análisis `42c4950f-0b87-49cb-b541-27f4761b25f0`, revisión `f3768a14fc7345ff0145b0705574308bf6f19110`, realizado el 8 de octubre de 2026. Los JSON originales se conservan en `docs/evidence/E12/inicial-main/`.

| Métrica de todo main | Valor inicial |
| --- | ---: |
| Bugs | 9 |
| Vulnerabilidades | 1 |
| Code smells | 41 |
| Duplicación de líneas | 0.0 % |
| Deuda técnica estimada por Sonar | 311 minutos |
| Blocker | 1 |
| Critical | 0 |
| Líneas de código | 1149 |
| Quality gate | ERROR |

El gate falla por la clasificación de seguridad del código nuevo: valor 5, equivalente a E, frente a A requerido. Deuda técnica es una estimación de la herramienta; no representa horas reales dedicadas por el equipo.

El PR 4 contiene un estado inicial distinto: sobre código nuevo frente a DEV, hay 1 bug Critical, 2 vulnerabilidades Major, 1 code smell, 0 % de duplicación y 5 minutos de deuda nueva. Ese snapshot está en `inicial-pr4/`. No sumar ni intercambiar métricas de main y de un PR.

## Remediación de prioridades

### DOM XSS Blocker

- Regla: `jssecurity:S5696`.
- ID inicial: `AaEeNjwUthfJMXOdZZ7E`.
- Archivo y línea inicial: `store-ui.js:68`.
- Causa: datos de respuestas de API se interpolaban en el HTML de los contadores del panel.
- Corrección: crear los nodos de cada tarjeta y asignar sus valores mediante `textContent`; reemplazar los hijos sin interpretar los datos como HTML.
- Evidencia funcional: tres unitarias de regresión verifican conteos, actualización y que una cadena con una etiqueta maliciosa quede como texto inerte.
- No se desactivó la regla ni se marcó como falso positivo.

### Throw en finally Critical

- Regla: `javascript:S1143`.
- Archivo y línea inicial: `scripts/run-api-tests.cjs:67`, PR 4.
- Causa: lanzar desde finally podía ocultar el fallo original de Newman.
- Corrección: retener el primer error, capturar por separado fallos al cerrar servidor, cerrar base o retirar datos temporales y propagar el error fuera de finally. La validación de ruta queda en un helper que rechaza ubicaciones ajenas.
- Evidencia: tres regresiones del helper y el flujo de API completo continúan aprobados. La comparación de Sonar debe confirmar ausencia de la regla en la versión corregida.

El último reanálisis automático del PR 5 sobre el commit a5b9c69deae9fbb9e4473f5a63a1a9c78aa71e89 aprobó el quality gate Sonar way: cero bugs, vulnerabilidades, Blocker y Critical nuevos; un code smell y cinco minutos de deuda nueva. Esto no actualiza las métricas generales de main. Después de desactivar Automatic Analysis, la ejecución CI 41157859636, intento 2, terminó aprobada sobre ca469c4f6cd042f11494678551b4288c08992fc6. El gate evaluó 87.0 % de cobertura de código nuevo frente al 80 % requerido, con clasificaciones A y sin Blocker ni Critical nuevos. Se conservan LCOV y metadatos de scanner en el artefacto 13025528476.

También se sustituyó la referencia interna a `tools/api/node_modules/newman` por resolución pública con `createRequire`, y las instalaciones de CI usan `--ignore-scripts`. better-sqlite3 13 incluye binarios, por lo que no necesita un instalador adicional para estas ejecuciones. Se corrigió un intento inicial de usar prebuild-install, inexistente en esa versión; no se presenta ese run fallido como aprobación.

## Integración con el pipeline

El workflow `.github/workflows/e12-sonar.yml` se ejecuta en PR y en push a main. Ejecuta regresiones, genera LCOV, verifica la presencia de SONAR_TOKEN y ejecuta SonarScanner mediante una acción oficial fijada al SHA de v8.4.0. `sonar.qualitygate.wait=true` hace que el job espere el gate y falle si SonarCloud lo rechaza.

El job se llama `E12 / sonar-quality-gate`. Exporta métricas y hallazgos del mismo alcance y conserva reportes con `if: always()`. No utiliza `continue-on-error`, no reduce umbrales y no omite el análisis cuando faltan credenciales.

Configuración del propietario:

1. Crear token de análisis en SonarCloud y guardarlo como secreto GitHub Actions `SONAR_TOKEN`; nunca incluirlo en código ni documentos.
2. Desactivar Automatic Analysis en el proyecto cuando esté listo el workflow CI. Los métodos automático y por scanner no pueden coexistir; el primer intento de CI registró explícitamente ese conflicto.
3. Ejecutar nuevamente el workflow y conservar el run y el ID de análisis generado.
4. Configurar `E12 / sonar-quality-gate` como check obligatorio de QA y main. Un YAML no activa por sí mismo la protección de ramas.

La cobertura LCOV adjunta combina siete regresiones de seguridad y una ejecución HTTP completa de E11; no representa la cobertura de toda la aplicación ni reemplaza la referencia histórica de E10. Debe integrarse la suite del PR 2 y medir de nuevo antes de atribuir una cobertura global.

## Comparación y criterio de cierre

Una corrección en PR no cambia las métricas de main antes del merge. Para una comparación de todo el código, capturar las métricas de la rama corregida tras un análisis CI válido, indicar su SHA y conservar el mismo alcance de fuentes. Comparar por separado el código nuevo del PR 4 y del PR 5, ambos frente a DEV. Ausencia de una métrica significa no disponible; no significa cero.

Comandos reproducibles:

```text
node scripts/sonar-snapshot.cjs --output reports/sonar-main
node scripts/sonar-snapshot.cjs --output reports/sonar-pr4 --pull-request 4
node scripts/sonar-snapshot.cjs --output reports/sonar-pr5 --pull-request 5
node scripts/sonar-snapshot.cjs --output reports/sonar-rama --branch codex/e12-sonar
```

La deuda y los conteos antes/después deben leerse de los JSON de Sonar, sin estimarlos a partir del número de cambios. Conservar el análisis fallido inicial, el análisis corregido, las capturas y el resultado del gate.

## Plan si el gate no aprueba

| Pendiente | Justificación técnica | Acción y verificación |
| --- | --- | --- |
| Conflicto entre métodos | Sonar rechaza scanner mientras Automatic Analysis está activo. | Propietario selecciona análisis CI y repite; conservar ejecución aceptada. |
| Blocker o Critical nuevo | Tienen prioridad sobre mantenimiento; una regresión funcional no sustituye el reanálisis. | Corregir causa y agregar regresión; comprobar cero hallazgos de esas severidades en el alcance analizado. |
| Cobertura insuficiente | Las regresiones de E12 son parciales; no se debe excluir código real para aprobar. | Integrar las unitarias de E10 y medir el conjunto con LCOV válido. |
| Bugs y code smells restantes | El estado inicial tiene nueve bugs y 41 smells; no todos son Blocker/Critical. | Priorizar errores funcionales y accesibilidad; resolver por PR y comparar métricas sin rebajar el gate. |
| Dependencias con avisos | npm audit y Sonar analizan aspectos distintos. | Mantener el registro de dependencias y planificar su actualización y pruebas; no confundir cero hallazgos Sonar con cero vulnerabilidades de paquetes. |

La ejecución completa de una rama no principal recibió del servidor el error "Organization is not allowed to access data from non main branches" (run 41157855509). No se ocultó ese fallo ni se adquirió un plan de pago. Por esa limitación, se analiza cada PR y main; los tests de E9/E10/E11 conservan sus propios disparadores. Para obtener métricas generales posteriores, integrar la corrección mediante las revisiones y promociones acordadas y analizar main, o habilitar análisis de ramas mediante un plan que lo permita. No comparar métricas generales de main con métricas nuevas del PR como si fueran equivalentes.

La aprobación se acredita únicamente con el gate real de Sonar y el job correspondiente, ligados al commit evaluado. Si permanece fallido, adjuntar condiciones fallidas, responsables del equipo y próximo criterio verificable de cierre; no declarar E12 totalmente cerrado.

Referencias oficiales: https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/overview-of-integrated-cis y https://github.com/SonarSource/sonarqube-scan-action .
