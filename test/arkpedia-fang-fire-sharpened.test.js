// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-fang-fire-sharpened-prefabs.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const ID = 'char_1036_fang2', MEL = 'char_208_melan', BEAGLE = 'char_122_beagle';
const near = (a, e, tolerance = 1e-5) => assert.ok(Math.abs(a - e) < tolerance, `${a} != ${e}`);
function make({ skill = 0, rank = 10, elite = 2, potential = 1, others = [] } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = [];
  d.stage.battle.dp_per_second = 0;
  const o = d.operators[ID], build = { ...defaultBuild(o), elite, level: o.phases[elite].maxLevel,
    potential, skillId: o.skills[skill].id, skillRank: rank };
  const b = new StandardBattle(d, { operators: [build, ...others.map(id => defaultBuild(d.operators[id]))] });
  b.autoFinish = false; b.timeLimit = Infinity; b.setViewport('fullscreen-workspace');
  const deploy = (id = ID, dir = 'RIGHT', r = 2, c = 7) => {
    b.getPlayer('arkpedia').dp = 99;
    const u = b.deployOperator(id, r, c, dir); u.atkCd = 1000; b.getPlayer('arkpedia').dp = 0; return u;
  };
  return { b, deploy };
}
function advance(b, seconds) {
  for (let n = 0; n < Math.round(seconds / b.dt); n++) b.step();
  assert.deepEqual(b.errors, []);
}
function enemy(b, x = 8, y = 2) {
  const e = b.spawnEnemy('enemy_1007_slime', { routeIndex: 1 });
  e.x = x; e.y = y; e.base.maxHp = e.hp = 100000;
  e.base.def = e.base.res = e.base.moveSpeed = 0; e.markDirty(); void e.s; e.hp = 100000;
  b.addBuff(e, { key: 'pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function charge(u) { u.skill.gainSp(u.skill.spCost * u.skill.maxCharges, 'test'); assert.equal(u.skill.activate('test'), true); }
const components = objects => objects.flatMap(o => o.components.map(c => c.data));

test('Fang retains complete source graphs, all rank rows and original model bytes with explicit fidelity bounds', () => {
  assert.deepEqual(REGULAR_OPERATORS[ID].skillIds, ['skchr_fang2_1', 'skchr_fang2_2']);
  assert.equal(evidence.sourceInvestigations.status, 'whole-kit-deferred');
  assert.equal(evidence.status, 'reviewed-regular-stage-adapter'); assert.equal(evidence.frameParity, false);
  assert.match(evidence.verificationLimits.join(' '), /native C# dispatcher/);
  for (const s of Object.values(evidence.tables.skills)) assert.equal(s.levels.length, 10);
  for (const facing of ['Front', 'Back']) {
    const m = evidence.originalModels[ID][facing], binding = evidence.officialFacingBindings[ID][facing];
    const bytes = readFileSync(new URL(`../../arkpedia-sd-assets/${data.sd.models[`operator/${ID}/default/${facing.toLowerCase()}`].skeleton.path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), m.sha256);
    assert.equal(binding.sha256, m.sha256);
    assert.deepEqual(m.hits.Skill_1, [.333, .5]);
  }
  const first = components(evidence.graphs.skills.skchr_fang2_1).find(c => c._additionalTimes != null);
  assert.equal(first._additionalTimes, 1); assert.equal(first._triggerDelta, .25);
  assert.equal(first._waitAttackEventForAllAttacks, 0); assert.equal(first._refreshInputTargetOnCheckSpell, 0);
  const action = evidence.buffTemplates.fang2_t_1.eventToActions.ON_OWNER_FINISH[1];
  assert.equal(action._lifeType, 'UNTIL_NEXT_SPAWN_DECK_TRIGGER_ONCE'); assert.equal(action._exceptOwner, false);
  assert.equal(action._exceptTokenAndTrap, true); assert.equal(action._filterIsInHand, false);
});

test('first-only talent cost, potential and capped original refund survive repeated redeployment', () => {
  for (const [elite, potential, reduction] of [[0, 1, 0], [1, 1, 2], [2, 1, 3], [2, 6, 3]]) {
    const { b, deploy } = make({ elite, potential, rank: elite ? 7 : 4 });
    const raw = b.data.getChess(ID).stats.cost;
    near(b.cost(ID), raw - reduction);
    deploy(); near(b.bench[ID].lastCost, raw - reduction);
    b.retreatOperator(ID); near(b.dp, raw - reduction);
    b.bench[ID].readyAt = b.time;
    near(b.cost(ID), Math.floor(raw * 1.5) - (elite ? 1 : 0));
    deploy(); b.retreatOperator(ID); near(b.dp, raw);
    b.bench[ID].readyAt = b.time;
    near(b.cost(ID), raw * 2 - (elite ? 1 : 0));
    deploy(); b.retreatOperator(ID); near(b.dp, raw);
  }
});

test('withdrawal discounts every ordinary card but only the next successful spawn consumes the shared gift', () => {
  const { b, deploy } = make({ others: [MEL, BEAGLE] });
  const costs = [b.cost(MEL), b.cost(BEAGLE)]; deploy(); b.retreatOperator(ID);
  near(b.cost(MEL), costs[0] - 1); near(b.cost(BEAGLE), costs[1] - 1);
  assert.throws(() => b.deployOperator(MEL, -1, 7, 'RIGHT'));
  near(b.cost(MEL), costs[0] - 1);
  b.getPlayer('arkpedia').dp = 0; assert.throws(() => b.deployOperator(MEL, 2, 7, 'RIGHT'));
  near(b.cost(BEAGLE), costs[1] - 1);
  deploy(MEL); near(b.bench[MEL].lastCost, costs[0] - 1); near(b.cost(BEAGLE), costs[1]);
  // A card already deployed when Fang retreats still receives the next-spawn gift.
  b.bench[ID].readyAt = b.time; deploy(ID, 'RIGHT', 2, 6); b.retreatOperator(ID);
  b.retreatOperator(MEL); b.bench[MEL].readyAt = b.time;
  near(b.cost(MEL), Math.floor(costs[0] * 1.5) - 1);
  deploy(MEL); near(b.cost(BEAGLE), costs[1]);
});

test('death or expiration does not refund DP or produce Fang retreat cards', () => {
  for (const reason of ['killed', 'expired']) {
    const { b, deploy } = make({ others: [MEL] }), cost = b.cost(MEL), u = deploy();
    if (reason === 'killed') b.kill(u); else b.retreat(u, { reason, permanent: true });
    near(b.dp, 0); near(b.cost(MEL), cost);
  }
});

test('normal physical attack is one source-timed strike in all four directions, capped at normal animation rate', () => {
  for (const dir of ['RIGHT', 'DOWN', 'LEFT', 'UP']) {
    const { b, deploy } = make(), u = deploy(ID, dir), e = enemy(b);
    b.addBuff(u, { key: 'speed', mods: { aspd: 100 } });
    b.forceAttack(u, [e]); advance(b, .3); near(e.hp, 100000);
    advance(b, .1); near(100000 - e.hp, u.s.atk);
    advance(b, .3); near(100000 - e.hp, u.s.atk);
  }
});

test('S1 uses selected scale and charge capacity at all ranks, with a distinct delayed second hit', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make({ rank }), u = deploy(), e = enemy(b), bb = u.def.skill.bb;
    assert.equal(u.skill.maxCharges, bb.cnt); charge(u); b.forceAttack(u, [e]);
    advance(b, .3); near(e.hp, 100000); advance(b, .1);
    near(100000 - e.hp, u.s.atk * bb.atk_scale);
    advance(b, .15); near(100000 - e.hp, u.s.atk * bb.atk_scale);
    advance(b, .1); near(100000 - e.hp, u.s.atk * bb.atk_scale * 2);
    assert.equal(u.mem.fangFireSharpenedCast, null);
  }
});

test('S1 never retargets its second strike, and only the credited S1 kill grants the extra DP', () => {
  const { b, deploy } = make(), u = deploy(), first = enemy(b), other = enemy(b);
  first.hp = 1; charge(u); b.forceAttack(u, [first]); advance(b, .7);
  near(b.dp, 2); near(other.hp, 100000);
  other.hp = 1; b.forceAttack(u, [other]); advance(b, .4); near(b.dp, 3);
  const uncredited = enemy(b); b.kill(uncredited); near(b.dp, 3);
});

test('S1 second-hit kill also earns exactly one trait reward plus one skill reward', () => {
  const { b, deploy } = make(), u = deploy(), e = enemy(b);
  e.hp = u.s.atk * u.def.skill.bb.atk_scale * 1.5;
  charge(u); b.forceAttack(u, [e]); advance(b, .4); near(b.dp, 0);
  advance(b, .3); near(b.dp, 2); assert.equal(u.stats.kills, 1);
});

test('S1 lost target before release refunds one charge, without extra damage or DP', () => {
  const { b, deploy } = make(), u = deploy(), e = enemy(b);
  charge(u); const charges = u.skill.charges; b.forceAttack(u, [e]); b.kill(e);
  advance(b, .7); assert.equal(u.skill.charges, charges + 1); near(b.dp, 0);
  assert.equal(u.mem.fangFireSharpenedCast, null);
});

test('S1 blocks SP during both strikes and resumes afterwards', () => {
  const { b, deploy } = make(), u = deploy(), e = enemy(b);
  charge(u); b.forceAttack(u, [e]); advance(b, .54); near(u.skill.sp, 0);
  advance(b, .2); assert.ok(u.skill.sp > 0); assert.ok(!u.s.flags.noSp);
});

test('transient control cancels unreleased S1 strikes even after control ends; retreat cannot hit later', () => {
  for (const timing of [.1, .4]) {
    const { b, deploy } = make(), u = deploy(), e = enemy(b);
    charge(u); b.forceAttack(u, [e]); advance(b, timing); const hp = e.hp;
    b.applyStatus(u, 'stun', { duration: .05 }); advance(b, .7);
    near(e.hp, hp); assert.equal(u.mem.fangFireSharpenedCast, null); assert.equal(u.skill.pending, false);
  }
  const { b, deploy } = make(), u = deploy(), e = enemy(b);
  charge(u); b.forceAttack(u, [e]); advance(b, .4); const hp = e.hp;
  b.retreatOperator(ID); advance(b, .4); near(e.hp, hp);
});

test('S2 applies every selected rank on deployment, expires once and activates fresh on redeployment', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make({ skill: 1, rank }), u = deploy(), bb = u.def.skill.bb;
    assert.equal(u.skill.active, true); near(u.s.atk, u.base.atk * (1 + bb.atk));
    near(u.s.def, u.base.def * (1 + bb.def)); assert.equal(u.s.blockCnt, 2);
    assert.equal(u.mem.regularFormVisual.clip, 'Start_2'); advance(b, 1.1);
    assert.equal(u.mem.regularFormVisual.clip, 'Skill_2_Idle');
    advance(b, u.def.skill.duration); assert.equal(u.skill.active, false);
    near(u.s.atk, u.base.atk); near(u.s.def, u.base.def); assert.equal(u.s.blockCnt, 1);
    assert.equal(u.skill.activate('test'), false); assert.equal(b.activateOperator(ID), false);
    b.retreatOperator(ID); b.bench[ID].readyAt = b.time;
    const fresh = deploy(); assert.notEqual(fresh, u); assert.equal(fresh.skill.active, true);
  }
});

test('S2 has two ground targets at most, never splash/air, using the original .5 attack event', () => {
  for (const dir of ['RIGHT', 'DOWN', 'LEFT', 'UP']) {
    const { b, deploy } = make({ skill: 1 }), u = deploy(ID, dir);
    const [dr, dc] = u.fwd, victims = [enemy(b, 7 + dc * .4, 2 + dr * .4), enemy(b, 7 + dc * .3, 2 + dr * .3)];
    u.blocking = victims; for (const e of victims) e.blockedBy = u;
    const third = enemy(b, 7 + dc * .5, 2 + dr * .5), fly = enemy(b, 7 + dc * .2, 2 + dr * .2); fly.motion = 'FLY';
    const profile = effectiveProfile(u), selected = acquireTargets(b, u, profile);
    assert.equal(selected.length, 2); assert.equal(selected.includes(fly), false);
    b.forceAttack(u, selected); advance(b, .4);
    for (const e of victims) near(e.hp, 100000); advance(b, .14);
    for (const e of victims) near(100000 - e.hp, u.s.atk);
    near(third.hp, 100000); near(fly.hp, 100000);
    const events = b.drainEvents().filter(e => e[0] === 'atk' && e[1] === u.id);
    assert.ok(events.every(e => e[4].animation === (dir === 'DOWN' ? 'Skill_Down_2_Loop' : 'Skill_2_Loop')));
  }
});
