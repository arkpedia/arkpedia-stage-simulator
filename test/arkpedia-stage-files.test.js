// SPDX-License-Identifier: GPL-3.0-or-later
// Every file-backed stage under data/ must be loadable, use only supported
// enemies, and fight on the shared battle. Files that are not in the public
// catalogue yet stay test-only, but they cannot rot: adding one here is enough
// to exercise it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { applyStage } from '../shared/arkpedia/stages.js';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import candidateSupport from '../data/candidates/arkpedia-ch16-enemy-support.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };

const dataDir = new URL('../data/', import.meta.url);
const files = (await readdir(dataDir)).filter(name => /^arkpedia-stage-.+\.json$/.test(name)).sort();

test('every file-backed stage is supported, catalogue-loadable and fightable', { timeout: 600_000 }, async () => {
  assert.ok(files.length, 'at least one file-backed stage');
  for (const file of files) {
    const stage = JSON.parse(await readFile(new URL(file, dataDir), 'utf8'));
    const id = file.replace(/^arkpedia-stage-/, '').replace(/\.json$/, '');
    assert.ok(stage.code, `${file} code`);
    assert.ok(stage.enemies && Object.keys(stage.enemies).length, `${id} carries enemy records`);
    const selectedSupport = stage.testOnly && stage.enemyCatalogue === 'canonical-ch16-candidate-v1' ? candidateSupport : support;
    for (const [enemyId, record] of Object.entries(stage.enemies)) {
      assert.ok(selectedSupport.enemies[enemyId]?.policy, `${id} enemy ${enemyId} is supported`);
      assert.equal(record.key, enemyId, `${id} record key`);
    }
    const adapter = stageAdapter(stage);
    assert.ok(adapter.spawns.length, `${id} has spawns`);
    for (const spawn of adapter.spawns) assert.ok(stage.enemies[spawn.enemyKey], `${id} ships ${spawn.enemyKey}`);
    // The source level file owns each enemy's database level and attribute overrides.
    for (const config of stage.geometry.enemyConfigurations ?? []) {
      const record = stage.enemies[config.enemy_id];
      if (!record) continue;
      if (typeof config.database_level === 'number') assert.equal(record.level, config.database_level, `${id} ${config.enemy_id} level`);
      for (const [key, field] of Object.entries({ def: 'def', atk: 'atk', hp: 'maxHp', res: 'res' }))
        if (typeof config.overrides?.[key] === 'number') assert.equal(record.stats[field], config.overrides[key], `${id} ${config.enemy_id} ${key}`);
    }

    const data = structuredClone(mvp);
    const index = { schemaVersion: 1, defaultStage: id, stages: [{ id, code: stage.code, name: stage.name, data: file, testOnly: stage.testOnly ?? false }] };
    const { entry } = await applyStage(data, index, null, async () => ({ ok: true, json: async () => stage }), { experimental: true });
    assert.equal(entry.id, id); assert.equal(data.stage.code, stage.code);
    for (const enemyId of Object.keys(stage.enemies)) assert.ok(data.enemies[enemyId], `${id} merged ${enemyId}`);

    const battle = new StandardBattle(data, { operators: Object.values(data.operators).slice(0, 12).map(defaultBuild) });
    battle.setViewport('fullscreen-workspace');
    for (let i = 0; i < Math.round(10 / battle.dt) && !battle.finished; i++) battle.step();
    assert.deepEqual(battle.errors, [], `${id} battle errors`);
  }
});
