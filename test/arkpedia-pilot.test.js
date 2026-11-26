// SPDX-License-Identifier: GPL-3.0-or-later
// Commander Ulšulah (shared/arkpedia/enemy-pilot-features.js, server/sim/content/arkpedia-enemy-spilot.js) and the
// Bloodcalling Altar's side of it: the upgrade, its Blood Amber, and the pilot's return.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import enemyNative from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import deviceNative from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import deviceTables from '../data/arkpedia-device-source.json' with { type: 'json' };
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { PILOT, pilotNative, pilotParams } from '../shared/arkpedia/enemy-pilot-features.js';
import { BLOOD_AMBER, bloodAltarNativeReviewed } from '../shared/arkpedia/stage-blood-altar.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const record = () => Object.values(ENEMY_RECORDS.enemies[PILOT].levels)[0];
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const battle = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
/** A stage with no waves. 13-17: one Altar at (1,7) facing UP; SE-8: three, at (5,1), (3,1) and (1,3). */
const quiet = async id => {
  const stage = clone(await load(id));
  for (const w of stage.geometry.waves) w.spawns = [];
  const b = battle(stage);
  b.life = 999;
  b.step();
  for (const e of b.enemies.filter(u => u.alive && !u.mem.stageDeviceId)) b._remove(e, 'withdraw', null, true);
  b.after(1e6, () => {}, { holdsBattle: true });
  return b;
};
const place = (b, r, c) => {
  const e = b.spawnEnemy(PILOT, { pos: [r, c] });
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true } });
  return e;
};
const strike = (b, e) => b.dealDamage(null, e, { amount: 1e7, type: 'true', sourceless: true });
const pilots = b => b.enemies.filter(e => e.alive && e.defId === PILOT);

test('Commander Ulšulah and the Altar\'s side of her are reviewed; changes are refused', () => {
  const r = record(), n = () => nativeComponents(enemyNative, PILOT);
  assert.equal(pilotNative(r, n()), true);
  assert.equal(pilotNative({ ...r, talents: { ...r.talents, bb: { 'Reborn.duration': 30 } } }, n()), false, 'a longer return');
  assert.equal(pilotNative({ ...r, skills: [{ ...r.skills[0], bb: { ...r.skills[0].bb, attack_speed: -50 } }] }, n()), false, 'a weaker aura');
  const prefab = 'dyn/battle/prefabs/enemies/enemy_1368_spilot.prefab';
  const wide = clone(enemyNative), circle = wide.prefabs[prefab].find(c => JSON.parse(c.originalJson).m_Radius !== undefined);
  circle.originalJson = JSON.stringify({ ...JSON.parse(circle.originalJson), m_Radius: Math.fround(2.5) });
  assert.equal(pilotNative(r, nativeComponents(wide, PILOT)), false, 'a wider aura');
  const nearest = clone(enemyNative), sel = nearest.prefabs[prefab].find(c => JSON.parse(c.originalJson)._buffKey === 'trap_bonore_spilot[mark]');
  sel.originalJson = JSON.stringify({ ...JSON.parse(sel.originalJson), _postFilter: 11 });
  assert.equal(pilotNative(r, nativeComponents(nearest, PILOT)), false, 'a return to the nearest Altar');
  const fast = clone(deviceTables);
  fast.devices.trap_125_bonore.talents[0].candidates[0].blackboard[0].value = 5;
  assert.equal(bloodAltarNativeReviewed(deviceNative, fast), false, 'an Altar making Amber every 5 s');
  const noMark = clone(deviceNative);
  noMark.prefabs.trap_125_bonore.components.find(c => c.object === 'Passive' && c.data._buffs).data._buffs.pop();
  assert.equal(bloodAltarNativeReviewed(noMark), false, 'an Altar the pilot cannot return to');
  assert.deepEqual(pilotParams(r), { initial: 10, cooldown: 20, duration: 10, aspd: -80, radius: Math.fround(1.7), returnDelay: 20 });
});

test('the cast: 10 s in, 10 s at the nearest Altar, ASPD -80 around her; the Altar then makes Blood Amber every 10 s', async () => {
  const b = await quiet('13-17');
  b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 99;
  let op = null;
  for (let r = 0; r < b.regularMapSize.rows && !op; r++) for (let c = 0; c < b.regularMapSize.cols && !op; c++)
    try { op = b.deployOperator('char_151_myrtle', r, c, 'UP'); } catch { op = null; }
  assert.ok(op, 'an operator is deployed');
  op.atkCd = 1e6;
  const e = place(b, op.tileR, op.tileC + 1 < b.regularMapSize.cols ? op.tileC + 1 : op.tileC - 1);
  e.profile.noAttack = true;
  const altar = b.stageBloodAltars.entries[0];
  const ambers = [];
  b.on('enemySpawn', ({ enemy }) => { if (enemy.defId === BLOOD_AMBER && enemy.mem.stageBranch) ambers.push(b.time); });
  assert.ok(until(b, () => !!op.findBuff('spilot:atk_speed_down'), 11));
  assert.ok(Math.abs(b.time - 10) < .05, `${b.time}`);
  assert.equal(op.findBuff('spilot:atk_speed_down').mods.aspd, -80);
  assert.equal(altar.upgraded, false);
  assert.ok(until(b, () => altar.upgraded, 21));
  assert.ok(Math.abs(b.time - 20) < .05, `${b.time}`);
  b.step();
  assert.equal(op.findBuff('spilot:atk_speed_down'), null, 'the aura ends with the cast');
  // The talent's clock started with the Altar: 30 s and 40 s each bring one Amber.
  until(b, () => b.time >= 40.1, 41);
  assert.deepEqual(ambers.map(t => Math.round(t)), [30, 40]);
  // No Altar is left to upgrade: no further cast.
  until(b, () => b.time >= 61, 62);
  assert.equal(b.enemies.some(u => u.defId === PILOT && u.findBuff('ab:timedCast')), false);
});

