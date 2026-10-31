# E9 — Cierre y evidencias pendientes

Revisión inicial: 29 de octubre de 2026. Las ramas DEV, QA y main existen y parten del commit `f3768a14fc7345ff0145b0705574308bf6f19110`. El PR de política de ramas es https://github.com/haffid/belleza-conceptual/pull/1 . En la consulta inicial no tenía revisiones de integrantes.

Las respuestas de GitHub para QA y main indicaron `protected: false` y checks clásicos desactivados. La consulta de rulesets del repositorio devolvió una lista vacía. La existencia de las ramas y de esta guía no acredita el bloqueo del merge.

## Cambios para revisar

1. PR existente de política, guía y plantilla E9.
2. PR de pruebas E10: https://github.com/haffid/belleza-conceptual/pull/2 — 25 backend y 14 frontend, arneses y medición.
3. PR de CI E9/E10: ejecución automática, artefactos y comprobación del origen de las promociones.

El PR de CI se prepara sobre la rama de pruebas para que pueda ejecutar la suite sin copiar sus cambios. Se integra primero en esa rama, luego se vuelve a revisar el PR de pruebas hacia DEV. La política se integra en DEV mediante su propio PR. Las promociones posteriores son DEV a QA y QA a main.

Cada uno de los tres PR requiere revisión real desde la cuenta de otro integrante. La revisión debe indicar qué se ejecutó o inspeccionó y qué riesgos o casos se verificaron. No se redactan aprobaciones ni se actúa desde la cuenta de un compañero.

## Configuración requerida en QA y main

La activación y verificación pueden realizarse con `node scripts/configure-e9-protection.cjs --apply`, desde una cuenta con administración y GitHub CLI autenticado. El modo `--dry-run` solo muestra la configuración; `--verify` consulta el estado. El procedimiento y la demostración pendiente están en [E9-ACTIVACION-Y-DEMOSTRACION.md](E9-ACTIVACION-Y-DEMOSTRACION.md). La verificación del 30 de octubre confirmó que la cuenta conectada solo tiene `write`; el registro está en `evidence/E9-VERIFICACION-PERMISOS.json`.

El responsable con permiso para editar reglas configura ambas ramas desde Settings > Branches o un ruleset activo. El archivo `E9-PROTECCION-REQUERIDA.json` contiene el ajuste concreto que debe reflejar la configuración:

- PR obligatorio y una aprobación de otro integrante.
- Invalidar aprobaciones antiguas tras cambios y exigir aprobación del último aporte.
- Resolver conversaciones pendientes.
- Check obligatorio `E9-E10 / pruebas-unitarias`, después de confirmar su nombre en la primera ejecución.
- Exigir rama actualizada, aplicar a administradores y no permitir force push ni eliminación.

La conexión utilizada para preparar los PR no ofrece una operación para modificar protecciones. Este ajuste se realiza por el administrador y se verifica después mediante GitHub. El check técnico no sustituye la protección de la rama.

## Demostración del bloqueo

Con las reglas activas, abrir un PR controlado de DEV a QA, introducir un fallo explícito en una prueba y conservar el run fallido y el bloqueo mostrado por GitHub. Corregirlo en el mismo PR y obtener nuevamente revisión y check aprobado. Verificar también QA a main; el PR de demostración a main puede cerrarse sin integrar. No desactivar reglas ni ignorar el código de salida para superar la demostración.

El archivo `scripts/check-promotion.cjs` comprueba los orígenes de promoción. Un PR hacia QA con origen distinto de DEV falla; hacia main se exige QA. No configura permisos ni sustituye la aprobación.

## Mejoras posteriores

Al terminar E9 y E10 se revisan las mejoras de aplicación que el equipo priorice. Este trabajo conserva sus funciones actuales y no incorpora cambios funcionales al panel, las cuentas o las reglas de pedidos.

Referencia: [protección de ramas de GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
