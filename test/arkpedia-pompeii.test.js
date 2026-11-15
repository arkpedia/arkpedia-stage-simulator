// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ID = 'enemy_1050_lslime';
function fixture(level = 0) {
  const guard = chessRec({ id: 'pompeii_target', stats: { maxHp: 100000, atk: 0, def: 0, res: 0 }, skill: null });
  const record = structuredClone(ENEMY_RECORDS.enemies[ID].levels[level]); record.stats.moveSpeed = 0;
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 120, defs: { chess: { [guard.chessId]: guard }, enemies: { [ID]: record } },
    units: [[9, 6], [10, 6], [11, 6], [12, 6], [10, 5], [11, 5]].map(([row, col]) => ({ chessId: guard.chessId, row, col })), setup: installEnemyFeatures });
  const b = h.b; b.start(); const units = b.allyUnits;
  for (const u of units) b.addBuff(u, { key: 'stationary', flags: { noMove: true, disarm: true, noBlock: true } });
  const e = b.spawnEnemy(ID, { pos: [9, 8] });
  units.forEach((u, i) => { u.x = 6; u.y = 9 + i * .1; });
  const hits = []; b.on('damaged', c => hits.push(c));
  return { h, b, e, units, hits, record };
}
for (const level of [0, 1]) {
  test(`Pompeii level ${level}: four ground projectiles deliver ordinary Arts and refreshing burn`, () => {
    const { h, b, e, units, hits, record } = fixture(level);
    units[5].motion = 'FLY';
    assert.equal(e.profile.maxTargets, 4);
    h.runUntil(() => b.projectiles.list.length > 0, 5);
    assert.equal(b.projectiles.list.length, 4); assert.equal(hits.length, 0, 'no immediate hits before flight');
    assert.ok(h.runUntil(() => hits.filter(c => c.dmg.isAttack).length === 4, 2));
    const attacks = hits.filter(c => c.dmg.isAttack); assert.ok(attacks.every(c => c.hpLoss === record.stats.atk && c.dmg.applyWay === 'ranged'));
    assert.equal(new Set(attacks.map(c => c.target)).size, 4); assert.ok(attacks.every(c => c.target !== units[5]));
    const u = attacks[0].target, burn = u.findBuff('ab:burnDot'); assert.ok(burn);
    h.run(.4); const ticks = hits.filter(c => c.dmg.tags.includes('pompeiiBurn'));
    assert.ok(ticks.length >= 4); assert.ok(ticks.every(c => c.hpLoss === record.talents.bb['dot.damage'] && c.source === null && c.dmg.noSp));
    h.runUntil(() => e.stats.attacks >= 2, 5); h.run(.7);
    assert.equal(u.findBuff('ab:burnDot'), burn, 'refresh retains instance and tick clock');
    assert.deepEqual(b.errors, []);
  });
  test(`Pompeii level ${level}: HP speed threshold is reversible and does not consume unused ATK`, () => {
    const { h, b, e, record } = fixture(level), atk = e.s.atk;
    b.dealDamage(null, e, { amount: e.s.maxHp / 2, type: 'true' });
    assert.equal(e.s.aspd, 100 + record.talents.bb['selfbuff.attack_speed']); assert.equal(e.s.atk, atk);
    e.hp = e.s.maxHp; h.step(); assert.equal(e.s.aspd, 100);
    b.dealDamage(null, e, { amount: e.s.maxHp * .6, type: 'true' });
    assert.equal(e.s.aspd, 100 + record.talents.bb['selfbuff.attack_speed']); assert.equal(e.s.atk, atk);
  });
}
test('burn ignores damage evasion, retains cadence across refresh, persists after source death and gives no SP', () => {
  const { h, b, e, units, hits } = fixture();
  for (const u of units) b.addBuff(u, { key: 'evade', mods: { dodgeArts: 1 } });
  h.runUntil(() => units.some(u => u.findBuff('ab:burnDot')), 5);
  const u = units.find(u => u.findBuff('ab:burnDot')); assert.ok(u); assert.equal(hits.length, 0);
  const burn = u.findBuff('ab:burnDot'); let gains = 0; assert.ok(u.skill); b._skills.onDamaged = target => { if (target === u) gains++; };
  b.kill(e); const hp = u.hp; h.run(.4);
  assert.ok(u.hp < hp); assert.equal(gains, 0); assert.equal(u.findBuff('ab:burnDot'), burn);
  assert.ok(hits.every(c => c.source === null && c.dmg.noSp));
  b.dealDamage(null, u, { amount: 1, type: 'true' }); assert.equal(gains, 1, 'control damage reaches the SP dispatcher');
  h.run(10); assert.equal(u.findBuff('ab:burnDot'), null); assert.deepEqual(b.errors, []);
});
test('blocked blast pauses under control, resets on unblocking, uses fixed ground radius and ignores ATK', () => {
  const { h, b, e, units, hits } = fixture(1);
  e.profile.noAttack = true; b.removeBuff(units[0], 'stationary');
  b.addBuff(units[0], { key: 'stationary', flags: { disarm: true, noMove: true } });
  e.x = units[0].tileC; e.y = units[0].tileR; e.tileC = units[0].tileC; e.tileR = units[0].tileR; units[0].x = e.x; units[0].y = e.y;
  units[1].x = e.x + 1.39; units[2].x = e.x + 1.41; units[3].x = e.x + 1;
  units[4].x = e.x + 1; units[5].x = e.x + 1;
  for (const u of units) u.y = e.y;
  units[3].motion = 'FLY'; b.addBuff(units[4], { key: 'stealth', flags: { stealth: true } });
  b.addBuff(units[5], { key: 'camou', flags: { camou: true } }); b.addBuff(e, { key: 'atk', mods: { atkPct: 100, aspd: 300 } });
  const blasts = () => hits.filter(c => c.dmg.tags.includes('pompeiiBlast'));
  h.run(5); assert.equal(e.blockedBy, units[0]); b.applyStatus(e, 'stun', { duration: 2 });
  h.run(6.5); assert.equal(blasts().length, 0); h.run(.7);
  assert.deepEqual(blasts().map(c => c.target), [units[0], units[1], units[5]]);
  assert.ok(blasts().every(c => c.hpLoss === 1800 && c.dmg.applyWay === 'none' && c.dmg.isSplash));
  h.run(5); b._unblock(e); h.run(5); assert.equal(blasts().length, 3);
  h.run(5.2); assert.equal(blasts().length, 6); assert.deepEqual(b.errors, []);
});
test('native admission rejects missing or altered projectile, selectors, HP checker, burn and blast templates', () => {
  const entry = ENEMY_RECORDS.enemies[ID]; assert.ok(enemySupport(entry, index.prefabs, evidence).policy);
  assert.equal(enemySupport(entry, index.prefabs, {}).policy, null);
  for (const change of ['circle', 'checker', 'template', 'projectile', 'buff', 'newParameter']) {
    const d = structuredClone(evidence), r = structuredClone(entry);
    if (change === 'template') d.templates.periodic_magic_damage.eventToActions.ON_BUFF_TRIGGER[0]._ignoreForSp = false;
    else if (change === 'newParameter') r.levels[0].talents.bb['dot.new_mechanic'] = 1;
    else {
      const rows = change === 'projectile' ? d.projectiles.projectile_lslime : d.prefabs[`dyn/battle/prefabs/enemies/${ID}.prefab`];
      for (const row of rows) { const c = JSON.parse(row.originalJson);
        if (change === 'circle' && 'm_Radius' in c) c.m_Radius += 1;
        if (change === 'checker' && '_toggleOnce' in c) c._toggleOnce = 1;
        if (change === 'projectile' && '_speed' in c) c._speed = 1;
        if (change === 'buff' && c._additiveActiveBuffs?.length) c._additiveActiveBuffs[0].isDamageMissable = 1;
        row.originalJson = JSON.stringify(c);
      }
    }
    assert.equal(enemySupport(r, index.prefabs, d).policy, null, change);
  }
});
