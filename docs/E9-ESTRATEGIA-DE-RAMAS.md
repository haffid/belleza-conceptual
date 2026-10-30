# E9 — Estrategia de ramas y control de cambios

En este documento propongo la estrategia de ramas que utilizaremos en Belleza Conceptual para el entregable E9. La propuesta queda sujeta a la revisión del equipo. La configuración de las protecciones y las evidencias de su funcionamiento se completarán durante la implementación.

## Organización

Para organizar el trabajo, utilizaremos tres ramas permanentes:

| Rama | Propósito | Origen habitual de los cambios |
| --- | --- | --- |
| `DEV` | Integración del desarrollo y de las pruebas nuevas. | Ramas de trabajo mediante PR. |
| `QA` | Versión candidata a validación. | `DEV` mediante PR. |
| `main` | Versión aprobada para producción. | `QA` mediante PR. |

Los nombres distinguen mayúsculas y minúsculas. Estas ramas organizan versiones del código; los despliegues se vinculan a ellas mediante la configuración del pipeline y de cada ambiente.

## Desarrollo

Prepararemos cada cambio en una rama corta, como `docs/e9-estrategia-ramas`, `test/e10-unitarias` o `ci/e9-e10`. La rama partirá de `DEV`. En el PR explicaremos qué problema resolvemos, qué archivos cambiamos y cómo lo validamos. Cada autor atenderá las observaciones antes de integrar su cambio.

Mantendremos el historial del proyecto para identificar los aportes de cada integrante. Si un cambio incluye trabajo previo de otro compañero, indicaremos su procedencia.

## Promoción

1. **Rama de trabajo a DEV:** el cambio tiene alcance definido, una revisión de otro integrante y las comprobaciones disponibles aprobadas. Para pruebas nuevas, se adjunta su ejecución.
2. **DEV a QA:** el PR identifica los cambios incluidos, aporta el resultado del pipeline correspondiente a su último commit y recibe aprobación de otro integrante. QA se valida antes de promoverla a producción.
3. **QA a main:** el PR enlaza las evidencias de QA, tiene el pipeline aprobado y recibe aprobación. Tras el merge se identifica el commit aprobado y, cuando corresponda, su versión o etiqueta.

Para conservar la trazabilidad entre las ramas permanentes, realizaremos las promociones mediante commits de merge. Resolveremos los conflictos en la rama del PR y volveremos a validar el resultado antes de la aprobación final.

Durante la revisión también comprobaremos que la promoción provenga de la rama correspondiente. La protección mediante aprobaciones y checks no restringe por sí sola la rama de origen del PR.

## Protección de QA y main

Configuraremos ambas ramas para exigir PR, al menos una aprobación de otro integrante y los resultados obligatorios del pipeline. Aplicaremos estas reglas también a administradores y mantendremos deshabilitados los force pushes y la eliminación de estas ramas.

El control obligatorio corresponderá a una ejecución real del pipeline sobre el último commit del PR. Si modificamos el código después de la revisión, ejecutaremos nuevamente la validación y renovaremos la revisión cuando corresponda. Resolveremos las observaciones pendientes antes del merge.

Si el pipeline falla, corregiremos el cambio en la rama del PR y volveremos a ejecutarlo. Mantendremos el resultado de error hasta resolver su causa, sin ignorar el código de salida ni omitir las pruebas obligatorias.

## Revisiones efectivas

Presentaremos al menos tres PR con aportes reales y revisión de otro integrante. En cada revisión dejaremos constancia de lo que se comprobó, los riesgos o defectos evaluados y los ajustes solicitados, si los hubo. Podremos aprobar un cambio sin pedir correcciones cuando la revisión explique la validación realizada. El autor del PR no será quien lo apruebe.

Distribución propuesta de trabajo:

| Cambio | Contenido | Revisión esperada |
| --- | --- | --- |
| Documentación y control de cambios (PR #1) | Política, plantilla, guía y registro de evidencias. | Consistencia del flujo y requisitos de bloqueo. |
| Pruebas unitarias (PR #2) | 25 pruebas de backend/persistencia y 14 de frontend. | Aislamiento, casos límite, reglas y alcance de cobertura. |
| Pipeline E9/E10 (PR #3) | Ejecución automática, artefactos y origen de promociones. | Propagación de fallos y check que se exigirá en QA/main. |

Esta distribución nos servirá para organizar los aportes. Registraremos los PR y sus revisiones conforme los completemos. Las promociones entre ambientes podrán generar PR adicionales.

## Correcciones urgentes

Si necesitamos una corrección urgente, crearemos una rama `hotfix/descripcion` desde `main` y la integraremos mediante PR en DEV. Conservaremos la revisión y el pipeline obligatorio y promoveremos la corrección por DEV a QA y de QA a main. Este recorrido evita una excepción que contradiga el control de origen de las promociones.

## Evidencia

Conservaremos los enlaces de los PR, sus autores y revisores, los commits revisados y las ejecuciones del pipeline. También guardaremos las capturas de la configuración y del merge bloqueado para demostrar que los controles funcionan.

