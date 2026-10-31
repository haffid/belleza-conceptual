import http from 'k6/http';
import { check, sleep } from 'k6';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';
import execution from 'k6/execution';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';

const origin = (__ENV.LOAD_BASE_URL || '').replace(/\/$/, '');
if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(origin)) throw new Error('LOAD_BASE_URL debe ser un origen HTTPS cloud sin rutas ni credenciales.');
if (__ENV.LOAD_AUTHORIZED !== 'yes') throw new Error('Confirma la autorización mediante LOAD_AUTHORIZED=yes.');
const catalogDuration = new Trend('catalog_duration', true);
const ordersDuration = new Trend('orders_duration', true);
const catalogRequests = new Counter('catalog_requests');
const ordersRequests = new Counter('orders_requests');
const catalogErrors = new Rate('catalog_errors');
const ordersErrors = new Rate('orders_errors');
const observedVus = new Gauge('observed_vus');
const steadyVus = new Gauge('steady_vus');
const steadyElapsed = new Gauge('steady_elapsed_ms');
const steadyRequests = new Counter('steady_requests');

export const options = {
  scenarios: { cloud_load: {
    executor: 'ramping-vus', startVUs: 0,
    stages: [{ duration: '1m', target: 50 }, { duration: '5m', target: 50 }, { duration: '30s', target: 0 }],
    gracefulRampDown: '20s', gracefulStop: '20s',
  } },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)'],
  thresholds: {
    catalog_duration: ['p(95)<4000'], orders_duration: ['p(95)<2000'],
    catalog_errors: ['rate<0.01'], orders_errors: ['rate<0.01'],
  },
};
const jsonHeaders = { 'Content-Type': 'application/json' };
function arrayResponse(response) {
  try { return response.status === 200 && Array.isArray(response.json()); } catch { return false; }
}
export function setup() {
  const health = http.get(origin + '/health', { timeout: '30s', tags: { endpoint: 'setup' } });
  if (health.status !== 200) throw new Error('El entorno cloud no supera la comprobación inicial.');
  const email = 'e14-' + Date.now() + '@example.test';
  const password = encoding.b64encode(crypto.randomBytes(24), 'rawurl');
  const response = http.post(origin + '/api/auth/register', JSON.stringify({
    email, password, nombre: 'Cuenta ficticia E14',
  }), { headers: jsonHeaders, timeout: '30s', tags: { endpoint: 'setup' } });
  if (response.status !== 201 || !response.cookies.bc_session?.length) throw new Error('No fue posible crear la cuenta ficticia de la prueba.');
  return { cookie: 'bc_session=' + response.cookies.bc_session[0].value };
}
export default function (data) {
  const elapsed = Date.now() - execution.scenario.startTime;
  const steady = elapsed >= 60000 && elapsed < 360000;
  observedVus.add(execution.instance.vusActive);
  if (steady) { steadyVus.add(execution.instance.vusActive); steadyElapsed.add(elapsed); }
  const catalog = http.get(origin + '/api/products', { timeout: '10s', tags: { endpoint: 'catalog' } });
  const catalogOk = arrayResponse(catalog);
  check(catalog, { 'catálogo HTTP 200 y arreglo JSON': () => catalogOk });
  catalogDuration.add(catalog.timings.duration); catalogRequests.add(1); catalogErrors.add(!catalogOk);
  const orders = http.get(origin + '/api/orders', {
    headers: { Cookie: data.cookie }, timeout: '10s', tags: { endpoint: 'orders' },
  });
  const ordersOk = arrayResponse(orders);
  check(orders, { 'historial propio HTTP 200 y arreglo JSON': () => ordersOk });
  ordersDuration.add(orders.timings.duration); ordersRequests.add(1); ordersErrors.add(!ordersOk);
  if (steady) steadyRequests.add(2);
  sleep(1);
}
export function teardown(data) {
  http.post(origin + '/api/auth/logout', '{}', { headers: { ...jsonHeaders, Cookie: data.cookie }, timeout: '10s', tags: { endpoint: 'teardown' } });
}
export function handleSummary(data) {
  const result = {
    executed_at_utc: new Date().toISOString(), origin,
    tool: 'k6', profile: { ramp_seconds: 60, sustained_vus: 50, sustained_seconds: 300, ramp_down_seconds: 30 },
    endpoints: ['GET /api/products', 'GET /api/orders'],
    limitation: 'Cuenta ficticia y colecciones vacías. No mide navegador, envío de pedido ni disponibilidad mensual.',
    metrics: data.metrics, state: data.state,
  };
  const file = (__ENV.LOAD_RESULT_DIR || 'reports/load') + '/e14-k6.json';
  return { [file]: JSON.stringify(result, null, 2), stdout: 'E14 finalizó. Métricas por endpoint y perfil conservados en el reporte JSON.\n' };
}
