# E11 Pruebas de API

La colección `postman/Belleza-Conceptual.postman_collection.json` contiene 35 solicitudes HTTP y 105 aserciones: código de respuesta, esquema JSON y contenido de cada respuesta. Se ejecuta con Newman 6.2.3. No son pruebas unitarias y no se suman a los 39 casos de E10.

## Ejecución reproducible

Con Node.js 22 o superior y dependencias instaladas:

```text
npm ci
npm ci --prefix tools/api
npm run test:api
```

El ejecutor crea una SQLite y un directorio de fotografías temporales, genera credenciales efímeras y abre Express en un puerto aleatorio de 127.0.0.1. La conexión de producción no se usa: se pasa una ruta de base explícita y se neutraliza DATABASE_URL antes de cargar la aplicación. Al finalizar se cierra la instancia y se elimina exclusivamente el directorio temporal creado por esa ejecución. La tienda que se utiliza en el puerto 3002 no se modifica.

El entorno JSON versionado no contiene contraseñas. No sirve para apuntar la colección directamente a la tienda real. Para importar manualmente en Postman, preparar primero un ambiente desechable, crear allí el administrador de prueba y configurar sus credenciales y la URL solo en el entorno privado de Postman.

## Flujo encadenado

1. API-01 a API-10: salud, catálogo, registro, ingreso, perfil, permisos y revocación de sesión.
2. API-11 a API-15: ingreso administrativo y creación de producto con cinco unidades; cambio explícito a cliente.
3. API-16 a API-20: pedido vacío rechazado, compra de dos unidades por Q25.00, detalle, historial y rechazo de cantidad insuficiente.
4. API-21 a API-25: otra cuenta recibe 404 al consultar el pedido ajeno; cambio explícito a administrador.
5. API-26 a API-31: stock pasa de 5 a 3; se obtiene ID del pedido, se cancela y vuelve a 5; la segunda cancelación devuelve 409 sin duplicar existencias.
6. API-32 a API-35: trazabilidad de movimientos, ajuste negativo rechazado y control de origen.

`productId`, `orderCode` y `orderId` se extraen de respuestas verificadas y se reutilizan en las siguientes solicitudes. Los cuerpos de pedidos usan IDs numéricos JSON. Se cierra sesión antes de cambiar de identidad para que la cookie de administrador no invalide una comprobación de cliente.

## Resultados y fallo

La ejecución local del 30 de octubre de 2026 aprobó 35 solicitudes y 105 aserciones, sin fallos. Los resultados originales se generan en:

- `reports/api/summary.json`: nombres, métodos, códigos, aserciones y fallos; no guarda contraseñas, tokens ni cuerpos completos.
- `reports/api/newman.xml`: reporte JUnit para herramientas de CI.

El proceso termina con código 1 si Newman falla, si hay menos de 15 solicitudes, si alguna solicitud no tiene al menos tres aserciones o si alguna aserción no se aprueba.

## Pipeline

`.github/workflows/e11-api.yml` ejecuta la colección en PR, push a DEV, QA o main y ejecución manual. Instala las dependencias con sus lockfiles, ejecuta `npm run test:api` y conserva reportes durante 30 días con `if: always()`. No usa `continue-on-error` ni ignora el código de salida. El check se llama `E11 / pruebas-api`.

La existencia de este archivo no demuestra una ejecución en GitHub. Conservar el enlace del run, su commit y el artefacto aprobado cuando se publique. Agregar el check de API a las reglas de QA y main para que su fallo bloquee la promoción; el archivo YAML por sí solo no activa esa protección.

## Alcance y dependencias

Estas ejecuciones prueban Express y persistencia SQLite reales mediante HTTP. No demuestran compatibilidad operativa con PostgreSQL ni disponibilidad del despliegue público.

Newman queda instalado en `tools/api`, separado de las dependencias de producción. Su árbol de dependencias registra avisos conocidos de npm audit, incluidos de severidad alta y crítica. No presentar esta herramienta como libre de vulnerabilidades: ejecutar únicamente la colección controlada con datos sintéticos en un entorno de CI aislado, sin secretos de producción, y revisar actualizaciones. Esta separación no elimina los avisos del entorno de pruebas.
