// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clock from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemyStealthed } from '../server/sim/targeting.js';
const ids = ['enemy_1207_sfji', 'enemy_1207_sfji_2'];
function fixture(id, block = false) {
  const record = ENEMY_RECORDS.enemies[id].levels[0], child = record.talents.bbStr['DeadSpawn.enemy_key'];
  const op = chessRec({ id: 'wine_blocker', stats: { maxHp: 100000, atk: 0, def: 0 } });
  const h = makeBattle({ content: 'none', timeLimit: 60, autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: { [id]: record, [child]: ENEMY_RECORDS.enemies[child].levels[0] }, chess: { [op.chessId]: op } },
    units: block ? [{ chessId: op.chessId, row: 10, col: 6 }] : [] });
  const b = h.b; b.start(); const e = b.spawnEnemy(id, { pos: [10, 6] });
  b.addBuff(e, { key: 'stationary', flags: { noMove: true } });
  return { h, b, e, record, child };
}
test('both broken-blade enemies enhance exactly four strikes, then lose the bonus and restart their attack interval', () => {
  for (const id of ids) {
    const { h, b, e, record } = fixture(id, true), hits = [], atk = record.talents.bb['Atkup.atk'] ?? record.talents.bb['AtkUp.atk'];
    assert.equal(e.s.atk, record.stats.atk * (1 + atk));
    b.on('hit', c => { if (c.source === e) hits.push({ amount: c.dmg.amount, time: b.time }); });
    b.applyStatus(e, 'silence', { duration: 30 }); h.run(12);
    assert.ok(hits.length >= 6);
    for (let i = 0; i < 4; i++) assert.equal(hits[i].amount, record.stats.atk * (1 + atk));
    for (const hit of hits.slice(4)) assert.equal(hit.amount, record.stats.atk);
    assert.ok(Math.abs(hits[4].time - hits[3].time - .8) < b.dt * 2);
    assert.equal(e.mem.brokenBlades.left, 0); assert.equal(e.findBuff('ab:brokenBlades'), null);
    assert.deepEqual(b.errors, []);
  }
});
test('remaining blades determine delayed children, with a minimum of one and retained routes', () => {
  for (const id of ids) for (let spent = 0; spent <= 4; spent++) {
    const { h, b, e, child } = fixture(id);
    for (let n = 0; n < spent; n++) b.emit('attack', { attacker: e, targets: [], isSkill: false });
    const source = [e.y, e.x]; b.kill(e); b.kill(e);
    assert.equal(b.enemies.filter(u => u.defId === child).length, 0);
    const born = []; b.on('enemySpawn', ({ enemy }) => { born.push([enemy.y, enemy.x]); b.addBuff(enemy, { key: 'hold', flags: { noMove: true } }); });
    h.run(.8); const children = b.enemies.filter(u => u.defId === child);
    assert.equal(children.length, Math.max(1, 4 - spent));
    assert.ok(born.every(p => p.every((v, i) => Math.abs(v - source[i]) <= .5)));
    assert.ok(children.every(u => u.route.legs.length && u.defId === child));
    assert.deepEqual(b.errors, []);
  }
});
test('leaked blades never summon and deferred fragments hold battle completion', () => {
  const { h, b, e, child } = fixture(ids[0]); b.leak(e); h.run(1);
  assert.equal(b.enemies.filter(u => u.defId === child).length, 0);
  const fresh = b.spawnEnemy(ids[0], { pos: [10, 6] }); b.autoFinish = true; b.kill(fresh);
  b.step(); assert.equal(b.finished, false); h.run(.8);
  assert.equal(b.enemies.filter(u => u.defId === child && u.alive).length, 4);
  assert.deepEqual(b.errors, []);
});
test('falling through a source hole keeps kill credit but does not create blade fragments', () => {
  const { h, b, e, child } = fixture(ids[0]);
  b.grid.setTile(10, 7, { ...b.grid.tile(10, 7), key: 'tile_hole' });
  b.displace(e, { x: 1, y: 0 }, 1, { onFall: victim => b.kill(victim) });
  assert.equal(e.alive, false); assert.equal(b.killed, 1); h.run(1);
  assert.equal(b.enemies.filter(u => u.defId === child).length, 0); assert.deepEqual(b.errors, []);
});
test('native gates reject changed bonus, fragment floor, timing and unreviewed mode transitions', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy);
  for (const change of ['bonus', 'floor', 'delay', 'mode']) {
    const n = structuredClone(native), t = n.templates['enemy_dead_spawn[sfji]'].eventToActions;
    if (change === 'floor') t.ON_OWNER_KILLED[0]._succeedNodes[0]._value = 2;
    if (change === 'delay') t.ON_OWNER_KILLED[3]._randomDelayRange = 1;
    if (change === 'mode') t.ON_ABILITY_FINISH[2]._modeIndex = 0;
    if (change === 'bonus') for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${ids[0]}.prefab`]) {
      const d = JSON.parse(row.originalJson); if (d._buffs?.[0]?.buffKey === 'enemy_sfji_atkup') d._buffs[0].attributes.attributeModifiers[0].formulaItem = 3;
      row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]], clock.prefabs, n).policy, null, change);
  }
});

test('both lamp bearers cast through silence and maintain a three-second live range aura', () => {
  for (const id of ['enemy_1209_sfden', 'enemy_1209_sfden_2']) {
    const { h, b, e, child } = fixture(id), target = b.spawnEnemy(child, { pos: [10, 7] });
    b.addBuff(target, { key: 'hold', flags: { noMove: true, untargetable: true } });
    b.applyStatus(e, 'silence', { duration: 30 });
    h.run(5.6); assert.equal(enemyStealthed(target), false); h.run(.2); assert.equal(enemyStealthed(target), true);
    assert.equal(enemyStealthed(e), false, 'aura excludes its source');
    target.x = 9; h.run(.1); assert.equal(enemyStealthed(target), false);
    target.x = 7; h.run(.1); assert.equal(enemyStealthed(target), true);
    target.blockedBy = { alive: true }; assert.equal(enemyStealthed(target), false);
    target.blockedBy = null; assert.equal(enemyStealthed(target), true, 'no three-second restoration delay');
    h.run(2.6); assert.equal(enemyStealthed(target), true); h.run(.3); assert.equal(enemyStealthed(target), false);
    h.run(12); assert.equal(enemyStealthed(target), true, 'independent cooldown continues through the cast');
    b.kill(e); assert.equal(enemyStealthed(target), false); h.run(.8);
    assert.equal(b.enemies.filter(u => u.defId === child).length, 2); assert.deepEqual(b.errors, []);
  }
});
test('stun before the lamp release cancels the aura; overlapping lamps own independent cleanup', () => {
  const { h, b, e, child } = fixture('enemy_1209_sfden_2');
  const target = b.spawnEnemy(child, { pos: [10, 7] }); b.addBuff(target, { key: 'hold', flags: { noMove: true } });
  h.run(5.2); assert.equal(e.profile.noAttack, true); b.applyStatus(e, 'stun', { duration: 1 });
  h.run(1); assert.equal(enemyStealthed(target), false); assert.equal(e.profile.noAttack, false);
  const other = b.spawnEnemy('enemy_1209_sfden_2', { pos: [10, 6] }); b.addBuff(other, { key: 'hold', flags: { noMove: true } });
  // Align the second cast's initial clock with the first bearer's next cast.
  other.mem.ab.list.find(a => a.clocks).clocks[0] = 20 - b.time;
  h.run(14.7); assert.equal(enemyStealthed(target), true);
  b.kill(e); assert.equal(enemyStealthed(target), true); b.kill(other); assert.equal(enemyStealthed(target), false);
  assert.deepEqual(b.errors, []);
});
test('lamp source contracts reject changed aura selection, silence policy and recovery', () => {
  for (const id of ['enemy_1209_sfden', 'enemy_1209_sfden_2']) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, native).policy);
  for (const field of ['_selfOption', '_ignoreSilence', '_durationKey']) {
    const n = structuredClone(native), id = 'enemy_1209_sfden_2';
    for (const row of n.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`]) {
      const d = JSON.parse(row.originalJson);
      if (field in d) d[field] = field === '_durationKey' ? 'otherDuration' : 0;
      row.originalJson = JSON.stringify(d);
    }
    assert.equal(enemySupport(ENEMY_RECORDS.enemies[id], clock.prefabs, n).policy, null, field);
  }
});
