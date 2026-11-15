// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1329_cbshld', 'enemy_1329_cbshld_2'];
function fixture(id) {
  const target = chessRec({ id: 'screen_target', stats: { atk: 0, maxHp: 1e6 } });
  const record = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]);
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120,
    defs: { chess: { [target.chessId]: target }, enemies: { [id]: record } },
    units: [{ chessId: target.chessId, row: 9, col: 6 }], setup: installEnemyFeatures });
  const b = h.b; b.start(); const u = b.allyUnits[0];
  b.addBuff(u, { key: 'test:hold', flags: { disarm: true, noBlock: true } });
  const e = b.spawnEnemy(id, { pos: [9, 7], route: { motion: 'WALK', start: [9, 7], end: [9, 2], checkpoints: [] } });
  b.addBuff(e, { key: 'test:hold', flags: { disarm: true, noMove: true } });
  return { h, b, u, e, record };
}

test('Arc Screenguards lose flat DEF and RES only after each damage instance, with independent bounded stacks', () => {
  for (const id of ids) {
    const { b, u, e, record } = fixture(id), max = record.talents.bb['def_reduce.max_stack_cnt'];
    b.dealDamage(u, e, { amount: 3400, type: 'phys' });
    assert.equal(e.stats.taken, Math.max(3400 * .05, 3400 - record.stats.def));
    assert.equal(e.s.def, record.stats.def, 'first count is retained without changing stats');
    assert.equal(e.s.res, record.stats.res);
    b.dealDamage(u, e, { amount: 1, type: 'true' });
    assert.equal(e.s.def, record.stats.def - 100, 'second count activates both stacks after damage');
    assert.equal(e.s.res, record.stats.res - 4);
    const second = b.spawnEnemy(id, { pos: [9, 8], route: 0 });
    assert.equal(second.findBuff('ab:defDecay'), null);
    for (let i = 2; i < max + 10; i++) b.dealDamage(null, e, { amount: 1, type: 'true', sourceless: true });
    const buff = e.findBuff('ab:defDecay');
    assert.equal(buff.stacks, max); assert.equal(buff.mods.defFlat, -50); assert.equal(buff.mods.resFlat, -2);
    assert.equal(second.s.def, record.stats.def);
    assert.deepEqual(b.errors, []);
  }
});

test('silence does not stop decay; elemental buildup, cancelled hits and invulnerability do not add stacks', () => {
  const { b, u, e, h } = fixture(ids[0]);
  b.applyStatus(e, 'silence', { duration: 20 });
  b.dealDamage(u, e, { amount: 1, type: 'true' });
  assert.equal(e.findBuff('ab:defDecay').stacks, 1);
  b.dealDamage(u, e, { amount: 1, type: 'element', element: 'erosion' });
  assert.equal(e.findBuff('ab:defDecay').stacks, 1);
  b.addBuff(e, { key: 'test:invincible', flags: { invulnerable: true } });
  b.dealDamage(u, e, { amount: 10, type: 'true' });
  assert.equal(e.findBuff('ab:defDecay').stacks, 1);
  b.removeBuff(e, 'test:invincible');
  const hook = b.on('hit', c => { if (c.target === e) c.cancel = true; }, { priority: 1000 });
  b.dealDamage(u, e, { amount: 10, type: 'true' }); b.off(hook);
  assert.equal(e.findBuff('ab:defDecay').stacks, 1);
  h.run(5); assert.equal(e.findBuff('ab:defDecay').stacks, 1);
  assert.deepEqual(b.errors, []);
});

test('the native contract admits both source records and refuses changed attacks, modifiers, stack rules or extra actions', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy);
  const path = `dyn/battle/prefabs/enemies/${ids[0]}.prefab`;
  const mutations = [
    n => { n.templates.enemy_cbshld_t.eventToActions.ON_TAKE_DAMAGE[1]._formulaType = 'MULTIPLIER'; },
    n => { n.templates.enemy_cbshld_t.eventToActions.ON_TAKE_DAMAGE[0]._buff.maxStackCnt = 200; },
    n => { n.templates.enemy_cbshld_t.eventToActions.ON_TAKE_DAMAGE.push({ $type: 'extra damage' }); },
    n => { n.templates.enemy_cbshld_t.eventToActions.ON_BUFF_START[2]._buff.attributes.attributeModifiers.push({ attributeType: 'ATK' }); },
    n => { const row = n.prefabs[path].find(c => c.objectName === 'Combat' && !c.referenced); const d = JSON.parse(row.originalJson); d._atkScale = 2; row.originalJson = JSON.stringify(d); },
    n => { const row = n.prefabs[path].find(c => c.objectName === 'def_reduce' && !c.referenced); const d = JSON.parse(row.originalJson); d._buffs[0].isSilenceable = 1; row.originalJson = JSON.stringify(d); },
  ];
  for (const mutate of mutations) { const changed = structuredClone(native); mutate(changed); assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]], clock.prefabs, changed).policy, null); }
  const changed = structuredClone(ENEMY_RECORDS.enemies[ids[0]]); changed.levels[0].talents.bb['def_reduce.max_stack_cnt']++;
  assert.equal(enemySupport(changed, clock.prefabs, native).policy, null);
});
