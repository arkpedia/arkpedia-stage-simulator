// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
const ids = ['enemy_4007_murino', 'enemy_4007_murino_2'];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function fixture(id = ids[0], level = 0) {
  const op = chessRec({ id: 'supplier-target', stats: { maxHp: 1e7, atk: 0, def: 0 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 180,
    defs: { chess: { [op.chessId]: op }, enemies: { [id]: structuredClone(records.enemies[id].levels[level]) } },
    units: [[9, 3], [10, 5], [10, 8]].map(([row, col]) => ({ chessId: op.chessId, row, col })), setup: installEnemyFeatures });
  h.b.start(); const b = h.b, e = b.spawnEnemy(id, { pos: [9, 6] });
  b.addBuff(e, { key: 'test:hold', flags: { noMove: true } });
  for (const u of b.allyUnits) b.addBuff(u, { key: 'test:hold', flags: { disarm: true } });
  return { ...h, e, targets: b.allyUnits };
}
test('both Supplier variants and all levels require source facing, guard, combat and environment contracts', () => {
  for (const id of ids) assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features');
  for (const change of [
    n => n.templates.enemy_murino_t.eventToActions.ON_TAKE_DAMAGE[0]._faceIfSameCol = 'FRONT',
    n => n.templates.enemy_murino_t.eventToActions.ON_TAKE_DAMAGE[1]._damageMask = 'ALL',
    n => n.templates.enemy_murino_direction_listener.eventToActions.ON_BUFF_FINISH[0]._disabled = true,
    n => n.templates.enemy_murino_direction_listener.eventToActions.ON_BUFF_TRIGGER[0]._targetOptions.ignoreTargetFree = false,
    n => n.templates.cooperate_die_to_trigger_bonus.eventToActions.ON_OWNER_FINISH[5]._envKey = 'other',
    n => { const rows = n.prefabs['dyn/battle/prefabs/enemies/' + ids[0] + '.prefab'];
      const row = rows.find(r => r.referenced && JSON.parse(r.originalJson)._disableWhenBlocked === 1);
      const data = JSON.parse(row.originalJson); data._disableWhenBlocked = 0; row.originalJson = JSON.stringify(data); },
  ]) { const changed = structuredClone(native); change(changed);
    assert.equal(enemySupport(records.enemies[ids[0]], clocks.prefabs, changed).policy, null); }
});
test('Supplier shares the strongest frontal Sanctuary channel and preserves every variant stat', () => {
  for (const id of ids) for (const level of [0, 1]) {
    const { b, e, targets: [u] } = fixture(id, level), reduction = id.endsWith('_2') ? .95 : .85;
    assert.equal(e.hp, records.enemies[id].levels[level].stats.maxHp);
    assert.equal(e.def.attackAnim.dur, 1.5); assert.equal(e.def.attackAnim.hit, Math.fround(.4));
    e.x = 6.2; e.mem.nativeFacing = 1;
    const hit = (x, type = 'phys', sourceless = false) => { u.x = x; const hp = e.hp;
      b.dealDamage(u, e, { amount: 1000, type, sourceless }); return hp - e.hp; };
    near(hit(7), 1000 * (1 - reduction)); near(hit(7, 'arts'), 1000 * (1 - reduction));
    near(hit(6.4), 1000); near(hit(5), 1000); near(hit(7, 'true'), 1000); near(hit(7, 'phys', true), 1000);
    b.applyStatus(e, 'sanctuary', { value: .5, key: 'test:ordinary' });
    near(hit(7), 1000 * (1 - reduction)); near(hit(5), 500);
    b.applyStatus(e, 'silence', { duration: 2 }); near(hit(7), 1000 * (1 - reduction));
    assert.equal(e.s.flags.unblockable, undefined); assert.deepEqual(b.errors, []);
  }
});
test('unblocked crowd polling counts untargetable and flying operators, excludes tokens, and keeps ties', () => {
  const { b, e, run, targets: [left, other, right] } = fixture();
  b.addBuff(left, { key: 'test:free', flags: { untargetable: true } }); right.motion = 'FLY';
  run(.29); assert.equal(e.mem.nativeFacing, 1); run(.05); assert.equal(e.mem.nativeFacing, -1);
  other.kind = 'token'; run(.35); assert.equal(e.mem.nativeFacing, -1);
  left.x = e.x; run(.35); assert.equal(e.mem.nativeFacing, 1);
  assert.equal(e.stats.attacks, 0); assert.deepEqual(b.errors, []);
});
test('blocking stops crowd turning, normal combat faces the blocker, and release starts a fresh poll', () => {
  const { b, e, run, targets: [left, other, right] } = fixture(); run(.35); assert.equal(e.mem.nativeFacing, -1);
  // Place the enemy just left of the existing right-hand operator, inside its collision radius.
  e.x = right.x - .3; e.y = right.y; e.tileR = right.tileR; e.tileC = right.tileC;
  b._checkBlock(e); assert.equal(e.blockedBy, right); e.atkCd = 0;
  const hp = right.hp; run(.1); assert.equal(e.mem.nativeFacing, 1); assert.ok(right.hp < hp);
  assert.ok(e.stats.attacks > 0); run(.5); assert.equal(e.mem.nativeFacing, 1);
  b._unblock(e); e.x = 6; e.y = 9; e.tileR = 9; e.tileC = 6;
  run(.2); assert.equal(e.mem.nativeFacing, 1); run(.15); assert.equal(e.mem.nativeFacing, -1);
  assert.deepEqual(b.errors, []);
});
test('death dispatches one native environment trigger, including falls; leaks and removals do not', () => {
  for (const id of ids) for (const reason of ['killed', 'fall', 'leak', 'retreat']) {
    const { b, e } = fixture(id), events = [];
    b.on('stageEnvironmentTrigger', event => events.push(event));
    if (reason === 'killed' || reason === 'fall') { if (reason === 'fall') e.mem.deathByFall = true; b.kill(e); b.kill(e); }
    else if (reason === 'leak') b.leak(e); else b._remove(e, 'retreat', null, true);
    assert.equal(events.length, ['killed', 'fall'].includes(reason) ? 1 : 0);
    if (events.length) assert.deepEqual(events[0], { key: 'env_010_cooperate', source: e, eventName: null });
    assert.deepEqual(b.errors, []);
  }
});
