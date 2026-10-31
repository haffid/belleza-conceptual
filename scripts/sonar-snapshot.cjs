'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const project = 'haffid_belleza-conceptual';
const args = process.argv.slice(2);
function argument(name, fallback = '') { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; }
async function main() {
  const output = path.resolve(argument('--output', 'reports/sonar'));
  const pr = argument('--pull-request', process.env.PR_NUMBER || '');
  const branch = argument('--branch');
  if (pr && !/^\d+$/.test(pr)) throw new Error('Número de PR inválido.');
  if (pr && branch) throw new Error('Selecciona rama o PR, sin mezclar alcances.');
  const scope = pr ? { pullRequest: pr } : branch ? { branch } : {};
  const request = async (endpoint, params) => {
    const url = new URL('/api/' + endpoint, 'https://sonarcloud.io');
    url.search = new URLSearchParams(params).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('SonarCloud ' + response.status + ' en ' + endpoint);
    return response.json();
  };
  await fs.mkdir(output, { recursive: true });
  const metricKeys = pr ? 'new_bugs,new_vulnerabilities,new_code_smells,new_duplicated_lines_density,new_technical_debt,new_blocker_violations,new_critical_violations' : 'bugs,vulnerabilities,code_smells,duplicated_lines_density,sqale_index,blocker_violations,critical_violations,ncloc,coverage';
  const measures = await request('measures/component', { component: project, metricKeys, ...scope });
  const gate = await request('qualitygates/project_status', { projectKey: project, ...scope });
  const issues = [];
  let page = 1, total;
  do {
    const result = await request('issues/search', { componentKeys: project, resolved: 'false', ps: '500', p: String(page), ...scope });
    total = result.paging.total;
    issues.push(...result.issues);
    page++;
  } while (issues.length < total);
  const metrics = Object.fromEntries(measures.component.measures.map(m => [m.metric, m.value ?? m.periods?.[0]?.value ?? null]));
  const summary = {
    observed_at_utc: new Date().toISOString(), project,
    scope: pr ? 'pull_request' : branch ? 'branch' : 'main', selector: scope,
    workflow_revision: process.env.GITHUB_SHA || null,
    note: 'Un snapshot público de rama o PR no equivale a métricas de main. No interpretar métricas ausentes como cero.',
    metrics, quality_gate: gate.projectStatus.status,
    open_issues: issues.length,
    blocker: issues.filter(i => i.severity === 'BLOCKER').length,
    critical: issues.filter(i => i.severity === 'CRITICAL').length,
  };
  for (const [name, value] of Object.entries({ measures, gate, issues: { total, issues }, summary })) await fs.writeFile(path.join(output, name + '.json'), JSON.stringify(value, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