test('silence ends the cast: no upgrade; the next try comes a cooldown after the cast began', async () => {
  const b = await quiet('13-17');
  const e = place(b, 4, 4);
  const altar = b.stageBloodAltars.entries[0];
  assert.ok(until(b, () => !!e.findBuff('ab:timedCast'), 11));
  until(b, () => b.time >= 15, 16);
  b.addBuff(e, { key: 'test:silence', duration: 1, flags: { silence: true } });
  b.step();
  assert.equal(e.findBuff('ab:timedCast'), null);
  until(b, () => b.time >= 29.5, 30);
  assert.equal(altar.upgraded, false);
  assert.ok(until(b, () => !!e.findBuff('ab:timedCast'), 31));
  assert.ok(Math.abs(b.time - 30) < .05, `${b.time}`);
  assert.ok(until(b, () => altar.upgraded, 41));
});

test('killed, she returns 20 s later on the Altar\'s pilot branch; a marked Altar takes no second mark', async () => {
  const b = await quiet('13-17');
  const altar = b.stageBloodAltars.entries[0];
  const first = place(b, 4, 4), second = place(b, 4, 5);
  strike(b, first);
  assert.equal(first.alive, false);
  assert.equal(altar.pilotReturn?.left, 20);
  const t0 = b.time;
  strike(b, second);
  assert.equal(second.alive, false);
  assert.equal(second.mem.spilotReturnAltar, null, 'one stack: the second return is lost');
  assert.ok(until(b, () => pilots(b).length === 1, t0 + 21));
  assert.ok(Math.abs(b.time - t0 - 20) < .05, `${b.time - t0}`);
  const back = pilots(b)[0];
  assert.equal(back.mem.stageBranch, true);
  assert.equal(altar.pilotReturns, 1);
  // Reaching the exit is no kill: no return.
  b._remove(back, 'exit', null, true);
  assert.equal(altar.pilotReturn, null);
});

test('a destroyed Altar passes the return to another for a fresh 20 s; with none left the death is final', async () => {
  const b = await quiet('se-8');
  const e = place(b, 4, 6);
  strike(b, e);
  const marked = e.mem.spilotReturnAltar;
  assert.ok(marked);
  until(b, () => b.time >= 10, 11);
  b.stageBloodAltars.destroy(marked);
  const next = b.stageBloodAltars.entries.find(a => a.pilotReturn);
  assert.ok(next && next !== marked);
  assert.equal(next.pilotReturn.left, 20);
  const t0 = b.time;
  assert.ok(until(b, () => pilots(b).length === 1, t0 + 21));
  assert.ok(Math.abs(b.time - t0 - 20) < .05, `${b.time - t0}`);
  for (const a of b.stageBloodAltars.entries) b.stageBloodAltars.destroy(a);
  strike(b, pilots(b)[0]);
  assert.equal(b.stageBloodAltars.entries.some(a => a.pilotReturn), false);
  until(b, () => b.time >= t0 + 50, t0 + 51);
  assert.equal(pilots(b).length, 0);
});

for (const id of ['13-17', '13-17_adverse_environment', '13-18', '13-18_adverse_environment', 'se-8']) {
  test(`headless ${id} clears with Ulšulah upgrading Altars and returning`, async () => {
    const b = battle(await load(id));
    b.life = 999;
    let returned = 0, ambers = 0;
    b.on('enemySpawn', ({ enemy: e }) => {
      if (e.defId === PILOT) { if (e.mem.stageBranch) returned++; return; }
      if (e.defId === BLOOD_AMBER && e.mem.stageBranch) ambers++;
      b.after(.5, () => e.alive && strike(b, e));
    });
    let last = 0;
    while (!b.finished && b.time < 900) {
      b.step();
      // Let her finish a cast first, then knock her out every 40 s.
      if (b.time - last >= 40) { last = b.time; for (const e of pilots(b)) if (!e.s.flags.untargetable) strike(b, e); }
    }
    assert.equal(b.reason, 'cleared');
    assert.ok(b.stageBloodAltars.entries.some(a => a.upgraded), 'an Altar upgraded');
    assert.ok(returned > 0, 'she returned');
    if (id !== 'se-8') assert.ok(ambers > 0, 'an upgraded Altar made Amber');
  });
}
