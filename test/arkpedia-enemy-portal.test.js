// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const portal = 'enemy_2067_skzcy', ids = ['char_123_fang', 'char_124_kroos', 'char_122_beagle'];
function fixture() {
  const b = new StandardBattle({ ...mvp, enemies: { ...mvp.enemies, [portal]: ENEMY_RECORDS.enemies[portal].levels[0] } },
    { operators: ids.map(id => defaultBuild(mvp.operators[id])) });
  b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const deploy = id => {
    for (let r = b.rect.r0; r <= b.rect.r1; r++) for (let c = b.rect.c0; c <= b.rect.c1; c++)
      if (!b.placementError(id, r, c)) return b.deployOperator(id, r, c, 'RIGHT');
    throw Error(`No fixture placement for ${id}`);
  };
  const spawn = () => b.spawnEnemy(portal, { pos: [b.rect.r0, b.rect.c0] });
  return { b, deploy, spawn };
}
test('Portal disables the newest-created eligible card for the battle, not for the ten-second birth alert', () => {
  const { b, deploy, spawn } = fixture(), older = deploy(ids[0]), newest = deploy(ids[1]);
  b.addBuff(older, { key: 'taunt', mods: { tauntLevel: 100 } });
  b.addBuff(newest, { key: 'hidden', flags: { stealth: true, camouflage: true, invulnerable: true } });
  const enemy = spawn(); b.kill(enemy, null); b.kill(enemy, null);
  assert.equal(older.alive, true); assert.equal(newest.alive, false);
  assert.equal(b.bench[ids[1]].removedFromDeck, true); assert.equal(b.bench[ids[1]].readyAt, Infinity);
  b.time += 1000;
  assert.match(b.placementError(ids[1], newest.tileR, newest.tileC), /removed from the squad/);
  assert.throws(() => b.deployOperator(ids[1], newest.tileR, newest.tileC, 'RIGHT'), /removed from the squad/);
  const outcomes = b.result().stageOutcomes;
  assert.deepEqual(outcomes.counters, { rogue_first_step: 1 });
  assert.equal(outcomes.events[0].operator, ids[1]); assert.equal(outcomes.events[0].operatorInstance, newest.id);
  assert.equal(fixture().b.bench[ids[1]].removedFromDeck, undefined); assert.deepEqual(b.errors, []);
});
test('Portal excludes flying operators and the source self-mark, then leaves an empty candidate list alone', () => {
  const { b, deploy, spawn } = fixture(), oldest = deploy(ids[0]), flying = deploy(ids[1]), marked = deploy(ids[2]);
  flying.motion = 'FLY'; b.addBuff(marked, { key: 'enemy_entlec_self_mark' });
  b.kill(spawn(), null); assert.equal(oldest.alive, false); assert.equal(flying.alive, true); assert.equal(marked.alive, true);
  b.kill(spawn(), null); assert.equal(b.result().stageOutcomes.events.length, 1);
  assert.deepEqual(b.errors, []);
});
test('leaking or expiring Portal does not dispatch its ON_OWNER_KILLED effect', () => {
  const { b, deploy, spawn } = fixture(), unit = deploy(ids[0]);
  b.leak(spawn()); b._remove(spawn(), 'expired');
  assert.equal(unit.alive, true); assert.deepEqual(b.result().stageOutcomes.events, []);
});
test('native skipReborn=false preserves an ordinary rebirth without restoring the removed card', () => {
  const { b, deploy, spawn } = fixture(), unit = deploy(ids[0]);
  let reborn = 0;
  b.on('kill', c => { if (c.victim === unit && reborn++ === 0) unit.hp = unit.s.maxHp; });
  b.kill(spawn(), null);
  assert.equal(unit.alive, true); assert.equal(b.bench[unit.defId].removedFromDeck, true);
  b.kill(unit, null); b.time += 100;
  assert.equal(b.bench[unit.defId].readyAt, Infinity);
  assert.match(b.placementError(unit.defId, unit.tileR, unit.tileC), /removed from the squad/);
});
test('Portal admission rejects selector, card lifetime, rebirth, event and buff contract drift', () => {
  const entry = ENEMY_RECORDS.enemies[portal]; assert.ok(enemySupport(entry, clocks.prefabs, native).policy);
  for (const mutation of ['random', 'profession', 'silence', 'duration', 'rebirth', 'extraEvent', 'buff']) {
    const evidence = structuredClone(native);
    for (const row of evidence.prefabs[`dyn/battle/prefabs/enemies/${portal}.prefab`]) {
      const d = JSON.parse(row.originalJson);
      if (row.objectName === 'Selector') {
        if (mutation === 'random') d._postFilter = 14;
        if (mutation === 'profession') d._professionMask = 1023;
      }
      if (mutation === 'silence' && row.objectName === '1') d._buffs[0].isSilenceable = 1;
      row.originalJson = JSON.stringify(d);
    }
    const actions = evidence.templates['skzcy_t[ban_card]'].eventToActions.ON_BUFF_START;
    if (mutation === 'duration') actions[0]._lifeType = 'LIMITED';
    if (mutation === 'rebirth') actions[4]._skipReborn = true;
    if (mutation === 'extraEvent') evidence.templates['skzcy_t[first_step]'].eventToActions.ON_OWNER_FINISH = [];
    if (mutation === 'buff') evidence.templates['skzcy_t[first_step]'].eventToActions.ON_OWNER_KILLED[0]._buff.attributes.abnormalFlags.push(1);
    assert.equal(enemySupport(entry, clocks.prefabs, evidence).policy, null, mutation);
  }
});
