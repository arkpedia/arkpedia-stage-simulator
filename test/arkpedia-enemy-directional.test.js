// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { spriteFacing } from '../shared/arkpedia/facing.js';
const ID = 'enemy_2085_skzjxd';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function fixture() {
  const guard = chessRec({ id: 'directional-target', stats: { maxHp: 1e7, atk: 100, def: 100, res: 20 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 180,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [ID]: structuredClone(records.enemies[ID].levels[0]) } },
    units: [[9, 3], [10, 5], [10, 8]].map(([row, col]) => ({ chessId: guard.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start();
  for (const u of b.allyUnits) b.addBuff(u, { key: 'test:hold', flags: { disarm: true } });
  const e = b.spawnEnemy(ID, { pos: [9, 6] }); b.addBuff(e, { key: 'test:stationary', flags: { noMove: true } });
  const a = e.mem.ab.list.find(a => 'poll' in a); return { h, b, e, a, targets: b.allyUnits };
}
test('all Fatty levels and the CN variant reuse one native prefab with fail-closed directional gates', () => {
  for (const id of [ID, `${ID}_2`]) assert.ok(enemySupport(records.enemies[id], clocks.prefabs, native).policy);
  for (const change of [n => { n.templates['skzjxd_t[shield]'].eventToActions.ON_TAKE_DAMAGE[0]._faceIfSameCol = 'FRONT'; },
    n => { n.templates['skzjxd_a[direction_listener]'].eventToActions.ON_BUFF_TRIGGER[0]._targetOptions.ignoreTargetFree = false; },
    n => { n.templates['skzjxd_t[show_trigger]'].eventToActions.ON_BUFF_TRIGGER[0]._checkSkillReady = true; }]) {
    const n = structuredClone(native); change(n); assert.equal(enemySupport(records.enemies[ID], clocks.prefabs, n).policy, null);
  }
});
test('facing polls every 0.3 seconds, counts untargetable operators, excludes summons and keeps ties', () => {
  const { h, b, e, targets: [left, other, right] } = fixture();
  b.addBuff(left, { key: 'test:camouflage', flags: { camou: true, untargetable: true } });
  assert.equal(e.mem.nativeFacing, 1); h.run(.29); assert.equal(e.mem.nativeFacing, 1);
  h.run(.05); assert.equal(e.mem.nativeFacing, -1);
  other.kind = 'token'; h.run(.35); assert.equal(e.mem.nativeFacing, -1);
  assert.equal(spriteFacing(e, { x: e.x - 1, facing: 1 }), -1);
  left.x = e.x; h.run(.35); assert.equal(e.mem.nativeFacing, 1);
  right.motion = 'FLY'; h.run(.35); assert.equal(e.mem.nativeFacing, 1); assert.deepEqual(b.errors, []);
});
test('front reduction uses grid columns; same-column, rear, True and sourceless damage bypass it', () => {
  const { b, e, targets: [source] } = fixture();
  e.x = 6.2; e.tileC = 6; e.mem.nativeFacing = 1;
  const hit = (x, type = 'phys', sourceless = false) => { source.x = x; const hp = e.hp;
    b.dealDamage(source, e, { amount: 1000, type, sourceless }); return hp - e.hp; };
  near(hit(7), 200); near(hit(7, 'arts'), 100); near(hit(6.4), 1000);
  near(hit(5), 1000); near(hit(7, 'true'), 1000); near(hit(7, 'phys', true), 1000);
  e.mem.nativeFacing = -1; near(hit(5), 200); near(hit(7), 1000); assert.deepEqual(b.errors, []);
});
test('conditional front and flying protection share the strongest Sanctuary channel', () => {
  const { b, e, targets: [source] } = fixture(); source.x = 8; source.motion = 'FLY'; e.mem.nativeFacing = 1;
  b.applyStatus(e, 'sanctuary', { value: .5, key: 'test:ordinary' });
  b.addBuff(e, { key: 'test:flying', status: 'sanctuary', data: { flyingSourceSanctuary: .9 } });
  let hp = e.hp; b.dealDamage(source, e, { amount: 1000, type: 'phys' }); near(hp - e.hp, 100);
  source.motion = 'WALK'; hp = e.hp; b.dealDamage(source, e, { amount: 1000, type: 'phys' }); near(hp - e.hp, 200);
  source.x = 4; hp = e.hp; b.dealDamage(source, e, { amount: 1000, type: 'phys' }); near(hp - e.hp, 500);
  assert.deepEqual(b.errors, []);
});
test('only walking backwards runs the 30-second Special clock; changing mode resets it', () => {
  const { h, b, e, a, targets } = fixture();
  for (const u of targets) u.x = 9;
  a.moveDir = -1; h.run(.35); assert.equal(a.back, true); assert.ok(a.left < 30);
  a.left = .1; h.run(.15); assert.ok(a.show); assert.equal(e.mem.regularFormVisual.clip, 'Special');
  assert.ok(e.s.flags.noMove); h.run(3.9); assert.equal(a.show, null);
  a.left = 5; a.moveDir = 1; h.run(.35); assert.equal(a.back, false); assert.equal(a.left, 30);
  h.run(31); assert.equal(a.show, null); assert.equal(a.left, 30);
  a.moveDir = -1; h.run(.35); a.left = .1; h.run(.15); assert.ok(a.show);
  b.applyStatus(e, 'stun', { duration: 2 }); assert.equal(a.show, null); assert.deepEqual(b.errors, []);
});
test('Fatty never attacks or blocks and escaping deducts no life', () => {
  const { h, b, e, targets: [u] } = fixture();
  u.x = e.x; u.y = e.y; u.tileR = e.tileR; u.tileC = e.tileC;
  h.run(4); assert.equal(e.blockedBy, null); assert.equal(e.stats.attacks, 0);
  const life = b.life; b.leak(e); assert.equal(b.life, life); assert.deepEqual(b.errors, []);
});
