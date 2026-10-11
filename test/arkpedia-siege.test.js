// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-siege-prefabs.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const ID = 'char_112_siege', FANG = 'char_123_fang', MEL = 'char_208_melan';
const near = (a, v, tolerance = 1e-5) => assert.ok(Math.abs(a - v) < tolerance, `${a} != ${v}`);
function make({ skill = 1, rank = 10, elite = 2, potential = 1, others = [] } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const op = d.operators[ID], build = { ...defaultBuild(op), elite, level: op.phases[elite].maxLevel,
    potential, skillId: op.skills[skill].id, skillRank: rank };
  const b = new StandardBattle(d, { operators: [build, ...others.map(id => defaultBuild(d.operators[id]))] });
  b.autoFinish = false; b.timeLimit = Infinity; b.setViewport('fullscreen-workspace');
  const deploy = (id = ID, dir = 'RIGHT', r = 2, c = 7) => {
    b.getPlayer('arkpedia').dp = 99; const u = b.deployOperator(id, r, c, dir);
    u.atkCd = 1000; b.getPlayer('arkpedia').dp = 0; return u;
  };
  return { b, deploy };
}
function advance(b, seconds) {
  for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function enemy(b, x = 8, y = 2, motion = 'WALK') {
  const e = b.spawnEnemy('enemy_1007_slime', { routeIndex: 1 }); e.x = x; e.y = y;
  e.base.maxHp = 100000; e.base.def = e.base.res = e.base.moveSpeed = 0;
  e.markDirty(); void e.s; e.hp = 100000; e.motion = motion;
  b.addBuff(e, { key: 'pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function charge(u) { u.skill.gainSp(u.skill.spCost * u.skill.maxCharges, 'test'); assert.equal(u.skill.activate('test'), true); }

test('Siege retains complete source graphs, all thirty rank rows and original facing bytes with explicit limits', () => {
  assert.deepEqual(REGULAR_OPERATORS[ID].skillIds, ['skcom_charge_cost[3]', 'skchr_siege_2', 'skchr_siege_3']);
  for (const s of Object.values(evidence.tables.skills)) assert.equal(s.levels.length, 10);
  assert.equal(evidence.sourceBundles.length, 5); assert.equal(evidence.frameParity, false);
  assert.match(evidence.sourceInvestigations.reason, /Back skeleton/);
  assert.match(evidence.verificationLimits.join(' '), /native C#|Native C#/);
  for (const facing of ['Front', 'Back']) {
    const record = data.sd.models[`operator/${ID}/default/${facing.toLowerCase()}`];
    const raw = readFileSync(new URL(`../../arkpedia-sd-assets/${record.skeleton.path}`, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), evidence.officialSkeletonBindings[ID][facing].sha256);
  }
  assert.deepEqual(evidence.models.Front.hits.Skill, [1.133]); assert.equal(evidence.models.Back.hits.Skill, undefined);
  assert.equal(evidence.nativeBoundaries.s2FaceToFront, 0);
  assert.equal(evidence.buffTemplates.siege_t_2.eventToActions.ON_OWNER_KILLED[0]._forceFlag, true);
});

test('S1 grants exactly twelve DP at every selected rank without changing normal targeting', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make({ skill: 0, rank }), u = deploy(); charge(u);
    near(b.dp, 12); assert.equal(u.skill.active, false);
    assert.equal(effectiveProfile(u).maxTargets, 1);
    advance(b, .2); near(b.dp, 12);
  }
});

test('King of Beasts uses promotion and potential values, includes owner and only deployed Vanguards', () => {
  for (const [elite, potential, value] of [[0, 1, 0], [1, 1, .04], [1, 5, .06], [2, 1, .08], [2, 5, .1]]) {
    const { b, deploy } = make({ skill: 0, elite, potential, rank: elite ? 7 : 4, others: [FANG, MEL] });
    const fang = deploy(FANG, 'RIGHT', 2, 6), melantha = deploy(MEL, 'RIGHT', 3, 7), u = deploy();
    near(u.s.atk, u.base.atk * (1 + value)); near(u.s.def, u.base.def * (1 + value));
    near(fang.s.atk, fang.base.atk * (1 + value)); near(fang.s.def, fang.base.def * (1 + value));
    near(melantha.s.atk, melantha.base.atk * 1.08); // her own selected talent
    b.retreatOperator(ID); near(fang.s.atk, fang.base.atk); near(fang.s.def, fang.base.def);
    b.bench[ID].readyAt = b.time; const fresh = deploy();
    near(fang.s.atk, fang.base.atk * (1 + value)); b.kill(fresh); near(fang.s.atk, fang.base.atk);
  }
});

test('King of Beasts reaches newly deployed Vanguards across the map and does not persist in bench stats', () => {
  const { b, deploy } = make({ others: [FANG] }), u = deploy();
  const fang = deploy(FANG, 'RIGHT', 2, 2); near(fang.s.atk, fang.base.atk * 1.08);
  near(b.data.getChess(FANG).stats.atk, fang.base.atk);
  b.retreatOperator(FANG); b.bench[FANG].readyAt = b.time;
  const fresh = deploy(FANG, 'RIGHT', 2, 2); near(fresh.s.atk, fresh.base.atk * 1.08);
  b.retreatOperator(ID); near(fresh.s.atk, fresh.base.atk); assert.equal(u.alive, false);
});

test('ordinary attacks retain one locked ground target and original .733 hit timing in all directions', () => {
  for (const dir of ['RIGHT', 'DOWN', 'LEFT', 'UP']) {
    const { b, deploy } = make(), u = deploy(ID, dir), first = enemy(b), other = enemy(b);
    b.addBuff(u, { key: 'haste', mods: { aspd: 100 } });
    b.forceAttack(u, [first]); advance(b, .7); near(first.hp, 100000);
    advance(b, .1); near(100000 - first.hp, u.s.atk); near(other.hp, 100000);
  }
});

test('S2 uses every selected scale and charge capacity, one three-DP grant and a full cast lock', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make({ rank }), u = deploy(), e = enemy(b); charge(u);
    assert.equal(u.skill.maxCharges, u.def.skill.bb.ct); const atk = u.s.atk;
    b.forceAttack(u, [e]); advance(b, 1.1); near(e.hp, 100000); near(b.dp, 0); near(u.skill.sp, 0);
    advance(b, .1); near(100000 - e.hp, atk * u.def.skill.bb.atk_scale); near(b.dp, 3);
    assert.ok(u.mem.siegeCast); assert.equal(u.profile.canAttack(), false); near(u.skill.sp, 0);
    advance(b, .6); assert.equal(u.mem.siegeCast, null); assert.equal(u.profile.canAttack(), true);
    assert.ok(!u.s.flags.noSp); assert.ok(u.skill.sp > 0); near(b.dp, 3);
  }
});

test('S2 selects the cross at release, hits all ground enemies once, excludes air and has no radial splash', () => {
  const { b, deploy } = make(), u = deploy(), first = enemy(b);
  const victims = [first, enemy(b, 6, 2), enemy(b, 7, 1), enemy(b, 7, 3)];
  const diagonal = enemy(b, 8, 3), air = enemy(b, 7, 2, 'FLY');
  charge(u); b.forceAttack(u, [first]); advance(b, .6);
  first.x = 9; const entering = enemy(b, 8, 2); const atk = u.s.atk; advance(b, .7);
  near(first.hp, 100000); near(diagonal.hp, 100000); near(air.hp, 100000);
  for (const e of [...victims.slice(1), entering]) near(100000 - e.hp, atk * u.def.skill.bb.atk_scale);
  near(b.dp, 3); assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 1);
});

