# E9 — Activación y demostración del bloqueo

## Estado verificado el 30 de octubre de 2026

La cuenta conectada `AnEstuardoBarriosg` tiene permiso `write`, con `admin: false`. QA y main continúan sin protección. No se presenta el bloqueo como implementado ni demostrado. El propietario del repositorio debe aplicar la configuración desde su cuenta. El registro de esta consulta está en `evidence/E9-VERIFICACION-PERMISOS.json`.

## Aplicación por el propietario

Requisitos: Node.js, GitHub CLI (`gh`) instalado y autenticado con una cuenta que tenga administración sobre `haffid/belleza-conceptual`. Desde una copia actualizada de la rama `ci/e9-e10`, ejecutar:

```powershell
node scripts/configure-e9-protection.cjs --dry-run
node scripts/configure-e9-protection.cjs --apply
```

El primer comando solo muestra la configuración. El segundo consulta los permisos y ambas ramas antes de escribir, aplica `E9-PROTECCION-REQUERIDA.json` en QA y main y verifica la respuesta de GitHub. Si encuentra protecciones existentes que no coinciden con los requisitos, se detiene para revisarlas sin sobrescribirlas. Un error posterior a aplicar una rama no elimina la protección ya configurada.

Las reglas exigen el check `E9-E10 / pruebas-unitarias`, rama actualizada, PR con una aprobación, invalidación de aprobaciones antiguas, aprobación del último aporte y conversaciones resueltas. Se aplican a administradores y mantienen deshabilitados force push y eliminación.

La evidencia de la configuración queda en `reports/e9/protection-verification.json`. Puede repetirse la lectura sin aplicar cambios:

```powershell
node scripts/configure-e9-protection.cjs --verify
```

Ese reporte conserva `merge_block_demonstrated: false`: verificar la configuración no sustituye la demostración del bloqueo.

## Demostración real pendiente

1. Revisar e integrar los PR #3 y #2 en el orden previsto, con revisión efectiva de otro integrante, para que DEV contenga el workflow y las pruebas. Integrar también la política del PR #1. Las promociones conservan DEV a QA y QA a main.
2. Abrir el PR de DEV hacia QA. Introducir de forma controlada una aserción unitaria incorrecta, conservar el SHA y el run fallido del check obligatorio y capturar el mensaje de merge bloqueado. La captura debe identificar el check fallido y la restricción; la falta de una aprobación por sí sola no acredita esta condición.
3. Restaurar la aserción, volver a ejecutar y obtener la revisión que corresponda. Conservar también la ejecución corregida. Promover a QA únicamente la versión aprobada.
4. Verificar la misma condición para un PR de QA hacia main. Un fallo temporal en QA debe hacerse dentro de una ventana de demostración controlada, conservando el commit anterior, y restaurarse al terminar. El PR de demostración puede cerrarse sin integrar; no promover una versión fallida.
5. Guardar por cada destino: configuración activa, PR, SHA, ejecución fallida, captura del merge bloqueado y resultado después de restaurar la prueba. La conclusión del informe se redacta a partir de estas evidencias reales.

## Referencias

- [Administrar reglas de protección](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).
- [API de protección de ramas](https://docs.github.com/en/rest/branches/branch-protection).
