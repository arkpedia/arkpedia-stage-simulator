// SPDX-License-Identifier: GPL-3.0-or-later
// Bloodcalling Altar (shared/arkpedia/stage-blood-altar.js, server/sim/content/arkpedia-stage-blood-altars.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../data/arkpedia-device-source.json' with { type: 'json' };
import { bloodAltarNativeReviewed, bloodAltarDefinition, BLOOD_AMBER } from '../shared/arkpedia/stage-blood-altar.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StageBloodAltars } from '../server/sim/content/arkpedia-stage-blood-altars.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const battle = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
const amber = (b, r, c) => {
  const e = b.spawnEnemy(BLOOD_AMBER, { pos: [r, c], countInTotal: false });
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true } });
  return e;
};

test('the Altar prefab, pulse and templates are reviewed; changes are refused', () => {
  assert.equal(bloodAltarNativeReviewed(), true);
  const speed = clone(native); speed.prefabs.projectile_trap_bonore.components.find(c => '_speed' in c.data).data._speed = 6;
  assert.equal(bloodAltarNativeReviewed(speed), false, 'a slower pulse');
  const box = clone(native); box.prefabs.projectile_trap_bonore.components.find(c => c.data.m_Size).data.m_Size = { x: 3, y: 3 };
  assert.equal(bloodAltarNativeReviewed(box), false, 'a wider pulse');
  const lanes = clone(native); lanes.prefabs.trap_125_bonore.components.find(c => '_offset' in c.data).data._offset = 0;
  assert.equal(bloodAltarNativeReviewed(lanes), false, 'a one-lane range');
  const many = clone(native); many.prefabs.projectile_trap_bonore.components.find(c => '_maxHitNum' in c.data).data._maxHitNum = 2;
  assert.equal(bloodAltarNativeReviewed(many), false, 'a pulse that hits twice');
  const block = clone(native); block.templates['trap_bonore_branch[dfello]'].eventToActions.ON_BUFF_START[0]._blockGameFinish = true;
  assert.equal(bloodAltarNativeReviewed(block), false, 'a branch that holds the end');
  const sp = clone(tables); sp.skills.sktok_bonore.levels[0].spData.spCost = 15;
  assert.equal(bloodAltarNativeReviewed(native, sp), false, 'a faster charge');
  assert.throws(() => bloodAltarDefinition({ level: 1, skillLevel: 1, direction: 'UP' }), /Unsupported/, 'no branch');
  const d = bloodAltarDefinition({ level: 1, skillLevel: 1, direction: 'UP', branchId: 'x' });
  assert.deepEqual([d.spCost, d.speed, d.lifetime, d.length, d.width, d.maxTargets], [20, 8, 10, 1, 3, 10]);
});

test('13-12 places two untargetable enemy-side Altars, each with its own branch', async () => {
  await load('13-12_adverse_environment');
  const b = battle(await load('13-12'));
  const a = b.stageBloodAltars.entries;
  assert.deepEqual(a.map(x => [x.row, x.col, x.spec.direction, x.spec.branchId]), [[6, 4, 'DOWN', 'bonore_dfello1'], [4, 9, 'LEFT', 'bonore_dfello2']]);
  for (const x of a) assert.deepEqual([x.unit.side, !!x.unit.s.flags.untargetable, !!x.unit.s.flags.invulnerable], ['enemy', true, true]);
});

test('a pulse ends at its first contact, taking the Blood Amber in its box (3 lanes across, 1 along), each becoming a Bloodborn Spawn', async () => {
  const b = battle(await load('13-12'));
  b.life = 999;
  // The first Altar (6,4) faces DOWN (row 0 is the bottom): its pulse sweeps columns 3-5 below it. Two Amber share
  // (4,4) and one stands beside them at (4,5), in a side lane; (2,4) lies two tiles past the box when it first touches
  // them; (2,7) lies off both Altars' lanes (the second Altar, (4,9) facing LEFT, sweeps rows 3-5).
  const first = amber(b, 4, 4), twin = amber(b, 4, 4), side = amber(b, 4, 5), past = amber(b, 2, 4), beside = amber(b, 2, 7);
  const branch = [];
  b.on('enemySpawn', ({ enemy: e }) => { if (e.mem.stageBranch) branch.push({ t: b.time, id: e.defId }); });
  while (b.time < 19.9) b.step();
  assert.ok([first, twin, side, past, beside].every(e => e.alive), 'nothing before 20 SP');
  while (b.time < 20.6) b.step();
  assert.deepEqual([first.alive, twin.alive, side.alive, past.alive, beside.alive], [false, false, false, true, true]);
  const spawns = branch.filter(s => s.t >= 20 && s.t < 20.6);
  assert.equal(spawns.length, 3);
  assert.ok(spawns.every(s => s.id === 'enemy_1360_dfello'));
  assert.equal(b.stageBloodAltars.entries[0].conversions, 3);
  // The next pulse (40 s) reaches the Amber left at (2,4); the one at (2,7) stays.
  while (b.time < 40.8) b.step();
  assert.equal(past.alive, false);
  assert.equal(beside.alive, true);
});

test('a pulse converts at most 10, and a stage with unmodelled pulse reactions is refused', async () => {
  const stage = await load('13-12');
  const b = battle(stage);
  b.life = 999;
  const pile = Array.from({ length: 12 }, () => amber(b, 2, 4)); // the first Altar's lane only
  while (b.time < 20.6) b.step();
  assert.equal(pile.filter(e => !e.alive).length, 10);
  assert.equal(b.stageBloodAltars.entries[0].conversions, 10);
  const refused = { ...stage, enemies: { ...stage.enemies, enemy_1368_spilot: stage.enemies[BLOOD_AMBER] } };
  assert.throws(() => new StageBloodAltars(battle(stage), stage.devices, stage.geometry, refused), /not modelled: enemy_1368_spilot/);
});
