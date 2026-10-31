'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, '../../scripts/check-promotion.cjs');
const own = 'haffid/belleza-conceptual';
const fork = 'otro/belleza-conceptual';

// Nombre, destino, origen, repositorio origen, repositorio destino,
// código de salida y mensaje esperado en caso de rechazo.
const cases = [
  ['DEV a QA del equipo', 'QA', 'DEV', own, own, 0, ''],
  ['QA a main del equipo', 'main', 'QA', own, own, 0, ''],
  ['feature a QA se rechaza', 'QA', 'feature/prueba', own, own, 1, 'debe proceder de DEV'],
  ['DEV a main se rechaza', 'main', 'DEV', own, own, 1, 'debe proceder de QA'],
  ['DEV de fork a QA se rechaza', 'QA', 'DEV', fork, own, 1, 'mismo repositorio'],
  ['QA de fork a main se rechaza', 'main', 'QA', fork, own, 1, 'mismo repositorio'],
  ['repositorio destino ajeno se rechaza', 'main', 'QA', own, fork, 1, 'mismo repositorio'],
  ['origen sin repositorio se rechaza', 'QA', 'DEV', null, own, 1, 'mismo repositorio'],
  ['PR de trabajo conserva su recorrido', 'test/e10-unitarias', 'ci/e9-e10', own, own, 0, ''],
];

for (const [name, base, head, source, target, status, message] of cases) {
  test(name, () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'e9-promotion-'));
    try {
      const eventPath = path.join(directory, 'event.json');
      const event = {
        pull_request: {
          head: { ref: head, repo: source ? { full_name: source } : null },
          base: { ref: base, repo: { full_name: target } },
        },
      };
      fs.writeFileSync(eventPath, JSON.stringify(event));

      const result = spawnSync(process.execPath, [script], {
        env: {
          ...process.env,
          GITHUB_BASE_REF: base,
          GITHUB_HEAD_REF: head,
          GITHUB_REPOSITORY: own,
          GITHUB_EVENT_PATH: eventPath,
        },
        encoding: 'utf8',
        timeout: 5000,
      });

      assert.ifError(result.error);
      assert.equal(result.status, status, result.stderr || result.stdout);
      if (status === 0) {
        assert.match(result.stdout, /Origen verificado/);
      } else {
        assert.ok(result.stderr.includes(message), result.stderr);
      }
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}
