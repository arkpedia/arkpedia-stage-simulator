// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { vcblvaNative } from '../shared/arkpedia/enemy-vcblva-features.js';

const id = 'enemy_8017_vcblva', rec = records.enemies[id].levels[0];
const DENIED = 'Tile is unavailable for deployment.';

test('admitted only with its pinned block_tile: nine tiles, the CN template and the 0.2 s trigger', () => {
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features');
  assert.equal(vcblvaNative(rec, nativeComponents(native, id)), true);
  const shrink = structuredClone(native), path = Object.keys(shrink.prefabs).find(k => k.endsWith(`/${id}.prefab`));
  const row = shrink.prefabs[path].find(c => c.originalJson.includes('"_rangeGridPositions"'));
  assert.ok(row); const d = JSON.parse(row.originalJson); d._rangeGridPositions = d._rangeGridPositions.slice(0, 5);
  row.originalJson = JSON.stringify(d);
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, shrink).policy, null, 'a cross instead of the 3x3');
  const tpl = structuredClone(native); tpl.templates.enemy_vcblva_t_tile.eventToActions.ON_BUFF_TRIGGER = [];
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, tpl).policy, null, 'template');
});

test('compiled VEC-02: the zone follows the elemental on the 0.2 s trigger and lifts when it dies', async () => {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'vec-02_act2break_02'));
  const op = 'char_151_myrtle';
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators[op]) }] }, { seed: 1 });
  b.setViewport('fullscreen-workspace'); b.start();
  let e = null;
  while (!b.finished && b.time < 900 && !e) {
    for (const x of b.enemies) if (x.alive && x.defId !== id) b.kill(x);
    e = b.enemies.find(x => x.alive && x.defId === id); b.step();
  }
  assert.ok(e, 'an elemental enters'); assert.ok(e.s.maxHp >= rec.stats.maxHp);
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true } });
  b.addDp('arkpedia', 99);
  const cells = [];
  for (let r = b.rect.r0; r <= b.rect.r1; r++) for (let c = b.rect.c0; c <= b.rect.c1; c++) {
    const t = b.grid.tile(r, c);
    if ((t.build === 'MELEE' || t.build === 'ALL') && b.placementError(op, r, c) === null) cells.push([r, c]);
  }
  // a melee tile with a free melee tile three columns away: the elemental stands next to the first, then the second
  const pair = cells.map(a => [a, cells.find(([r, c]) => r === a[0] && Math.abs(c - a[1]) >= 3)]).find(([, far]) => far);
  assert.ok(pair, 'two melee tiles'); const [near, far] = pair;
  const run = s => { const until = b.time + s; while (b.time < until - 1e-9) { for (const x of b.enemies) if (x.alive && x !== e) b.kill(x); b.step(); } };
  e.x = near[1] + 1; e.y = near[0] + 1; run(.25); // diagonal neighbour
  assert.equal(b.placementError(op, ...near), DENIED, 'diagonal tile is inside the 3x3');
  assert.equal(b.placementError(op, ...far), null, 'outside the 3x3');
  e.x = far[1]; e.y = far[0];
  assert.equal(b.placementError(op, ...near), DENIED, 'the zone moves only on the next 0.2 s trigger');
  run(.25);
  assert.equal(b.placementError(op, ...near), null); assert.equal(b.placementError(op, ...far), DENIED, 'its own tile');
  b.kill(e); run(.1);
  assert.equal(b.placementError(op, ...far), null, 'lifted on death');
  assert.deepEqual(b.errors, []);
});
