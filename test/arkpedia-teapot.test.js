// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
function fixture(id = 'enemy_1203_sfhu') {
  assert.ok(support.enemies[id].policy);
  const guard = chessRec({ id: 'tea_target', stats: { maxHp: 100000, atk: 0, def: 0, res: 0 }, skill: null });
  const records = Object.fromEntries([id, ...support.enemies[id].spawns].map(key => [key, structuredClone(ENEMY_RECORDS.enemies[key].levels[0])]));
  records[id].stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 60,
    defs: { chess: { [guard.chessId]: guard }, enemies: records },
    units: [[9, 6], [9, 7], [10, 7], [10, 6]].map(([row, col]) => ({ chessId: guard.chessId, row, col })),
    setup: b => installEnemyFeatures(b) });
  const b = h.b; b.start(); const [center, side, outside, special] = b.allyUnits;
  for (const u of b.allyUnits) b.addBuff(u, { key: 'fixture:stationary', flags: { noMove: true, disarm: true } });
  b.addBuff(center, { key: 'fixture:target', mods: { taunt: 100 } });
  const e = b.spawnEnemy(id, { pos: [9, 8] }), hits = [];
  b.on('damaged', c => { if (c.source === e) hits.push(c); });
  return { h, b, e, center, side, outside, special, hits, id };
}
for (const id of ['enemy_1203_sfhu', 'enemy_1203_sfhu_2']) {
  test(`${id}: ordinary attacks travel at native speed and splash once on impact, ignoring camouflage but excluding air`, () => {
    const { h, b, e, center, side, outside, special, hits } = fixture(id);
    b.addBuff(side, { key: 'camou', flags: { camou: true } }); special.motion = 'FLY';
    h.run(.1); assert.equal(e.stats.attacks, 1); assert.equal(hits.length, 0);
    assert.equal(b.projectiles.list[0].speed, 5); assert.equal(b.projectiles.list[0].maxAge, 10);
    h.run(.6); assert.deepEqual(new Set(hits.map(c => c.target)), new Set([center, side]));
    assert.equal(hits.length, 2); for (const hit of hits) { assert.equal(hit.hpLoss, e.s.atk); assert.equal(hit.dmg.isAttack, true); }
    assert.equal(outside.hp, outside.s.maxHp); assert.equal(special.hp, special.s.maxHp); assert.deepEqual(b.errors, []);
  });
  test(`${id}: death deals Arts damage once, applies an independent ASPD penalty, and still creates four teaware`, () => {
    const { h, b, e, center, side, outside, special } = fixture(id);
    e.x = center.x; e.y = center.y; e.profile.noAttack = true;
    b.addBuff(side, { key: 'camou', flags: { camou: true } });
    b.addBuff(special, { key: 'hidden', flags: { stealth: true } });
    const hp = center.hp, aspd = center.s.aspd;
    b.kill(e, center);
    assert.equal(hp - center.hp, e.s.atk);
    const buff = center.findBuff(`ab:teaBoom:${e.id}`); assert.ok(buff);
    assert.equal(buff.duration, 15); assert.equal(buff.mods.aspd, id.endsWith('_2') ? -50 : -40);
    assert.equal(center.s.aspd, aspd + buff.mods.aspd);
    assert.ok(side.findBuff(buff.key)); assert.equal(outside.findBuff(buff.key), null); assert.equal(special.findBuff(buff.key), null);
    assert.equal(b.enemies.filter(u => u.alive && u.defId === support.enemies[id].spawns[0]).length, 4);
    h.run(15.1); assert.equal(center.findBuff(buff.key), null); assert.deepEqual(b.errors, []);
  });
}

test('separate deaths stack with independent expiration, resistance halves only each application duration', () => {
  const { h, b, e, center, id } = fixture();
  e.x = center.x; e.y = center.y; e.profile.noAttack = true;
  b.applyStatus(center, 'resist'); b.kill(e, center);
  const first = center.findBuff(`ab:teaBoom:${e.id}`); assert.equal(first.duration, 7.5);
  h.run(2);
  const second = b.spawnEnemy(id, { pos: [center.y, center.x] }); second.profile.noAttack = true; b.kill(second, center);
  assert.equal(center.buffs.filter(b => b.key.startsWith('ab:teaBoom:')).length, 2);
  h.run(5.6); assert.equal(center.findBuff(first.key), null); assert.ok(center.findBuff(`ab:teaBoom:${second.id}`));
  h.run(2); assert.equal(center.findBuff(`ab:teaBoom:${second.id}`), null); assert.deepEqual(b.errors, []);
});

test('silence suppresses the explosion and debuff but not the four death spawns; escaping never explodes', () => {
  for (const reason of ['silenced', 'escaped']) {
    const { b, e, center, id } = fixture(); e.x = center.x; e.y = center.y; const hp = center.hp;
    if (reason === 'silenced') { b.applyStatus(e, 'silence', { duration: 20 }); b.kill(e, center); }
    else b.leak(e);
    assert.equal(center.hp, hp); assert.equal(center.findBuff(`ab:teaBoom:${e.id}`), null);
    assert.equal(b.enemies.filter(u => u.alive && u.defId === support.enemies[id].spawns[0]).length, reason === 'silenced' ? 4 : 0);
    assert.deepEqual(b.errors, []);
  }
});

test('a launched attack survives source death and uses its launch ATK when landing', () => {
  const { h, b, e, center, hits } = fixture(); h.run(.1);
  const atk = e.s.atk; b.kill(e, center); h.run(.6);
  const hit = hits.find(c => c.target === center && c.dmg.isAttack); assert.ok(hit); assert.equal(hit.hpLoss, atk);
});

test('native projectile, debuff, template and record changes cannot silently pass admission', () => {
  const id = 'enemy_1203_sfhu', entry = ENEMY_RECORDS.enemies[id];
  assert.equal(enemySupport(entry, index.prefabs, {}).policy, null);
  for (const edit of [
    x => { const rows = x.projectiles.projectile_enemy_sfhu; for (const row of rows) { const c = JSON.parse(row.originalJson); if ('_speed' in c) c._speed = 99; row.originalJson = JSON.stringify(c); } },
    x => { x.templates['projectile_on_killed'].eventToActions.ON_OWNER_KILLED[0]._isUnset = false; },
    x => { x.templates['enemy_sfhu_atkspeed_dec[trig]'].eventToActions.ON_BUFF_TRIGGER[1]._buff.disableOverride = false; },
  ]) { const changed = structuredClone(evidence); edit(changed); assert.equal(enemySupport(entry, index.prefabs, changed).policy, null); }
  const changed = structuredClone(entry); changed.levels[0].talents.bb['DeadBoom.attack_speed_add'] = -10;
  assert.equal(enemySupport(changed, index.prefabs, evidence).policy, null);
});
