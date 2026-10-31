# E14 Pruebas de carga en cloud

Script versionado: `test/load/e14.js`, ejecutado con k6 2.3.0 sobre `https://belleza-conceptual.onrender.com` con autorización del propietario el 30 de octubre de 2026.

Perfil fijo: inicia en 0 VU, rampa a 50 durante un minuto, mantiene 50 durante cinco minutos y baja a 0 durante 30 segundos. Incluye espera de un segundo por iteración. Los dos endpoints críticos son `GET /api/products` y `GET /api/orders`, este último con sesión de una cuenta ficticia creada una sola vez en setup. Se cierra la sesión en teardown; la cuenta sin pedidos permanece como dato de prueba. No se escriben pedidos ni se altera inventario.

## Resultado real observado

| Endpoint | Solicitudes | Promedio ms | p95 ms | Throughput global req/s | Errores |
| --- | ---: | ---: | ---: | ---: | ---: |
| Catálogo | 13542 | 136.66 | 156.11 | 34.51 | 0 % |
| Historial propio | 13542 | 137.03 | 156.18 | 34.51 | 0 % |

Total de solicitudes de negocio: 27084. Throughput conjunto global: 69.01 req/s. Durante el tramo sostenido se registran 23548 solicitudes, equivalentes a 78.49 req/s en 300 segundos. Pico observado: 50 VU; mínimo y máximo del tramo sostenido: 50. Las muestras de ese tramo abarcan 60000 a 359996 ms; duración efectiva total registrada: 392437.40 ms. Los contadores por endpoint excluyen setup y teardown. k6 terminó con código 0.

## Comparación con E1

| Requisito original | Evidencia y conclusión |
| --- | --- |
| RNF-02: página de catálogo completa en máximo 4 s sobre conexión de al menos 10 Mbps | El p95 de la API es 156.11 ms, por debajo de 4 s. Es un componente parcial: k6 HTTP no descarga y renderiza toda la página como navegador ni impone una conexión de 10 Mbps. No se acredita cumplimiento completo. |
| RNF-03: agregar al carrito y enviar pedido en máximo 2 s en el 95 % de casos, con al menos 20 mediciones | El historial responde con p95 156.18 ms, pero no es la acción enviar pedido; agregar al carrito ocurre en el navegador. No verificado por esta prueba. |
| RNF-04: disponibilidad mensual de al menos 99 % | Cero errores durante una prueba de unos 6.5 minutos no demuestra disponibilidad mensual. No verificado. |

Los umbrales del script (p95 catálogo inferior a 4 s, historial inferior a 2 s y error inferior a 1 %) son presupuestos operativos de esta prueba. No se atribuye a E1 un umbral de throughput ni se equipara tasa de error de esta ventana a disponibilidad mensual.

La aplicación observada usa SQLite, sin productos ni pedidos para la cuenta ficticia. Los resultados son válidos para esa muestra y no demuestran rendimiento con un catálogo grande, historial extenso o PostgreSQL. La prueba se realizó sobre el despliegue preexistente, cuyo health no expone revisión; no se atribuye al nuevo pipeline ni a su commit.

## Repetición autorizada

Crear `reports/load`, definir `LOAD_BASE_URL` con el origen HTTPS y `LOAD_AUTHORIZED=yes` y ejecutar `k6 run test/load/e14.js`. `handleSummary` guarda métricas y perfil en `reports/load/e14-k6.json`, sin cookies ni contraseñas. Mantener una cuenta ficticia por ejecución y conservar ese JSON y el log de salida.

El workflow manual `e14-load.yml` permite repetirla en GitHub mediante el environment `load-test`, variable `APP_BASE_URL` y confirmación `authorized=true`. No se activa en cada push para evitar cargas no solicitadas contra cloud.

Referencia: https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-vus/ .
