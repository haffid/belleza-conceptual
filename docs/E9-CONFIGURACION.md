# E9 — Configuración y verificación

En esta guía describo los pasos que seguiremos para configurar el control de cambios y reunir las evidencias de E9. Las ramas DEV y QA ya están creadas; quedan pendientes las protecciones y su conexión con el pipeline.

## Preparación

La configuración de las protecciones la realizará quien tenga permisos de administración del repositorio o el permiso para editar sus reglas. Antes de aplicarlas, revisaremos los despliegues automáticos existentes para identificar qué ocurre al fusionar hacia main.

Integraremos la versión actualizada del proyecto mediante PR hacia DEV y comprobaremos que se pueda ejecutar antes de promoverla a QA y main. Hasta entonces, las ramas conservan como punto de partida la versión disponible en el repositorio.

## Punto de partida de las ramas

Creé `DEV` y `QA` desde el commit `f3768a14fc7345ff0145b0705574308bf6f19110` de `main`. Las tres ramas comparten ese punto de partida. Conservaremos `main` para producción y utilizaremos PR para incorporar los cambios en cada etapa.

## Vincular el pipeline

1. Confirmaremos si la versión actualizada conserva Jenkins u otra herramienta y revisaremos el pipeline existente.
2. Configuraremos la instalación, la ejecución de pruebas unitarias y la generación de cobertura desde un entorno limpio.
3. Publicaremos en GitHub un check o estado asociado al commit del PR. El resultado debe llegar a GitHub para que pueda bloquear el merge.
4. Incluiremos los PR dirigidos a QA y main. Si validamos una combinación de cambios, conservaremos su relación con el commit del PR.
5. Seleccionaremos en la protección el nombre exacto del control que aparezca en GitHub después de ejecutar el pipeline.

Definiremos los comandos y las rutas después de revisar la versión funcional y las pruebas que realmente contenga el proyecto.

## Proteger QA y main

Desde **Settings → Branches**, configuraremos una regla de protección para cada rama. Exigiremos PR, una aprobación y los checks reales del pipeline. Invalidaremos las aprobaciones anteriores cuando cambie el código y exigiremos que las conversaciones estén resueltas. Aplicaremos las reglas a administradores y mantendremos deshabilitados los force pushes y la eliminación. Guardaremos evidencia de ambas configuraciones.

Si usamos un ruleset en lugar de reglas clásicas, comprobaremos que esté activo, que incluya ambas ramas y que sus excepciones no permitan saltar los controles. La evidencia debe mostrar que la protección se aplica efectivamente.

## Demostrar que un fallo bloquea el merge

1. Abriremos un PR de verificación hacia una rama protegida desde una rama de trabajo.
2. Introduciremos en esa rama un fallo temporal en una prueba para que el pipeline termine con error. Dejaremos indicado en el PR que se trata de una demostración controlada.
3. Guardaremos el enlace de la ejecución fallida y una captura del PR que muestre el control fallido y el bloqueo del merge.
4. Corregiremos el fallo mediante otro commit en ese mismo PR, manteniendo la protección y las pruebas obligatorias.
5. Conservaremos la ejecución aprobada y la revisión vigente. Integraremos la versión corregida si corresponde, o cerraremos el PR de demostración.
6. Repetiremos la verificación para el otro destino protegido. El PR de demostración hacia main podrá cerrarse después de obtener las evidencias.

También revisaremos los filtros y las condiciones del pipeline. Una ejecución omitida puede aparecer como exitosa, por lo que comprobaremos que el control obligatorio ejecute las validaciones previstas y comunique sus fallos.

## Criterios que verificaremos al cerrar E9

- DEV, QA y main existen y su contenido corresponde a la versión que se está evaluando.
- La política está incorporada al proyecto y se aplica en los PR.
- Hay al menos tres PR con revisiones efectivas de otro integrante.
- QA y main bloquean la fusión ante un fallo del pipeline.
- Los enlaces, commits y capturas permiten verificar las evidencias.

## Referencias oficiales

- [Protección de ramas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).
- [Checks y estados](https://docs.github.com/en/pull-requests/reference/status-checks).
- [Plantillas de PR](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository).

