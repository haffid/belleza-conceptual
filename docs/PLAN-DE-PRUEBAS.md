# Plan de pruebas — Sprint 2

## 1. Objetivo

Automatizar la verificación del flujo de compra del cliente (catálogo → carrito → pedido) y ejecutarla dentro del pipeline de Jenkins en cada despliegue a staging. Un build solo se considera correcto si las 16 pruebas pasan sobre la versión recién desplegada.

## 2. Alcance

| Dentro del alcance | Fuera del alcance |
|---|---|
| API: `/health`, `/api/products`, `/api/orders`, `/api/orders/:codigo` | Panel administrativo: RF-05, RF-06, RF-07, RF-08 y RF-10, que no están implementados |
| Validaciones de entrada del pedido (400/404) | Pagos, entregas y notificaciones por correo |
| Tiempo de respuesta de `/health` y del catálogo | Pruebas de carga y concurrencia |
| Flujo en navegador: catálogo, filtros, carrito y validación del checkout | Compatibilidad en Edge o Safari (RNF-08) y en móvil (RNF-01) |

Los casos manuales de la Fase 1 (CP-01 a CP-36, Azure Test Plans) siguen vigentes. Este plan cubre la parte **automatizada**.

## 3. Estrategia

| Nivel | Herramienta | Archivo | Pruebas |
|---|---|---|---|
| API funcional | pytest + requests | `tests/test_api.py` | 4 |
| Validación y seguridad | pytest + requests | `tests/test_security.py` | 6 |
| Rendimiento | pytest + requests (`time.perf_counter`) | `tests/test_performance.py` | 2 |
| End-to-end (UI) | pytest + Selenium WebDriver (Chrome) | `tests/selenium/test_frontend.py` | 4 |
| **Total** | | | **16** |

Técnicas de diseño aplicadas: partición de equivalencia (clases válidas e inválidas del pedido), valores límite (cantidad 0 y −1), casos de error (404) y umbral de rendimiento.

Todas las pruebas son de caja negra contra una URL (`BASE_URL`). La misma suite se ejecuta sin cambios contra local, staging o Render.

## 4. Ambiente de ejecución

| Elemento | Valor |
|---|---|
| Ambiente objetivo | Staging Docker: `http://belleza-staging-app-1:3002` desde Jenkins, `http://localhost:3003` desde el host |
| Base de datos | PostgreSQL 17 de staging, inicializado con `seed.sql` (9 productos, uno agotado) |
| Orquestador | Jenkins, `Jenkinsfile` (agente Linux) |
| Navegador | Chrome/Chromium en modo headless (`HEADLESS=true`, ventana 1920×1080) |
| Dependencias | `requirements.txt`: pytest, requests, selenium, pytest-html |
| Reportes | `pytest-results.xml` y `pytest-results-staging.xml` (JUnit); `report.html` y `report-staging.html` |

## 5. Casos automatizados

| ID | Prueba (función) | Tipo | Entrada / acción | Resultado esperado | Trazabilidad |
|---|---|---|---|---|---|
| AT-01 | `test_health_status_code` | API | `GET /health` | 200 | RNF-04 |
| AT-02 | `test_health_service_status` | API | `GET /health` | `status = ok` y `db = up` | RNF-04 |
| AT-03 | `test_products_status_code` | API | `GET /api/products` | 200 | RF-01 |
| AT-04 | `test_products_returns_list` | API | `GET /api/products` | Lista con al menos un producto | RF-01, RF-09 |
| AT-05 | `test_unknown_route_returns_404` | Seguridad | `GET /api/ruta-inexistente` | 404 | Manejo de errores |
| AT-06 | `test_order_without_client_returns_400` | Seguridad | Pedido sin `cliente` | 400 | RF-03, CP-07 |
| AT-07 | `test_order_without_items_returns_400` | Seguridad | Pedido con `items: []` | 400 | RF-03, CU-02 A2 |
| AT-08 | `test_order_with_zero_quantity_returns_400` | Seguridad (límite) | `cantidad = 0` | 400 | RF-02, CP-02 |
| AT-09 | `test_order_with_negative_quantity_returns_400` | Seguridad (límite) | `cantidad = -1` | 400 | RF-02, RNF-07 |
| AT-10 | `test_unknown_order_returns_404` | Seguridad | `GET /api/orders/BC-99999999` | 404 | CU-03 |
| AT-11 | `test_health_response_time` | Rendimiento | `GET /health` tras una llamada de calentamiento | 200 en menos de `MAX_RESPONSE_SECONDS` (5 s) | RNF-03 |
| AT-12 | `test_products_response_time` | Rendimiento | `GET /api/products` tras una llamada de calentamiento | 200 en menos de `MAX_RESPONSE_SECONDS` (5 s) | RNF-02 |
| AT-13 | `test_catalog_loads_products` | E2E | Abrir `/` | Al menos una `.product-card` | RF-01, CU-01 |
| AT-14 | `test_category_filters_are_visible` | E2E | Abrir `/` | Al menos un `.filter-pill` | CU-01 (filtrar por categoría) |
| AT-15 | `test_add_product_to_cart` | E2E | Clic en el primer `.add-btn` habilitado | `#cartCount > 0` y el carrito (`#drawer`) abierto | RF-02, CP-01 |
| AT-16 | `test_checkout_required_fields_validation` | E2E | Agregar producto → Continuar → Enviar sin datos | Mensaje "Nombre y teléfono son obligatorios" | RF-03, CP-07 |

