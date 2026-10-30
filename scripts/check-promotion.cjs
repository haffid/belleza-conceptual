'use strict';
const base = process.env.GITHUB_BASE_REF;
const head = process.env.GITHUB_HEAD_REF;
if (base === 'QA' && head !== 'DEV') throw new Error('La promoción hacia QA debe proceder de DEV.');
if (base === 'main' && head !== 'QA') throw new Error('La promoción hacia main debe proceder de QA.');
console.log(base ? `Origen verificado: ${head} -> ${base}` : 'Ejecución de rama: no hay promoción de PR que validar.');
