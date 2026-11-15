// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { electricCoilDefinition, electricCoilNativeReviewed } from '../shared/arkpedia/stage-electric-coils.js';
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
const c = await loadContentContext(), plans = new Map();
for (const id of ['mn-3', 'mn-ex-1', 'mn-tr-1']) { const p = await planStage(c, id); assert.deepEqual(p.blockers, []); plans.set(id, p); }
function setup(id = 'mn-3') {
  const stage = structuredClone(plans.get(id).stage);
  const b = new StandardBattle({ ...c.mvp, stage, enemies: { ...c.mvp.enemies, ...stage.enemies } }, { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
  b.setViewport('fullscreen-workspace'); b.autoFinish = false; b.life = 1e6; b.getPlayer('arkpedia').dp = 99;
  const advance = t => { for (let i = 0; i < Math.ceil(t / b.dt); i++) b.step(); };
  const coil = (r, col) => { b.grid.setTile(r, col, { ...b.grid.tile(r, col), build: 'RANGED' }); b.stageTokenReadyAt.delete('trap_019_electric'); return b.deployToken('trap_019_electric', r, col); };
  const enemy = (r, col, flags = {}) => { const u = b.spawnEnemy('enemy_1099_nbkght', { pos: [r, col] }); b.addBuff(u, { key: 'hold', flags: { noMove: true, disarm: true, ...flags } }); return u; };
  return { b, advance, coil, enemy };
}

test('coils retain source instance and source gates reject targeting, width, lifetime and damage-class changes', () => {
  assert.equal(electricCoilNativeReviewed(), true);
  for (const [key, field, value] of [['trap_019_electric', '_compareWithOwnerCreatedTime', 1], ['projectile_chr_electric_shock', '_laserWidth', 3], ['projectile_chr_electric_shock', '_lifeTime', 3]]) {
    const changed = structuredClone(native); changed.prefabs[key].components.find(c => field in c.data).data[field] = value;
    assert.equal(electricCoilNativeReviewed(changed), false);
  }
  const changed = structuredClone(native); changed.templates['electric[attack]'].eventToActions.ON_BUFF_START[1]._attackType = 'NORMAL';
  assert.equal(electricCoilNativeReviewed(changed), false);
  assert.throws(() => electricCoilDefinition({ level: 31, skillLevel: 1 }), /Unsupported/);
  const { b } = setup('mn-ex-1'); assert.equal(b.electricCoils.entries.size, 4);
  for (const e of b.electricCoils.entries.values()) { assert.equal(e.supplied, false); assert.equal(e.unit.s.flags.invulnerable, true); assert.equal(e.unit.deploymentSlotCost, 0); }
  assert.deepEqual(b.errors, []);
});

test('supplied coils use ranged placement, shared stock/cooldown, multiple deployment and half-cost retreat without returning a card', () => {
  const { b, coil } = setup(); b.grantStageToken('trap_019_electric', 3);
  b.grid.setTile(2, 3, { ...b.grid.tile(2, 3), build: 'MELEE' });
  assert.throws(() => b.deployToken('trap_019_electric', 2, 3), /ranged tile/);
  const a = coil(2, 3); assert.equal(b.getPlayer('arkpedia').dp, 94); assert.equal(a.obstacle, false);
  assert.throws(() => b.deployToken('trap_019_electric', 2, 5), /recharging/);
  const z = coil(2, 5); assert.equal(b.electricCoils.entries.size, 2); assert.equal(b.mvpStageTokens.get('trap_019_electric'), 1);
  b.retreatStageToken(z.mem.stageSupplyId); assert.equal(b.getPlayer('arkpedia').dp, 91); assert.equal(b.mvpStageTokens.get('trap_019_electric'), 1);
  assert.throws(() => b.retreatStageToken(z.mem.stageSupplyId), /no longer/); assert.deepEqual(b.errors, []);
});

test('finite beams hit each crossing ground or air enemy once, with Arts resistance and independent slow; hidden targets and off-strip targets are excluded', () => {
  const { b, advance, coil, enemy } = setup(); b.grantStageToken('trap_019_electric', 2);
  coil(2, 3); const source = coil(2, 5);
  const target = enemy(2, 4), air = enemy(2, 4.2), outside = enemy(2.4, 4), hidden = enemy(2, 3.8, { stealth: true });
  air.ground = false; air.motion = 'FLY'; const hp = target.hp, hpAir = air.hp, hpOut = outside.hp, hpHidden = hidden.hp;
  const damage = []; b.on('hit', x => { if (x.source === source) damage.push(x.dmg); });
  advance(2.2); assert.equal(target.hp, hp); advance(.2);
  assert.equal(target.hp, hp - 250 * (1 - target.s.res / 100)); assert.ok(air.hp < hpAir);
  assert.equal(outside.hp, hpOut); assert.equal(hidden.hp, hpHidden); assert.equal(target.findBuff('sluggish').duration, 1.5);
  const once = target.hp; advance(.2); assert.equal(target.hp, once);
  const entrant = enemy(2, 4.1), hpEntry = entrant.hp; advance(.1); assert.ok(entrant.hp < hpEntry);
  assert.ok(damage.length); assert.ok(damage.every(d => !d.isAttack && d.tags.includes('periodic')));
  advance(.4); const late = enemy(2, 4), hpLate = late.hp; advance(.1); assert.equal(late.hp, hpLate);
  assert.deepEqual(b.errors, []);
});

test('native earlier-created, one-target limit never duplicates reciprocal beams; a removed target ends the link', () => {
  const { b, advance, coil } = setup(); b.grantStageToken('trap_019_electric', 3);
  const first = coil(2, 3), second = coil(2, 5), third = coil(3, 4);
  advance(2.4);
  assert.equal(b.electricCoils.beams.length, 2);
  assert.deepEqual(b.electricCoils.beams.map(x => [x.source.id, x.target.id]), [[second.id, first.id], [third.id, first.id]]);
  b.retreatStageToken(first.mem.stageSupplyId); advance(.1); assert.equal(b.electricCoils.beams.length, 0);
  advance(2.3); assert.ok(b.electricCoils.beams.every(x => x.source === third && x.target === second));
  assert.deepEqual(b.errors, []);
});
