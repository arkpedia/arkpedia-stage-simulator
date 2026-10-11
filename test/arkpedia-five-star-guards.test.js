// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-guard-prefabs.json' with { type: 'json' };
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { FIVE_STAR_GUARD_OPERATORS } from '../shared/arkpedia/five-star-guard-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const FRANKA = 'char_106_franka', SPECTER = 'char_143_ghost', BROCA = 'char_356_broca';
const ASTESIA = 'char_274_astesi', FLAME = 'char_131_flameb';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function make(ids, overrides = {}) {
  const source = structuredClone(data); source.stage.geometry.waves[0].spawns = [];
  const b = new StandardBattle(source, { operators: ids.map(id => ({
    ...defaultBuild(source.operators[id]), ...overrides[id],
  })) });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99); return b;
}
function deploy(b, id, r = 2, c = 7, dir = 'RIGHT') {
  b.addDp('arkpedia', 99); const u = b.deployOperator(id, r, c, dir); u.atkCd = 1000; return u;
}
function enemy(b, x = 8, y = 2, fly = false) {
  const e = b.spawnEnemy('enemy_1007_slime', { routeIndex: 1 });
  e.x = x; e.y = y; e.base.maxHp = e.hp = 100000;
  e.base.def = e.base.res = e.base.moveSpeed = 0; e.motion = fly ? 'FLY' : 'WALK'; e.markDirty();
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function advance(b, seconds) { for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step(); assert.deepEqual(b.errors, []); }
function cast(b, u) {
  u.skill.gainSp(u.skill.spCost, 'test');
  assert.equal(u.skill.manual ? b.activateOperator(u.defId) : u.skill.activate('test'), true);
}
function strike(b, u, target) { const before = target.hp; b.forceAttack(u, [target]); advance(b, 1); return before - target.hp; }

test('five-star guard source evidence retains exact skill variants, selector caps and modifier formula families', () => {
  for (const id of Object.keys(FIVE_STAR_GUARD_OPERATORS)) {
    assert.ok(evidence.characters[id].length);
    assert.match(evidence.sourceBundles.find(v => v.path === `charpack/${id}.ab`).sha256, /^[a-f0-9]{64}$/);
    assert.equal(data.operators[id].skills.length, 2);
  }
  const sourceSkills = evidence.skills.skchr_franka_2[0].components;
  assert.ok(sourceSkills.some(c => c._buffs?.some(v => v.attributes.attributeModifiers.some(m => m.attributeType === 2 && m.formulaItem === 3 && m.value === 0))));
  for (const id of [SPECTER, BROCA, ASTESIA])
    assert.ok(evidence.characters[id].some(row => row.components.some(c => c._limitedMaxTargetNumToBlockedCnt === 1)));
  assert.equal(evidence.buffTemplates.flameb_t_1.eventToActions.ON_TARGET_KILLED[0]._buff.overrideType, 'STACK');
});

test('both original skills resolve at every selectable rank, with source durations, SP and blackboards', () => {
  for (const [id, config] of Object.entries(FIVE_STAR_GUARD_OPERATORS)) for (const skillId of config.skillIds)
    for (let rank = 1; rank <= 10; rank++) {
      const b = make([id], { [id]: { skillId, skillRank: rank } }), u = deploy(b, id);
      assert.equal(u.skill.id, skillId); assert.equal(u.def.raw.arkpedia.skillRank, rank);
      near(u.skill.spCost, u.def.skill.spCost); near(u.skill.duration, u.def.skill.duration);
      assert.equal(u.skill.noSkill, false);
    }
});

test('Franka talent bypasses DEF but remains physical; S2 raises chance and forces final DEF zero through external buffs', () => {
  const b = make([FRANKA], { [FRANKA]: { skillId: 'skchr_franka_2' } }), u = deploy(b, FRANKA), e = enemy(b);
  e.base.def = 1000; e.markDirty(); b.addBuff(e, { key: 'test:physical', mods: { physTakenMul: .5 } });
  b.rng = () => .1; near(strike(b, u, e), u.s.atk * .5);
  b.rng = () => .21; near(strike(b, u, e), Math.max(u.s.atk - 1000, u.s.atk * .05) * .5);
  const def = u.s.def; b.addBuff(u, { key: 'test:DEF', mods: { defPct: .5, defFlat: 100 } }); cast(b, u); near(u.s.def, 0);
  b.rng = () => .49; near(strike(b, u, e), u.s.atk * .5);
  b.rng = () => .51; near(strike(b, u, e), Math.max(u.s.atk - 1000, u.s.atk * .05) * .5);
  advance(b, u.def.skill.duration); near(u.s.def, def * 1.5 + 150);
});

test('Franka S1 applies source ATK/ASPD and phase0 has no probabilistic DEF bypass', () => {
  const b = make([FRANKA]), u = deploy(b, FRANKA), atk = u.s.atk, aspd = u.s.aspd; cast(b, u);
  near(u.s.atk, atk * (1 + u.def.skill.bb.atk)); near(u.s.aspd, aspd + u.def.skill.bb.attack_speed);
  advance(b, u.def.skill.duration + .1); near(u.s.atk, atk); near(u.s.aspd, aspd);
  const low = make([FRANKA], { [FRANKA]: { elite: 0, level: 50, skillRank: 4 } }), unit = deploy(low, FRANKA), e = enemy(low);
  e.base.def = 100; e.markDirty(); low.rng = () => 0; near(strike(low, unit, e), Math.max(unit.s.atk - 100, .05 * unit.s.atk));
});

test('Specter talent uses current maximum HP for native regeneration even while stunned and direct healing is forbidden', () => {
  const b = make([SPECTER], { [SPECTER]: { potential: 6 } }), u = deploy(b, SPECTER);
  near(u.s.maxHp, u.base.maxHp * 1.12); u.hp = 1;
  b.addBuff(u, { key: 'test:ban', flags: { noHeal: true, healFree: true, stun: true } });
  advance(b, 1); near(u.hp, 1 + u.s.maxHp * .025);
  const low = make([SPECTER], { [SPECTER]: { elite: 1, level: 70, skillRank: 7 } }), unit = deploy(low, SPECTER);
  near(unit.s.maxHp, unit.base.maxHp * 1.1); near(unit.s.hpRegen, 0);
});

test('Specter attacks a block-capacity number of range targets including unblocked enemies; S1 preserves source cap', () => {
  const b = make([SPECTER]), u = deploy(b, SPECTER), list = [enemy(b), enemy(b, 8.2), enemy(b, 8.3), enemy(b, 8.4)], air = enemy(b, 8, 2, true);
  list[0].blockedBy = u; u.blocking = [list[0]];
  assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 3);
  cast(b, u); b.forceAttack(u, acquireTargets(b, u, effectiveProfile(u))); advance(b, 1);
  assert.equal(list.filter(e => e.hp < 100000).length, 3); near(air.hp, 100000);
  b.addBuff(u, { key: 'test:block', mods: { blockCnt: -1 } }); assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 2);
});

