'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const before = read('docs/evidence/E10-CONTROL-INICIAL.json');
const after = read('reports/unit/critical-summary.json');
const rows = {};
for (const name of Object.keys(before.modules)) {
  const base = before.modules[name], final = after.modules[name];
  if (!final || base.total !== final.total) throw new Error('El alcance cambió: revisar la comparabilidad de ' + name);
  const delta = final.percent - base.percent;
  rows[name] = { initial_control: base.percent, final: final.percent, increase_percentage_points: Number(delta.toFixed(4)) };
  if (delta < 20) throw new Error('El incremento técnico de ' + name + ' es menor a 20 puntos.');
}
const delta = after.aggregate.percent - before.aggregate.percent;
const comparison = { comparison_kind: 'control inicial de esta intervención frente a las nuevas unitarias', historical_baseline_confirmed: false, modules: rows, aggregate_increase_percentage_points: Number(delta.toFixed(4)), tests: after.tests };
fs.writeFileSync(path.join(root, 'reports/unit/comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
console.log(JSON.stringify(comparison, null, 2));
console.log('PENDIENTE DOCUMENTAL: este control no sustituye la línea base histórica de la sección 2.4.');
