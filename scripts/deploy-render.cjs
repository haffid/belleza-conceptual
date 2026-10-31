'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

function deploymentConfig(env) {
  if (!/^[a-f0-9]{40}$/i.test(env.GITHUB_SHA || '')) throw new Error('Falta la revisión validada.');
  const hook = new URL(env.RENDER_DEPLOY_HOOK_URL);
  const origin = new URL(env.APP_BASE_URL);
  if (hook.protocol !== 'https:' || hook.hostname !== 'api.render.com' || !hook.pathname.startsWith('/deploy/srv-') || !hook.searchParams.has('key')) throw new Error('Hook de Render inválido.');
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('APP_BASE_URL debe ser un origen HTTPS.');
  hook.searchParams.set('ref', env.GITHUB_SHA);
  return { hook: hook.href, origin: origin.origin, revision: env.GITHUB_SHA };
}
async function deploy(config, request = fetch, pause = delay, attempts = 60) {
  const trigger = await request(config.hook, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (![200, 202].includes(trigger.status)) throw new Error('Render rechazó el inicio del despliegue.');
  for (let attempt = 0; attempt < attempts; attempt++) {
    await pause(10000);
    try {
      const response = await request(config.origin + '/health', { redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (response.status === 200) {
        const health = await response.json();
        if (health.status === 'ok' && health.revision === config.revision) return { status: 'deployed', origin: config.origin, revision: health.revision };
      }
    } catch { /* La versión anterior o el reinicio no acreditan la nueva revisión. */ }
  }
  throw new Error('El despliegue no confirmó la revisión validada dentro del tiempo permitido.');
}
module.exports = { deploymentConfig, deploy };
if (require.main === module) {
  (async () => {
    const config = deploymentConfig(process.env);
    const report = await deploy(config);
    const target = path.resolve(__dirname, '../reports/deploy');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'deployment.json'), JSON.stringify(report, null, 2));
    console.log('Despliegue confirmado: health coincide con la revisión validada.');
  })().catch(() => { console.error('Falló el despliegue o su verificación. No se imprimen secretos.'); process.exitCode = 1; });
}