test('Specter S2 clamps HP to1 through fractional/lethal damage and HP loss, then expires into source stun', () => {
  const b = make([SPECTER], { [SPECTER]: { skillId: 'skchr_ghost_2' } }), u = deploy(b, SPECTER), e = enemy(b);
  cast(b, u); u.hp = 1.5; near(b.dealDamage(e, u, { amount: 1, type: 'true' }), .5); near(u.hp, 1);
  near(b.dealDamage(e, u, { amount: 100000, type: 'true' }), 0); near(u.hp, 1);
  b.loseHp(u, 10000); near(u.hp, 1); assert.equal(u.alive, true);
  advance(b, u.def.skill.duration + .1); assert.equal(u.s.flags.stun, true); assert.equal(Boolean(u.s.flags.undeadable), false);
  b.dealDamage(e, u, { amount: 100000, type: 'true' }); assert.equal(u.alive, false);
});

test('Broca talent requires two distinct live blocked enemies, stacks additively with skills and removes on release', () => {
  const b = make([BROCA], { [BROCA]: { potential: 6 } }), u = deploy(b, BROCA), e = enemy(b), other = enemy(b, 8.1);
  const atk = u.s.atk, def = u.s.def; e.blockedBy = u; e.blockWeight = 3; u.blocking = [e]; b.emit('blocked', { blocker: u, enemy: e });
  near(u.s.atk, atk); other.blockedBy = u; u.blocking.push(other); b.emit('blocked', { blocker: u, enemy: other });
  near(u.s.atk, atk + u.base.atk * .14); near(u.s.def, def + u.base.def * .14);
  cast(b, u); near(u.s.atk, atk + u.base.atk * (.14 + u.def.skill.bb.atk));
  other.blockedBy = null; u.blocking.pop(); b.emit('unblocked', { blocker: u, enemy: other }); near(u.s.def, def);
  near(u.s.atk, atk + u.base.atk * u.def.skill.bb.atk);
});

test('Broca S1 changes physical attacks to Arts with the source block-capacity cap and restores after duration', () => {
  const b = make([BROCA]), u = deploy(b, BROCA), e = enemy(b); e.base.def = 1000; e.base.res = 20; e.markDirty();
  near(strike(b, u, e), u.s.atk * .05); cast(b, u); near(strike(b, u, e), u.s.atk * .8);
  advance(b, u.def.skill.duration); assert.equal(effectiveProfile(u).dmgType, 'phys');
});

