'use strict';
const fs = require('node:fs');
const base = process.env.GITHUB_BASE_REF;
const head = process.env.GITHUB_HEAD_REF;

if (base === 'QA' || base === 'main') {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const repository = process.env.GITHUB_REPOSITORY?.toLowerCase();

  if (!eventPath || !repository) {
    throw new Error('Faltan metadatos del evento para validar la promoción.');
  }

  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const source = event.pull_request?.head?.repo?.full_name?.toLowerCase();
  const target = event.pull_request?.base?.repo?.full_name?.toLowerCase();

  if (source !== repository || target !== repository) {
    throw new Error('Las promociones hacia QA y main deben proceder del mismo repositorio.');
  }

  const expectedHead = base === 'QA' ? 'DEV' : 'QA';
  if (head !== expectedHead) {
    throw new Error('La promoción hacia ' + base + ' debe proceder de ' + expectedHead + '.');
  }
}

console.log(base ? 'Origen verificado: ' + head + ' -> ' + base : 'Ejecución de rama: no hay promoción de PR que validar.');
