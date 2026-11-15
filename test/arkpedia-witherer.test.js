// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { corruptionZone } from '../server/sim/content/arkpedia-corruption.js';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ID = 'enemy_1267_nhpbr';
function fixture(record = ENEMY_RECORDS.enemies[ID].levels[0]) {
  const guard = chessRec({ id: 'corruption_target', stats: { maxHp: 1e6, atk: 0 }, skill: { spType: 'INCREASE_WHEN_TAKEN_DAMAGE' } });
  const h = makeBattle({ content: 'generic', autoFinish: false, captureNoisy: true,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [record.key]: record } },
    units: [{ chessId: guard.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  h.b.start(); const u = h.b.allyUnits[0];
  h.b.addBuff(u, { key: 'no-combat', flags: { disarm: true, noBlock: true, noMove: true } });
  const e = h.b.spawnEnemy(record.key, { pos: [9, 7] });
  return { h, b: h.b, u, e };
}
test('Witherer leaves a source-owned True-damage pool only when killed and not silenced', () => {
  for (const mode of ['normal', 'silenced', 'leaked']) {
    const { h, b, u, e } = fixture();
    if (mode === 'silenced') b.applyStatus(e, 'silence', 10);
    if (mode === 'leaked') b._remove(e, 'leak'); else b.kill(e);
    const hp = u.hp; h.run(3.05);
    assert.equal(hp - u.hp, mode === 'normal' ? 150 : 0, mode);
    assert.equal(u.skill.sp, 0, 'corruption cannot charge defensive SP');
    const hits = h.hooksOf('damaged').filter(c => c.dmg.tags.includes('corruption'));
    assert.ok(hits.every(c => c.source === e && c.dmg.type === 'true' && c.dmg.noSp && !c.dmg.isAttack && !c.dmg.isEnvironment));
    assert.deepEqual(b.errors, []);
  }
});
test('native fixed 1.7 radius excludes the unused 2-tile blackboard range; entering starts its own clock', () => {
  const { h, b, u, e } = fixture(); e.x = u.x + 1.8; b.kill(e);
  h.run(1.2); assert.equal(u.stats.taken, 0);
  u.x += .2; h.run(.95); assert.equal(u.stats.taken, 0);
  h.run(.1); assert.equal(u.stats.taken, 50);
  u.x -= .2; h.run(1.1); assert.equal(u.stats.taken, 50); assert.equal(u.findBuff('ab:corruption'), null);
  u.x += .2; h.run(.9); assert.equal(u.stats.taken, 50); h.run(.2); assert.equal(u.stats.taken, 100);
  assert.deepEqual(b.errors, []);
});
test('shared corruption counts one pulse through overlaps, reaches airborne/invisible allies and reads root-tile height', () => {
  const { h, b, u, e } = fixture();
  b.addBuff(u, { key: 'airborne', flags: { liftoff: true, stealth: true, untargetable: true } });
  b.kill(e); corruptionZone(b, e, u.x, u.y, 1.7, 8, 50, 25);
  h.run(2.05); assert.equal(u.stats.taken, 100); assert.equal(u.skill.sp, 0);
  assert.equal(u.buffs.filter(v => v.key === 'ab:corruption').length, 1);
  // The fixture's upper row is high ground; root-tile height, not flight, chooses damage.
  u.tileR = 8; u.y = 8; h.run(1); assert.equal(u.stats.taken, 125);
  h.run(7); const damage = u.stats.taken; h.run(2); assert.equal(u.stats.taken, damage);
  assert.equal(u.findBuff('ab:corruption'), null); assert.deepEqual(b.errors, []);
});
test('11-2 adverse scales only existing declared corruption parameters, preserving source records', async () => {
  const c = await loadContentContext(), p = await planStage(c, '11-2_adverse_environment'); assert.deepEqual(p.blockers, []);
  const r = p.stage.enemies[ID + '_2'];
  assert.equal(r.talents.bb['PollutedDie.polluted_damage_low'], 200);
  assert.equal(r.talents.bb['PollutedDie.polluted_damage_high'], 100);
  assert.equal(c.records.enemies[ID].levels[0].talents.bb['PollutedDie.polluted_damage_low'], 50);
  const { h, b, u, e } = fixture(r); b.kill(e); h.run(1.1); assert.equal(u.stats.taken, 200);
  assert.deepEqual(b.errors, []);
});
test('native admission rejects altered radius, damage classification, selector and Silence predicate', () => {
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[ID], clock.prefabs, native).policy);
  for (const change of ['radius', 'motion', 'damage', 'silence']) {
    const n = structuredClone(native);
    for (const row of n.projectiles.projectile_enemy_nhpbr_polluted) {
      const v = JSON.parse(row.originalJson);
      if (change === 'radius' && 'm_Radius' in v) v.m_Radius = 2;
      if (change === 'motion' && '_targetOptions' in v) v._targetOptions.targetMotion = 1;
      row.originalJson = JSON.stringify(v);
    }
    if (change === 'damage') n.templates.polluted_area.eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[0]._ignoreForSp = false;
    if (change === 'silence') n.templates.projectile_on_killed.eventToActions.ON_OWNER_KILLED[0]._isUnset = false;
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ID], clock.prefabs, n).policy, null, change);
  }
});
