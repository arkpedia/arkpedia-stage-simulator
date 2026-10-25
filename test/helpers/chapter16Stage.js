// SPDX-License-Identifier: GPL-3.0-or-later
// Integration fixture assembled from the retained canonical source. Admission
// to the file-backed catalogue remains a separate reviewed builder operation.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { syntheticRoutePath } from '../../shared/arkpedia/stage-path.js';
import { StandardBattle } from '../../server/sim/arkpedia.js';
import { defaultBuild } from '../../shared/arkpedia/loadout.js';
import mvp from '../../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../../data/candidates/arkpedia-stage-16-3-source.json' with { type: 'json' };
const catalogue = JSON.parse(readFileSync(new URL('../../data/candidates/arkpedia-enemy-records.canonical.json', import.meta.url)));
const records = catalogue.enemies;

export function chapter16StageFixture({ isolated = false } = {}) {
  const geometry = structuredClone(source.geometry);
  if (isolated) geometry.waves = [];
  const stage = { testOnly: true, code: source.stage.code, name: source.stage.name, battle: source.stage.battle,
    enemyCatalogue: 'canonical-ch16-candidate-v1', canonicalData: catalogue.canonicalData, upstream: catalogue.upstream,
    geometry, devices: source.devices, conditionalHandled: true, chapter16Source: source,
    pathing: { schemaVersion: 1, geometryHash: createHash('sha256').update(JSON.stringify(geometry)).digest('hex'),
      moveScale: source.rawLevel.options.moveMultiplier,
      paths: Object.fromEntries(geometry.routes.map((route, index) => [index, syntheticRoutePath(route)])) } };
  const enemies = Object.fromEntries(geometry.enemyConfigurations.map(c => {
    if (c.overrides) throw Error('Integration fixture needs explicit stage override review');
    return [c.enemy_id, records[c.enemy_id].levels[c.database_level]];
  }));
  const b = new StandardBattle({ ...structuredClone(mvp), stage, enemies },
    { operators: [defaultBuild(Object.values(mvp.operators).find(o => o.position === 'MELEE'))] }, { seed: 19 });
  b.life = 1000;
  if (isolated) b.autoFinish = false;
  const run = seconds => {
    for (let i = 0; i < Math.ceil(seconds / b.dt) && !b.finished; i++) b.step();
    if (b.errors.length) throw Error(JSON.stringify(b.errors));
  };
  return { b, run, stage, source };
}
