// SPDX-License-Identifier: GPL-3.0-or-later
// Sarkaz Bloodwalker / Bloodnexus, the Blood Collectors (shared/arkpedia/enemy-blood-collector-features.js,
// server/sim/content/arkpedia-enemy-blood-collector.js) and their Bloodcalling Altar reaction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import enemyNative from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { bloodCollectorNative, bloodCollectorParams } from '../shared/arkpedia/enemy-blood-collector-features.js';
import { BLOOD_AMBER } from '../shared/arkpedia/stage-blood-altar.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const COLLECTOR = 'enemy_1366_dcolle';
const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const record = id => Object.values(ENEMY_RECORDS.enemies[id].levels)[0];
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
/** 13-14 without its waves or predefined Amber: only the units a test places. */
const quiet = async () => {
  const stage = clone(await load('13-14'));
  for (const w of stage.geometry.waves) w.spawns = [];
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
  b.life = 999;
  // The stage's predefined units leave too (not the Altar, an enemy-side device).
  b.step();
  for (const e of b.enemies.filter(u => u.alive && !u.mem.stageDeviceId)) b._remove(e, 'withdraw', null, true);
  b.after(1e6, () => {}, { holdsBattle: true }); // nothing counted is left: keep the battle open
  return b;
};
const place = (b, key, r, c) => {
  const e = b.spawnEnemy(key, { pos: [r, c] });
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true } });
  return e;
};
const ambers = b => b.enemies.filter(e => e.alive && e.defId === BLOOD_AMBER);

test('the Collectors\' Collect talent is reviewed; changes are refused', () => {
  for (const id of [COLLECTOR, 'enemy_1366_dcolle_2']) assert.equal(bloodCollectorNative(record(id), nativeComponents(enemyNative, id)), true, id);
  const r = record(COLLECTOR), n = nativeComponents(enemyNative, COLLECTOR);
  assert.equal(bloodCollectorNative({ ...r, talents: { ...r.talents, bb: { 'Collect.max_stack_cnt': 6 } } }, n), false, 'a larger pouch');
  const wider = clone(enemyNative), pick = p => nativeComponents(p, COLLECTOR);
  const circle = p => { const x = pick(p); return x.$siblings(x.Collect.find(c => c._buffs)).find(c => 'm_Radius' in c); };
  const raw = wider.prefabs['dyn/battle/prefabs/enemies/enemy_1366_dcolle.prefab'];
  const row = raw.find(c => JSON.parse(c.originalJson).m_Radius === .5);
  row.originalJson = JSON.stringify({ ...JSON.parse(row.originalJson), m_Radius: 1 });
  assert.equal(circle(wider).m_Radius, 1);
  assert.equal(bloodCollectorNative(r, pick(wider)), false, 'a wider circle');
  const keep = clone(enemyNative);
  keep.templates['enemy_dcolle_bonore[action]'].eventToActions.ON_OWNER_KILLED[2]._summonCount = 0;
  assert.equal(bloodCollectorNative(r, pick(keep)), false, 'a Collector that drops nothing');
  assert.deepEqual(bloodCollectorParams(r), { max: 5, contact: .5 + Math.fround(.1), amber: BLOOD_AMBER });
});

test('Collect: Amber whose collider touches the circle is taken, at most 5; the rest stays', async () => {
  const b = await quiet();
  const c = place(b, COLLECTOR, 3, 4);
  for (let i = 0; i < 7; i++) place(b, BLOOD_AMBER, 3, 4.3);
  const far = place(b, BLOOD_AMBER, 3, 4 + .65);
  b.step();
  assert.equal(c.mem.bonoreMarks, 5);
  assert.equal(ambers(b).length, 3, 'two over the cap and the one out of reach');
  assert.equal(far.alive, true);
});

test('death: each held Amber is dropped on the Collector\'s route, but not after a fall', async () => {
  const b = await quiet();
  const c = place(b, COLLECTOR, 3, 4);
  for (let i = 0; i < 3; i++) place(b, BLOOD_AMBER, 3, 4);
  b.step();
  assert.equal(c.mem.bonoreMarks, 3);
  assert.equal(ambers(b).length, 0);
  b.kill(c, null);
  const dropped = ambers(b);
  assert.equal(dropped.length, 3);
  assert.ok(dropped.every(e => Math.abs(e.y - 3) < .01 && Math.abs(e.x - 4) < .3 && e.route), 'on its spot, following a route');
  const fell = place(b, COLLECTOR, 5, 6);
  place(b, BLOOD_AMBER, 5, 6); b.step();
  assert.equal(fell.mem.bonoreMarks, 1);
  fell.mem.deathByFall = true; b.kill(fell, null);
  assert.equal(ambers(b).length, 3, 'a fall drops nothing');
});

test('the Altar pulse turns a Collector\'s Amber into Spawn; it survives empty and collects again', async () => {
  const b = await quiet();
  const altar = b.stageBloodAltars.entries[0];
  assert.deepEqual([altar.row, altar.col, altar.spec.direction], [5, 1, 'RIGHT']);
  const c = place(b, COLLECTOR, 5, 4);
  for (let i = 0; i < 3; i++) place(b, BLOOD_AMBER, 5, 4);
  b.step();
  assert.equal(c.mem.bonoreMarks, 3);
  const spawned = [];
  b.on('enemySpawn', ({ enemy }) => { if (enemy.mem.stageBranch) spawned.push(enemy.defId); });
  assert.ok(until(b, () => altar.conversions > 0, 25));
  assert.ok(b.time > 20 && b.time < 20.5, `${b.time}`);
  assert.deepEqual(spawned, ['enemy_1360_dfello', 'enemy_1360_dfello', 'enemy_1360_dfello']);
  assert.equal(altar.conversions, 3);
  assert.equal(c.alive, true);
  assert.equal(c.mem.bonoreMarks, 0);
  place(b, BLOOD_AMBER, 5, 4); b.step();
  assert.equal(c.mem.bonoreMarks, 1, 'collects again');
  // The 40 s pulse takes the one it now holds.
  assert.ok(until(b, () => altar.conversions > 3, 45));
  assert.equal(altar.conversions, 4);
});

test('an empty Collector stops nothing: the pulse runs past it to the Amber beyond', async () => {
  const b = await quiet();
  const altar = b.stageBloodAltars.entries[0];
  const c = place(b, COLLECTOR, 5, 3);
  const beyond = place(b, BLOOD_AMBER, 5, 7);
  assert.ok(until(b, () => altar.conversions > 0, 25));
  assert.equal(beyond.alive, false);
  assert.equal(c.alive, true);
  assert.equal(c.mem.bonoreMarks, 0);
});

test('headless 13-14 clears with the Collectors feeding the Altar', async () => {
  const stage = await load('13-14');
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
  b.life = 999;
  b.on('enemySpawn', ({ enemy: e }) => {
    if (!/dseed|dcolle/.test(e.defId) && !e.mem.stageBranch) b.after(.5, () => e.alive && b.dealDamage(null, e, { amount: 1e7, type: 'true', sourceless: true }));
  });
  const seen = new Map();
  b.on('tick', () => { for (const e of b.enemies) if (e.defId === COLLECTOR && e.alive) seen.set(e.id, Math.max(seen.get(e.id) ?? 0, e.mem.bonoreMarks)); });
  until(b, () => false, 600);
  assert.equal(b.reason, 'cleared');
  assert.ok([...seen.values()].some(v => v > 0), 'a Collector held Amber');
  assert.ok(b.stageBloodAltars.entries[0].conversions >= 6);
});
