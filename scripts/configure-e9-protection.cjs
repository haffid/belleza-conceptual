'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const repository = 'haffid/belleza-conceptual';
const branches = ['QA', 'main'];
const check = 'E9-E10 / pruebas-unitarias';
const configuration = JSON.parse(fs.readFileSync(path.join(root, 'docs/E9-PROTECCION-REQUERIDA.json'), 'utf8'));
const args = process.argv.slice(2);
const mode = args[0] || '--dry-run';

function api(endpoint, payload) {
  const command = ['api', '-H', 'Accept: application/vnd.github+json'];
  if (payload) command.push('--method', 'PUT', '--input', '-');
  command.push(endpoint);
  const result = spawnSync('gh', command, {
    encoding: 'utf8',
    input: payload ? JSON.stringify(payload) : undefined,
    windowsHide: true,
  });
  if (result.error) throw new Error('No se pudo ejecutar GitHub CLI (gh). Debe estar instalado y autenticado.');
  if (result.status !== 0) throw new Error(`GitHub rechazó ${endpoint}: ${(result.stderr || 'sin detalle').trim()}`);
  return JSON.parse(result.stdout);
}

function validate(protection, branch) {
  const problems = [];
  const status = protection.required_status_checks;
  const contexts = new Set([...(status?.contexts || []), ...(status?.checks || []).map(item => item.context)]);
  if (!contexts.has(check)) problems.push('falta el check obligatorio');
  if (status?.strict !== true) problems.push('no exige rama actualizada');
  if (protection.enforce_admins?.enabled !== true) problems.push('no aplica a administradores');
  const reviews = protection.required_pull_request_reviews;
  if (!(reviews?.required_approving_review_count >= 1)) problems.push('falta una aprobación');
  if (reviews?.dismiss_stale_reviews !== true) problems.push('no invalida aprobaciones antiguas');
  if (reviews?.require_last_push_approval !== true) problems.push('no exige aprobación del último aporte');
  if (protection.required_conversation_resolution?.enabled !== true) problems.push('no exige resolver conversaciones');
  if (protection.allow_force_pushes?.enabled !== false) problems.push('force push no está deshabilitado');
  if (protection.allow_deletions?.enabled !== false) problems.push('eliminación no está deshabilitada');
  if (problems.length) throw new Error(`${branch}: ${problems.join('; ')}. Revisar las reglas existentes sin reemplazarlas automáticamente.`);
}

function main() {
  if (args.length > 1 || !['--dry-run', '--apply', '--verify'].includes(mode)) {
    throw new Error('Uso: node scripts/configure-e9-protection.cjs [--dry-run|--apply|--verify]');
  }
  if (mode === '--dry-run') {
    console.log(JSON.stringify({ repository, branches, mode, configuration, changes_applied: false }, null, 2));
    return;
  }

  const repo = api(`repos/${repository}`);
  if (mode === '--apply' && repo.permissions?.admin !== true) {
    throw new Error('La cuenta autenticada no tiene administración en este repositorio. Debe ejecutarlo el propietario o un administrador. No se aplicaron cambios.');
  }

  // Se revisan ambas ramas antes de escribir. Las reglas existentes no se sobrescriben.
  const initial = branches.map(branch => {
    const state = api(`repos/${repository}/branches/${branch}`);
    if (state.protected) validate(api(`repos/${repository}/branches/${branch}/protection`), branch);
    if (mode === '--verify' && !state.protected) throw new Error(`${branch}: la protección no está activa.`);
    return { branch, protected: state.protected };
  });

  const verified = [];
  for (const state of initial) {
    const endpoint = `repos/${repository}/branches/${state.branch}/protection`;
    if (mode === '--apply' && !state.protected) {
      api(endpoint, configuration);
      console.log(`Protección aplicada en ${state.branch}.`);
    }
    const protection = api(endpoint);
    validate(protection, state.branch);
    verified.push({ branch: state.branch, protection });
    console.log(`${state.branch}: check obligatorio, revisión y restricciones verificados.`);
  }

  const output = path.join(root, 'reports/e9/protection-verification.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({
    verified_at_utc: new Date().toISOString(),
    repository,
    mode,
    initial,
    verified,
    protections_verified: true,
    merge_block_demonstrated: false,
    pending: 'Conservar PR y pipeline fallido, con captura del merge bloqueado, para QA y main.',
  }, null, 2) + '\n');
  console.log('Evidencia de configuración: reports/e9/protection-verification.json');
  console.log('Pendiente: demostrar el bloqueo real del merge en QA y main.');
}

try { main(); } catch (error) {
  console.error(error.message);
  console.error('Si hubo un error después de aplicar una rama, conservar esa protección y verificar ambas antes de continuar.');
  process.exitCode = 1;
}
