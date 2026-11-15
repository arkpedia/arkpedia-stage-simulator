// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1133_harchn', 'enemy_1133_harchn_2'];
function fixture(id = ids[0], targets = false) {
  const record = ENEMY_RECORDS.enemies[id].levels[0], child = record.skills[0].bbStr.enemy_key;
  const op = chessRec({ id: 'spider_target', stats: { maxHp: 100000, atk: 0, def: 0 } });
  const h = makeBattle({ content: 'none', timeLimit: 60, autoFinish: false, setup: installEnemyFeatures,
    defs: { enemies: { [id]: record, [child]: ENEMY_RECORDS.enemies[child].levels[0] }, chess: { [op.chessId]: op } },
    units: targets ? [{ chessId: op.chessId, row: 10, col: 7 }] : [] });
  const b = h.b; b.start();
  const route = { motion: 'WALK', start: [10, 6], end: [9, 2], steps: [{ t: 'wait', s: 20 }, { t: 'move', p: [10, 4] }] };
  const e = b.spawnEnemy(id, { pos: [10, 6], route });
  b.addBuff(e, { key: 'stationary', flags: { noMove: true } });
  const born = []; b.on('enemySpawn', ({ enemy }) => {
    if (enemy.defId !== child) return;
    born.push({ time: b.time, pos: [enemy.y, enemy.x], enemy });
    b.addBuff(enemy, { key: 'hold', flags: { noMove: true } });
  });
  return { h, b, e, child, record, born };
}
test('both mutant spiders release one child at the source skill event on independent five-second cooldowns', () => {
  for (const id of ids) {
    const { h, b, e, born } = fixture(id);
    h.run(5.5); assert.equal(born.length, 0); assert.equal(e.profile.noAttack, true);
    h.run(.15); assert.equal(born.length, 1); assert.deepEqual(born[0].pos, [10, 6]);
    assert.ok(Math.abs(born[0].time - (5 + 17 / 30)) <= b.dt * 3);
    assert.ok(born[0].enemy.route.legs.some(l => l.t === 'move' && l.r === 10 && l.c === 4));
    h.run(5); assert.equal(born.length, 2);
    assert.ok(Math.abs(born[1].time - born[0].time - 5) < b.dt * 2);
    assert.deepEqual(b.errors, []);
  }
});
test('silence prevents summons and death split; interrupted casts keep their spent cooldown', () => {
  for (const status of ['silence', 'stun']) {
    const { h, b, e, born } = fixture(); h.run(5.2);
    b.applyStatus(e, status, { duration: 1 }); h.run(1);
    assert.equal(born.length, 0); assert.equal(e.profile.noAttack, false);
    h.run(4.5); assert.equal(born.length, 1); assert.deepEqual(b.errors, []);
  }
  const { h, b, e, born } = fixture(); b.applyStatus(e, 'silence', { duration: 20 });
  h.run(8); assert.equal(born.length, 0); b.kill(e); h.run(1); assert.equal(born.length, 0);
});
test('four fixed-delay death children retain the route, spread and hold battle completion', () => {
  for (const id of ids) {
    const { h, b, e, born } = fixture(id); b.autoFinish = true; b.kill(e); b.kill(e);
    h.run(.1); assert.equal(born.length, 0); assert.equal(b.finished, false);
    h.run(.15); assert.equal(born.length, 4); assert.equal(b.finished, false);
    assert.equal(new Set(born.map(row => row.time)).size, 1);
    assert.ok(born.every(({ pos, enemy }) => Math.abs(pos[0] - 10) <= .2 && Math.abs(pos[1] - 6) <= .2
      && enemy.route.legs.some(l => l.t === 'move' && l.r === 10 && l.c === 4)));
    assert.deepEqual(b.errors, []);
  }
});
test('leak and pit deaths never split, while blocked ground origins relocate their children', () => {
  for (const fall of [false, true]) {
    const { h, b, e, born } = fixture();
    if (fall) {
      b.grid.setTile(10, 7, { ...b.grid.tile(10, 7), key: 'tile_hole' });
      b.displace(e, { x: 1, y: 0 }, 1, { onFall: victim => b.kill(victim) });
    } else b.leak(e);
    h.run(1); assert.equal(born.length, 0); assert.equal(e.alive, false);
  }
  const { h, b, e, born } = fixture(); b.grid.setObstacle(10, 6, true); b.kill(e); h.run(.3);
  assert.equal(born.length, 4);
  assert.ok(born.every(({ pos }) => b.grid.groundPassable(...pos.map(Math.round))));
  assert.deepEqual(b.errors, []);
});
test('normal attack uses a physical ground-only projectile and survives source death after release', () => {
  const { h, b, e, record } = fixture(ids[0], true), u = h.allies()[0], hits = [];
  b.on('hit', c => { if (c.source === e) hits.push(c.dmg); });
  u.motion = 'FLY'; h.run(2); assert.equal(hits.length, 0);
  u.motion = 'WALK'; h.runUntil(() => b.projectiles.list.length > 0, 2);
  assert.equal(hits.length, 0); assert.ok(b.projectiles.list.length); b.kill(e); h.run(.3);
  assert.equal(hits.length, 1); assert.equal(hits[0].type, 'phys'); assert.equal(hits[0].amount, record.stats.atk);
  assert.deepEqual(b.errors, []);
});
test('source gates reject changed silence, cadence, children, projectile and summon placement contracts', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id], clocks.prefabs, native).policy);
  for (const change of ['silence', 'ground', 'delay', 'projectile', 'cadence', 'child']) {
    const n = structuredClone(native), records = structuredClone(ENEMY_RECORDS.enemies[ids[0]]);
    if (change === 'silence') n.templates['deathrattle_sum[walk_only]'].eventToActions.ON_OWNER_KILLED[0]._isUnset = false;
    if (change === 'ground') n.templates['harchn[sum_token]'].eventToActions.ON_BUFF_START[0]._passableMask = 'ALL';
    if (change === 'delay') n.templates['deathrattle_sum[walk_only]'].eventToActions.ON_OWNER_KILLED[3]._useRandomDelay = true;
    if (change === 'projectile') for (const row of n.projectiles.projectile_enemy_harchn_attack) {
      const data = JSON.parse(row.originalJson); if ('_speed' in data) data._speed = 3; row.originalJson = JSON.stringify(data);
    }
    if (change === 'cadence') records.levels[0].skills[0].cooldown = 1;
    if (change === 'child') records.levels[0].skills[0].bbStr.enemy_key = 'enemy_1001_boss';
    assert.equal(enemySupport(records, clocks.prefabs, n).policy, null, change);
  }
});
