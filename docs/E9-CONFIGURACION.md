# E9 — Configuración y verificación

Fecha de actualización: 29 de octubre de 2026.

Las ramas DEV, QA y main contienen como base el commit `f3768a14fc7345ff0145b0705574308bf6f19110`, que ya incluye el panel administrativo y las cuentas de clientes. Las pruebas y el pipeline se incorporan mediante sus PR. La configuración de protecciones y las revisiones de integrantes continúan pendientes.

## Cambios y orden de integración

| PR | Contenido | Destino |
| --- | --- | --- |
| [#1](https://github.com/haffid/belleza-conceptual/pull/1) | Política, plantilla y evidencias E9. | DEV |
| [#2](https://github.com/haffid/belleza-conceptual/pull/2) | 39 unitarias, dobles y cobertura E10. | DEV |
| [#3](https://github.com/haffid/belleza-conceptual/pull/3) | Pipeline E9/E10 y control del origen de promociones. | test/e10-unitarias |

El PR #3 depende del #2: se revisa e integra primero en la rama de pruebas; después se renueva la revisión del #2 y se integra en DEV. El PR #1 se revisa e integra por separado. La promoción final conserva DEV a QA y QA a main.

## Pipeline validado

El [run 41008858400](https://github.com/haffid/belleza-conceptual/actions/runs/41008858400) del PR #3 terminó en success y registró 39 pruebas aprobadas, cero fallidas y cero omitidas. El check real se llama **E9-E10 / pruebas-unitarias**. El run conserva [los artefactos de prueba y cobertura](https://github.com/haffid/belleza-conceptual/actions/runs/41008858400/artifacts/12956493482).

Los comandos del pipeline son:

```powershell
npm run test:unit
npm run test:unit:check
```

Las unitarias usan únicamente dependencias incluidas en Node; no requieren conectar una base ni instalar las dependencias de ejecución del servidor. El pipeline no despliega esta aplicación. Las demás etapas de E13 se integran posteriormente.

## Protección pendiente de QA y main

La consulta inicial mostró ambas ramas sin protección clásica y una lista vacía de rulesets. Debe configurarlas quien tenga permisos de administración o de edición de reglas:

1. Abrir Settings > Branches y crear una regla para QA y otra para main, o un ruleset activo que incluya ambas.
2. Exigir PR, una aprobación de otro integrante, invalidación de aprobaciones antiguas y conversaciones resueltas.
3. Exigir el check **E9-E10 / pruebas-unitarias**, cuya ejecución ya existe.
4. Exigir rama actualizada y aplicar las restricciones también a administradores.
5. Mantener deshabilitados force push y eliminación.
6. Guardar capturas y verificar las reglas aplicadas.

El archivo de configuración concreto está en el PR #3, `docs/E9-PROTECCION-REQUERIDA.json`. La conexión utilizada para preparar estos cambios no ofrece una operación para modificar protecciones. Un check exitoso por sí solo no configura el bloqueo del merge.

## Demostración pendiente del bloqueo

Con las reglas activas, introducir un fallo explícito en una prueba de un PR controlado hacia QA, conservar la ejecución fallida y la captura que muestre el merge bloqueado. Corregirlo en el mismo PR y renovar check y revisión. Verificar también QA a main; la demostración puede cerrarse sin fusionar.

Se comprobó localmente que una aserción deliberadamente incorrecta devuelve código 1 y, después de restaurarla, las 39 pruebas vuelven a pasar. Esa evidencia local no sustituye la demostración de bloqueo en GitHub.

## Revisión efectiva de los tres PR

Otro integrante debe documentar qué examinó o ejecutó, los casos y riesgos revisados y las correcciones solicitadas. No se completa su revisión en su nombre ni se cuenta una aprobación del autor. Registrar las revisiones y commits reales en `REGISTRO-DE-EVIDENCIAS.md`.

## Referencias

- [Protección de ramas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
- [Ejecución verificada de E9/E10](https://github.com/haffid/belleza-conceptual/actions/runs/41008858400).