test('S2 completes once when the original target disappears, without inventing a refund or second DP grant', () => {
  const { b, deploy } = make(), u = deploy(), e = enemy(b); charge(u);
  const charges = u.skill.charges; b.forceAttack(u, [e]); e.x = 10; advance(b, 1.8);
  near(e.hp, 100000); near(b.dp, 3); assert.equal(u.skill.charges, charges);
});

test('S2 Back fallback remains real Idle while the documented Front hit clock is direction-independent', () => {
  for (const dir of ['RIGHT', 'DOWN', 'LEFT', 'UP']) {
    const { b, deploy } = make(), u = deploy(ID, dir), e = enemy(b);
    charge(u); b.forceAttack(u, [e]);
    assert.equal(u.mem.regularFormVisual.clip, dir === 'UP' ? 'Idle' : 'Skill');
    assert.ok(!u.mem.regularFormVisual.forceFront);
    advance(b, 1.1); near(e.hp, 100000); advance(b, .1); near(b.dp, 3); assert.ok(e.hp < 100000);
  }
});

test('transient control and retreat cancel an unreleased S2 with no late hit or free DP', () => {
  for (const status of ['stun', 'freeze', 'levitate']) {
    const { b, deploy } = make(), u = deploy(), e = enemy(b); charge(u); b.forceAttack(u, [e]);
    advance(b, .4); b.applyStatus(u, status, { duration: .1 }); advance(b, 1.5);
    near(e.hp, 100000); near(b.dp, 0); assert.equal(u.skill.pending, false); assert.equal(u.mem.siegeCast, null);
  }
  const { b, deploy } = make(), u = deploy(), e = enemy(b); charge(u); b.forceAttack(u, [e]);
  b.retreatOperator(ID); const refund = b.dp; advance(b, 2); near(e.hp, 100000); near(b.dp, refund);
});