### Brecha de umbral

AT-11 y AT-12 usan 5 s por defecto, pero en la Fase 1 los requerimientos definieron umbrales más estrictos: **RNF-02 pide 4 s o menos** para el catálogo y **RNF-03 pide 2 s o menos** para las acciones. Para alinearlos, basta definir `MAX_RESPONSE_SECONDS=4` (o separar un umbral por prueba) en el `environment` del `Jenkinsfile`.

## 6. Criterios de entrada y salida

**Entrada:**

- La build instala dependencias sin error (etapa Build).
- Staging responde `/health` con `db: up` (el healthcheck de Compose lo garantiza antes de Verify Staging).
- La base de staging tiene el catálogo de `seed.sql`.

**Salida (build aprobado):**

- 16 de 16 pruebas aprobadas en Verify Staging.
- Resultados JUnit publicados y reportes HTML archivados en Jenkins.
- Cualquier prueba fallida deja el build en rojo y se registra como defecto antes de corregir.

## 7. Ejecución en el pipeline

| Etapa | Qué prueba | Reporte |
|---|---|---|
| Test | La versión que estaba desplegada en `BASE_URL` antes del build | `pytest-results.xml`, `report.html` |
| Verify Staging | La versión recién construida y desplegada | `pytest-results-staging.xml`, `report-staging.html` |

## 8. Registro de ejecuciones del Sprint 2

| # | Build Jenkins | Fecha | Tipo | Resultado | Etapa donde se detuvo | Observación |
|---|---|---|---|---|---|---|
| 1 | #[__] | [__/09/2026] | Positiva | 16/16 aprobadas | — (5 etapas en verde) | Línea base |
| 2 | #[__] | [__/09/2026] | Negativa | [__]/16 aprobadas | [etapa] | [prueba que falló y causa] |
| 3 | #[__] | [__/09/2026] | Corrección | 16/16 aprobadas | — (5 etapas en verde) | [qué se corrigió] |

### Defecto de la ejecución negativa

| Campo | Valor |
|---|---|
| ID | DEF-S2-01 |
| Prueba que lo detectó | [AT-__ `nombre_de_la_prueba`] |
| Etapa | [Test / Verify Staging] |
| Resultado esperado | [__] |
| Resultado obtenido | [__] |
| Causa raíz | [__] |
| Corrección aplicada | [commit o cambio] |
| Verificación | Build #[__] con 16/16 aprobadas |

## 9. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Selenium Manager sin Internet no descarga el controlador de Chrome | Fallan AT-13 a AT-16 | Chrome y chromedriver preinstalados en el agente |
| La etapa Test corre contra la versión anterior | Un fallo ahí puede no deberse al código nuevo | Tomar Verify Staging como verificación de la versión nueva |
| Las pruebas de pedidos no crean pedidos válidos | El camino feliz de `POST /api/orders` (201) no está automatizado | Agregar una prueba de pedido válido que verifique el descuento de inventario |
| Umbral de rendimiento más laxo que los RNF | Una regresión entre 4 y 5 s no se detecta | `MAX_RESPONSE_SECONDS=4` |
