// SPDX-License-Identifier: GPL-3.0-or-later
// Shieldguard (trap_024_npcsld): shared/arkpedia/stage-shieldguard.js, server/sim/content/arkpedia-stage-shieldguards.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../data/arkpedia-device-source.json' with { type: 'json' };
import { shieldguardNativeReviewed, shieldguardDefinition } from '../shared/arkpedia/stage-shieldguard.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const KEY = 'trap_024_npcsld';
const clone = v => JSON.parse(JSON.stringify(v));
const battle = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
const guards = b => b.allyUnits.filter(u => u.alive && u.def?.id === KEY);

test('the Shieldguard prefab, skill and record are reviewed; changes are refused', () => {
  assert.equal(shieldguardNativeReviewed(), true);
  const n = clone(native), selector = n.prefabs[KEY].components.find(c => '_targetMotion' in c.data);
  selector.data._targetMotion = 3;
  assert.equal(shieldguardNativeReviewed(n), false, 'a selector that also hits flying enemies');
  const n2 = clone(native); n2.prefabs[KEY].components.find(c => c.data._buffs?.[0]?.buffKey === 'hpsts_unhealable').data._buffs[0].attributes.abnormalFlags = [];
  assert.equal(shieldguardNativeReviewed(n2), false, 'a healable guard');
  const t = clone(tables); t.skills.sktok_npcsld.levels[0].blackboard[0].value = 2;
  assert.equal(shieldguardNativeReviewed(native, t), false, 'a changed taunt');
  const t2 = clone(tables); t2.devices[KEY].phases[0].attributesKeyFrames[1].data.atk = 900;
  assert.equal(shieldguardNativeReviewed(native, t2), false, 'stats that grow with level');
  const d = shieldguardDefinition({ level: 30, skillLevel: 1, direction: 'RIGHT' });
  assert.deepEqual([d.hp, d.atk, d.def, d.res, d.block, d.bat, d.taunt], [20000, 700, 1000, 60, 3, 4, 1]);
  assert.deepEqual(shieldguardDefinition({ level: 1, skillLevel: 1, direction: 'UP' }).atk, 700);
  assert.throws(() => shieldguardDefinition({ level: 30, skillLevel: 2, direction: 'RIGHT' }));
});

test('M8-6 places four Shieldguards that block, strike blocked ground enemies every 4 s and draw attacks', async () => {
  for (const id of ['m8-6_challenge_mode', 'vi-1', 'vi-1_challenge_mode']) assert.ok((await load(id)).devices.some(d => d.key === KEY), id);
  const stage = await load('m8-6'), b = battle(stage);
  b.life = 999;
  const g = guards(b);
  assert.deepEqual(g.map(u => [u.tileR, u.tileC]).sort(), [[5, 2], [5, 3], [5, 4], [5, 5]]);
  for (const u of g) {
    assert.deepEqual([u.side, u.s.maxHp, u.s.atk, u.s.def, u.s.res, u.s.blockCnt, u.s.interval, u.s.taunt], ['ally', 20000, 700, 1000, 60, 3, 4, 1]);
    assert.equal(u.profile.noHeal, true); assert.equal(u.profile.canHitFly, false); assert.equal(u.profile.characterLikeDevice, true);
  }
  const hits = new Map(), blocked = new Set(); let taken = 0;
  b.on('damaged', c => {
    if (c.source?.def?.id === KEY) {
      assert.equal(c.type, 'phys'); assert.equal(c.target.side, 'enemy');
      assert.equal(Math.round(c.target.y), c.source.tileR); assert.equal(Math.round(c.target.x), c.source.tileC);
      (hits.get(c.source) ?? hits.set(c.source, []).get(c.source)).push(b.time);
    }
    if (c.target?.def?.id === KEY && c.amount > 0) taken++;
  });
  while (!b.finished && b.time < 200) {
    b.step();
    for (const e of b.enemies) if (e.alive && e.blockedBy?.def?.id === KEY) blocked.add(e.defId);
  }
  assert.ok(blocked.size >= 2, [...blocked].join());
  assert.ok(taken > 0, 'enemies attack the guards');
  const times = [...hits.values()].find(t => t.length >= 4);
  assert.ok(times, 'one guard strikes repeatedly');
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 4 - 1e-6, `${times[i - 1]} -> ${times[i]}`);
  assert.ok(times.slice(1).some((t, i) => t - times[i] < 4.1), 'a guard with a target attacks every 4 s');
});

test('a hidden Shieldguard appears when a wave action names its alias', async () => {
  const stage = clone(await load('m8-6'));
  const i = stage.devices.findIndex(d => d.key === KEY);
  stage.devices[i] = { ...stage.devices[i], hidden: true, alias: 'trap_024_npcsld#test', scheduledActivation: true };
  const b = battle(stage);
  assert.equal(guards(b).length, 3);
  b.activateStagePredefined('trap_024_npcsld#test');
  assert.equal(guards(b).length, 4);
  b.activateStagePredefined('trap_024_npcsld#test');
  assert.equal(guards(b).length, 4, 'once only');
});
