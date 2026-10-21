// SPDX-License-Identifier: GPL-3.0-or-later
// Wall-clock benchmark for the battle engine on a committed stage file.
//
//   node tools/arkpedia/benchmark-stage.mjs --stage 14-11 --seconds 60 --runs 3
//
// The result is engine time only: no rendering, browser or network. It is the
// number to watch before considering a native/WASM rewrite.
import { readFileSync } from 'node:fs';
import mvp from '../../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../../server/sim/arkpedia.js';
import { defaultBuild } from '../../shared/arkpedia/loadout.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const slug = opt('stage', '14-11'), seconds = Number(opt('seconds', '60')), runs = Number(opt('runs', '3'));
const stage = JSON.parse(readFileSync(new URL(`../../data/arkpedia-stage-${slug}.json`, import.meta.url), 'utf8'));
const selection = { operators: Object.values(mvp.operators).slice(0, 12).map(defaultBuild) };
const results = [];
for (let run = 0; run < runs; run++) {
  const data = { ...structuredClone(mvp), stage, enemies: { ...mvp.enemies, ...stage.enemies } };
  const t0 = performance.now(), battle = new StandardBattle(data, selection);
  battle.setViewport('fullscreen-workspace');
  let steps = 0;
  while (!battle.finished && battle.time < seconds) { battle.step(); steps++; }
  const wallMs = performance.now() - t0;
  results.push({ steps, simSeconds: +battle.time.toFixed(2), wallMs: +wallMs.toFixed(1), errors: battle.errors.length });
}
const median = (key) => results.map(r => r[key]).sort((a, b) => a - b)[Math.floor(results.length / 2)];
console.log(JSON.stringify({ stage: slug, seconds, results,
  median: { wallMs: median('wallMs'), stepsPerSecond: Math.round(median('steps') / (median('wallMs') / 1000)) } }, null, 2));
