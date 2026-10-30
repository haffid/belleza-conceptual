# Registro de evidencias — E9 y E10

Estado documentado: 29 de octubre de 2026.

| Requisito | Evidencia | Estado |
| --- | --- | --- |
| Ramas DEV, QA y main | Base de aplicación `f3768a14fc7345ff0145b0705574308bf6f19110`. | Existen. |
| Política y control de cambios | [PR #1](https://github.com/haffid/belleza-conceptual/pull/1). | Preparado; revisión e integración pendientes. |
| Segundo PR real | [PR #2](https://github.com/haffid/belleza-conceptual/pull/2): unitarias. | Abierto; revisión pendiente. |
| Tercer PR real | [PR #3](https://github.com/haffid/belleza-conceptual/pull/3): CI. | Abierto; revisión pendiente. |
| Tres revisiones de otro integrante | Registrar autores, revisores, observaciones y SHA. | Pendiente. |
| Protecciones QA/main y bloqueo ante fallo | Guía y configuración concreta en PR #3. | Pendiente de configuración y demostración en GitHub. |
| Mínimo 30 unitarias | 25 backend/persistencia y 14 frontend. | 39 implementadas y aprobadas. |
| Tres pruebas con dobles justificados | UT-BE-07, UT-BE-14 y UT-FE-10; adaptador también usa dobles. | Implementado y documentado en PR #2. |
| Ejecución real en pipeline | [Run 41008858400](https://github.com/haffid/belleza-conceptual/actions/runs/41008858400), SHA `4f0f8ea2f8fc83fb1bee2afd597a703327d37de6`. | Success: 39 aprobadas, cero fallidas/omitidas. |
| Reportes de cobertura y pruebas | [Artefacto e10-41008858400-1](https://github.com/haffid/belleza-conceptual/actions/runs/41008858400/artifacts/12956493482). | Publicado. |
| Cobertura del alcance crítico | 301/341 líneas, 88.27 %. | Medición técnica verificada localmente y en CI. |
| Incremento contra la línea base histórica de 2.4 | Recuperar el registro original o el criterio autorizado de reconstrucción. | Pendiente de acreditar. El control de intervención no lo sustituye. |

## Alcance y fecha de las métricas

El control inicial de esta intervención obtuvo 55/341 líneas (16.13 %) y la suite nueva obtuvo 301/341 (88.27 %). La diferencia técnica es +72.14 puntos; no se presenta como un incremento demostrado contra un reporte histórico de Fase 1. El cálculo, los rangos y las exclusiones están documentados en el PR #2.

La evidencia de CI corresponde al PR #3 y a su SHA indicado. Después de integrarlo en la rama de pruebas, se conserva la nueva ejecución del PR #2 antes de promover a DEV, QA y main. No se presenta un resultado de un commit anterior como evidencia de un cambio posterior.
