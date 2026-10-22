// SPDX-License-Identifier: GPL-3.0-or-later
// Audit built stages that carry functional map devices (not fixed-squad operators).
//
//   node tools/arkpedia/device-audit.mjs
//
// The engine does not model these devices yet; the report keeps them visible so
// a stage is not promoted public while a functional device is silently ignored.
import { readFileSync } from 'node:fs';
import index from '../../data/arkpedia-stages.json' with { type: 'json' };
const devices = JSON.parse(readFileSync(new URL('../../../arkpedia-data/source/data/stage-devices.json', import.meta.url), 'utf8'));

const isFunctional = d => d.kind === 'device' && !String(d.key).startsWith('char_');
const rows = [];
for (const entry of index.stages.filter(s => s.data)) {
  const functional = (devices[entry.id] ?? []).filter(isFunctional);
  if (functional.length) rows.push({ id: entry.id, testOnly: !!entry.testOnly,
    devices: [...new Set(functional.map(d => d.name))] });
}
const byDevice = {};
for (const row of rows) for (const name of row.devices) byDevice[name] = (byDevice[name] ?? 0) + 1;
console.log(JSON.stringify({ builtWithFunctionalDevices: rows.length,
  publicWithFunctionalDevices: rows.filter(r => !r.testOnly).length,
  byDevice: Object.entries(byDevice).sort((a, b) => b[1] - a[1]),
  stages: rows }, null, 2));