test('Crushing grants one forced SP for any nearby actual enemy death, including air and another killer', () => {
  const { b, deploy } = make({ others: [MEL] }), u = deploy(), ally = deploy(MEL, 'RIGHT', 3, 7);
  u.skill.setSpTotal(0); const gain = []; b.on('spGain', ctx => gain.push(ctx));
  for (const [x, y, motion] of [[8, 2, 'WALK'], [6, 2, 'WALK'], [7, 1, 'FLY'], [7, 3, 'WALK']]) b.kill(enemy(b, x, y, motion), ally);
  near(u.skill.spTotal, 4); assert.equal(gain.length, 0);
  b.kill(enemy(b, 9, 3)); near(u.skill.spTotal, 4);
  const escaping = enemy(b); b.retreat(escaping, { reason: 'leaked', permanent: true }); near(u.skill.spTotal, 4);
  b.retreatOperator(ID); b.kill(enemy(b)); near(u.skill.spTotal, 4);
});

test('Crushing bypasses S2 no-SP, can restore a charge from its own kill, and clamps at stored capacity', () => {
  const { b, deploy } = make(), u = deploy(), e = enemy(b); charge(u); u.skill.setSpTotal(9);
  e.hp = 1; b.forceAttack(u, [e]); advance(b, 1.2);
  assert.ok(u.s.flags.noSp); near(u.skill.spTotal, 10); near(b.dp, 3);
  for (let i = 0; i < 40; i++) b.kill(enemy(b)); near(u.skill.spTotal, 30);
});

test('Crushing bypasses a timed S3 but does not fire at E1, on revival or a hidden enemy', () => {
  const { b, deploy } = make({ skill: 2 }), u = deploy(); charge(u);
  u.skill.setSpTotal(0); b.kill(enemy(b)); near(u.skill.spTotal, 1); assert.equal(u.skill.active, true);
  const revive = enemy(b); b.on('kill', ({ victim }) => { if (victim === revive) victim.hp = 1; });
  b.kill(revive); near(u.skill.spTotal, 1);
  const hidden = enemy(b); hidden.hidden = true; b.kill(hidden); near(u.skill.spTotal, 1);
  const low = make({ elite: 1, rank: 7 }), e1 = low.deploy(); e1.skill.setSpTotal(0);
  low.b.kill(enemy(low.b)); near(e1.skill.spTotal, 0);
});

test('S3 adds one second BAT, uses selected scale/duration/stun at every rank, and never grants DP', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make({ skill: 2, rank }), u = deploy(), e = enemy(b), bb = u.def.skill.bb;
    charge(u); near(u.s.bat, u.base.bat + 1); near(u.skill.timeLeft, u.def.skill.duration);
    b.rng.chance = p => { near(p, .4); return true; }; b.forceAttack(u, [e]); advance(b, 1);
    near(e.hp, 100000); advance(b, .2); near(100000 - e.hp, u.s.atk * bb['attack@atk_scale']);
    const stun = e.findBuff('stun'); assert.ok(stun); assert.ok(stun.timeLeft <= bb['attack@stun']);
    near(b.dp, 0); advance(b, u.def.skill.duration); assert.equal(u.skill.active, false); near(u.s.bat, u.base.bat);
  }
});

test('S3 failed stun roll, slow ASPD clock and normal mode after expiry preserve one-target attacks', () => {
  const { b, deploy } = make({ skill: 2 }), u = deploy(), e = enemy(b), other = enemy(b);
  charge(u); b.addBuff(u, { key: 'slow', mods: { aspd: -50 } }); b.rng.chance = () => false;
  b.forceAttack(u, [e]); advance(b, 2); near(e.hp, 100000); advance(b, .2);
  assert.ok(e.hp < 100000); assert.ok(!e.s.flags.stun); near(other.hp, 100000);
  u.skill.end(); const hp = e.hp; b.forceAttack(u, [e]); advance(b, 1.6);
  near(hp - e.hp, u.s.atk); near(b.dp, 0);
});