test('Broca S2 applies BAT percentage, original range and per-target Sluggish; expiry restores profile and stuns', () => {
  const b = make([BROCA], { [BROCA]: { skillId: 'skchr_broca_2' } }), u = deploy(b, BROCA), range = [...u.rangeKeys], e = enemy(b, 9, 2);
  const bat = u.s.bat; cast(b, u); near(u.s.bat, bat * (1 + u.def.skill.bb.base_attack_time)); assert.notDeepEqual(u.rangeKeys, range);
  assert.ok(acquireTargets(b, u, effectiveProfile(u)).includes(e)); b.forceAttack(u, [e]); advance(b, .6);
  near(e.s.moveSpeed, e.base.moveSpeed * .2); assert.ok(e.findBuff('sluggish'));
  advance(b, u.def.skill.bb['attack@sluggish'] + .1); assert.equal(e.findBuff('sluggish'), null);
  advance(b, u.def.skill.duration); near(u.s.bat, bat); assert.deepEqual(u.rangeKeys, range); assert.equal(effectiveProfile(u).dmgType, 'phys'); assert.equal(u.s.flags.stun, true);
});

test('Astesia starts without stacks, gains source ASPD every20s while controlled, caps at5 and resets on redeployment', () => {
  const b = make([ASTESIA]), u = deploy(b, ASTESIA), aspd = u.s.aspd;
  advance(b, 19.9); near(u.s.aspd, aspd); b.applyStatus(u, 'stun', { duration: 90 }); advance(b, .2);
  near(u.s.aspd, aspd + 5); advance(b, 120); near(u.s.aspd, aspd + 25);
  b.retreatOperator(ASTESIA); advance(b, u.base.respawnTime + .1); const again = deploy(b, ASTESIA); near(again.s.aspd, aspd);
});

test('Astesia S1 remains one-target Arts and S2 raises block/cap rather than requiring actual blocked targets', () => {
  for (const skillId of ['skchr_astesi_1', 'skchr_astesi_2']) {
    const b = make([ASTESIA], { [ASTESIA]: { skillId } }), u = deploy(b, ASTESIA), targets = [enemy(b), enemy(b, 8.2), enemy(b, 8.3)];
    const atk = u.s.atk, def = u.s.def; cast(b, u); near(u.s.atk, atk + u.base.atk * u.def.skill.bb.atk); near(u.s.def, def + u.base.def * u.def.skill.bb.def);
    const chosen = acquireTargets(b, u, effectiveProfile(u)); assert.equal(chosen.length, skillId.endsWith('_2') ? 2 : 1);
    b.forceAttack(u, chosen); advance(b, 1); assert.equal(targets.filter(t => t.hp < 100000).length, chosen.length);
    advance(b, u.def.skill.duration); near(u.s.blockCnt, 1); assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 1);
  }
});

test('Flamebringer own kills grant source flat maximum HP only to30 stacks; allied kills and redeployment do not retain stacks', () => {
  const b = make([FLAME, 'char_122_beagle'], { [FLAME]: { potential: 6 } }), u = deploy(b, FLAME), ally = deploy(b, 'char_122_beagle', 2, 6), hp = u.s.maxHp;
  b.dealDamage(ally, enemy(b), { amount: 200000, type: 'true' }); near(u.s.maxHp, hp);
  for (let i = 0; i < 32; i++) b.dealDamage(u, enemy(b), { amount: 200000, type: 'true' });
  near(u.s.maxHp, hp + 50 * 30); b.retreatOperator(FLAME); advance(b, u.base.respawnTime + .1);
  near(deploy(b, FLAME).s.maxHp, hp);
});

test('Flamebringer S1 heals at the next attack spell, not an idle pending cast, uses current maxHP and respects heal bans', () => {
  const b = make([FLAME]), u = deploy(b, FLAME), e = enemy(b); u.hp = 1; cast(b, u); near(u.hp, 1);
  b.forceAttack(u, [e]); near(u.hp, 1 + u.s.maxHp * u.def.skill.bb.hp_ratio); advance(b, 1);
  near(100000 - e.hp, u.s.atk * u.def.skill.bb.atk_scale); assert.equal(u.skill.pending, false);
  u.hp = 1; b.addBuff(u, { key: 'test:ban', flags: { healFree: true } }); cast(b, u); b.forceAttack(u, [e]); advance(b, 1); near(u.hp, 1);
});

test('Flamebringer S2 is a permanent source ATK/ASPD mode, uses the original skill hit timing and refuses repeat casts', () => {
  const b = make([FLAME], { [FLAME]: { skillId: 'skchr_flameb_2' } }), u = deploy(b, FLAME), e = enemy(b), atk = u.s.atk, aspd = u.s.aspd;
  cast(b, u); assert.equal(u.skill.timeLeft, Infinity); near(u.s.atk, atk * 1.7); near(u.s.aspd, aspd + 45);
  b.forceAttack(u, [e]); advance(b, .2); near(e.hp, 100000); advance(b, .2); near(100000 - e.hp, u.s.atk);
  advance(b, 120); assert.equal(u.skill.active, true); assert.equal(b.activateOperator(FLAME), false);
});
