// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture, enemy, advance, until, near} from './helpers/hadiya-fixture.js';
import {HADIYA_OWNER_CONTRACT, verifyHadiyaOwner} from '../server/sim/content/arkpedia-hadiya-owner.js';
import {hadiyaNativeInputs} from '../server/sim/content/arkpedia-hadiya-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
const fixtures = [];
function make(options) {
  const f = fixture({owner: true, ...options}); fixtures.push(f);
  f.hits = []; f.attacks = [];
  f.b.on('damaged', c => { if (c.source === f.u) f.hits.push({...c, time: f.b.time}); });
  f.b.on('attack', c => { if (c.attacker === f.u) f.attacks.push({...c, time: f.b.time}); });
  return f;
}
test.afterEach(() => {
  for (const f of fixtures.splice(0)) {
    assert.deepEqual(f.b.errors, []); f.controller.stop(); assert.equal(f.controller.handles.length, 0);
    assert.deepEqual(f.b.errors, []);
  }
});
const cast = f => { f.ready(); assert.equal(f.u.skill.activate(), true); };
const mode = (f, value) => until(f, () => f.controller.mode === value, 10);

test('Complete owner requires original source identity and exact held contract', () => {
  verifyHadiyaOwner();
  assert.throws(() => make({contract: {...HADIYA_OWNER_CONTRACT}}), /exact complete-owner/);
  const f = make(); assert.throws(() => f.controller.install(), /reinstalled/);
});

for (const skill of [1, 2]) test(`Selected S${skill} leaves ordinary attacks single-target with two block slots`, () => {
  const f = make({skill}), a = enemy(f), z = enemy(f);
  until(f, () => f.hits.length === 2);
  assert.equal(f.u.s.blockCnt, 2); assert.equal(f.attacks.length, 2);
  assert.ok(f.attacks.every(a => a.targets.length === 1 && a.isSkill === false));
  near(f.hits[0].time, 1 + .5333333611488342, .04);
  near(a.s.maxHp - a.hp + z.s.maxHp - z.hp, f.u.s.atk * 2);
  assert.equal(f.b.projectiles.list.length, 0);
});

test('Original ordinary replacement dispatch alternates B/A and shared mitigation uses live ATK', () => {
  const f = make(), t = enemy(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  assert.equal(f.u.mem.regularFormVisual.clip, 'Attack_B');
  f.b.addBuff(f.u, {key: 'fixture:atk', mods: {atkPct: .5}});
  t.base.def = 100; t.markDirty();
  until(f, () => f.hits.length === 1); near(f.hits[0].amount, 530 * 1.54 - 100);
  until(f, () => f.controller.phase?.visual?.clip === 'Attack_A');
});

for (const aspd of [-50, 400]) test(`Attack ASPD ${aspd} honors its original capped sampled playback`, () => {
  const f = make(); enemy(f);
  f.b.addBuff(f.u, {key: 'fixture:aspd', mods: {aspd}});
  until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase, start = f.b.time, speed = Math.min(1, f.u.base.bat / f.u.s.interval);
  near(p.speed, speed); near(p.visual.speed, speed);
  f.b.addBuff(f.u, {key: 'fixture:later-aspd', mods: {aspd: 100}});
  until(f, () => f.hits.length === 1);
  near(f.b.time - start, .5333333611488342 / speed, .04);
});

test('Original affectedBySlowDown zero keeps attack/cast clocks independent of its extra channel', () => {
  const f = make(); enemy(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  const p = f.controller.phase, age = p.age;
  f.b.addBuff(f.u, {key: 'fixture:slow-clock', mods: {slowDownMul: 0}});
  advance(f.b, .2); near(p.age - age, .2); near(p.visual.speed, 1);
  cast(f); const castPhase = f.controller.phase;
  advance(f.b, .2); near(castPhase.age, .2, f.b.dt + 1e-6); assert.ok(f.controller.state.primary);
});

for (const [dir, row, col] of [['RIGHT', 5, 6], ['LEFT', 5, 4], ['UP', 6, 5], ['DOWN', 4, 5]])
  test(`S2 ${dir} retains deployment facing and its literal source attack clip`, () => {
    const f = make({skill: 2, dir}); enemy(f, {row, col}); cast(f); mode(f, 2);
    until(f, () => f.hits.length === 1);
    assert.equal(f.u.mem.regularVisualDirection, dir);
    assert.equal(f.u.mem.regularFormVisual.clip, dir === 'DOWN' ? 'Skill_Down_2_Loop' : 'Skill_2_Loop');
    assert.equal(f.attacks[0].isSkill, true); assert.equal(f.hits[0].dmg.isSkill, true);
  });

test('S1 primary appears at its original cast marker and mode waits for clip finish', () => {
  const f = make(); cast(f); const {controller: c, u} = f;
  advance(f.b, .13); assert.equal(c.mode, 0); near(u.s.def, 393); assert.equal(c.state.primary, null);
  advance(f.b, .07); assert.ok(c.state.primary); near(u.s.def, 786); assert.equal(c.mode, 0);
  mode(f, 1); assert.ok(f.b.time >= .8333333134651184); assert.equal(u.skill.activations, 1);
  assert.equal(u.skill.sp, 0); assert.equal(u.skill.charges, 0); assert.equal(u.player.dp, 99);
  assert.ok(skillHud(u.skill).text.includes('Skill active'));
});

test('S1 active adaptation adds original ATK and one talent trigger without another SP activation', () => {
  const f = make(); enemy(f); cast(f); mode(f, 1);
  assert.equal(f.controller.adapt(), true); assert.equal(f.u.player.dp, 89);
  assert.equal(f.u.skill.activations, 1); assert.equal(f.talent.stack.stacks, 2);
  near(f.u.s.atk, 530 * 2.08); near(f.u.s.def, 786);
  assert.equal(f.controller.adapt(), false); assert.equal(f.u.player.dp, 89);
  until(f, () => f.hits.length === 1); near(f.hits[0].amount, 530 * 2.08);
});

test('Full-SP S1 adaptation starts the real skill, grants extra ATK once, and needs 10 DP', () => {
  const f = make(); f.ready(); f.u.player.dp = 9;
  assert.equal(f.controller.adapt(), false); assert.equal(f.u.skill.charges, 1);
  f.u.player.dp = 10; assert.equal(f.controller.adapt(), true);
  assert.equal(f.u.player.dp, 0); assert.equal(f.u.skill.charges, 0); assert.equal(f.u.skill.activations, 1);
  near(f.u.s.atk, 530 * 2.08); assert.equal(f.talent.stack.stacks, 2);
  mode(f, 1); assert.equal(f.controller.adapt(), false);
});

test('S1 finite source primary ends its real account and removes only activation-owned mode/extra', () => {
  const f = make(); cast(f); mode(f, 1); f.controller.adapt();
  const end = f.controller.state.deadline;
  while (f.b.time < end - f.b.dt * 2) advance(f.b, f.b.dt);
  assert.equal(f.u.skill.active, true);
  until(f, () => !f.u.skill.active, 1);
  assert.equal(f.controller.mode, 0); assert.equal(f.controller.owned.size, 0);
  near(f.u.s.def, 393); near(f.u.s.atk, 530 * 1.08);
  advance(f.b, 1); assert.ok(f.u.skill.sp > 0); // the real account recovers
});

test('S2 initial cast pays DP and independently admits ATK/talent before its mode switch', () => {
  const f = make({skill: 2}), far = enemy(f, {col: 8}); cast(f);
  assert.equal(f.u.player.dp, 89); assert.equal(f.talent.stack.stacks, 1);
  advance(f.b, .4); near(f.u.s.atk, 530 * 1.04); assert.equal(f.statuses.length, 0);
  advance(f.b, .07); near(f.u.s.atk, 530 * 2.58); assert.equal(f.talent.stack.stacks, 2);
  assert.equal(far.s.flags.stun, true); assert.equal(f.controller.mode, 0);
  mode(f, 2); assert.equal(f.u.liveRangeGrid.length, 4);
});

for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++)
  test(`Composed S${skill} rank ${rank} uses its selected primary, extra and real SP cost`, () => {
    const f = make({skill, rank}); f.u.player.dp = 35; cast(f); mode(f, skill);
    const bb = f.record.bb, talent = f.record.talentBb[0].atk;
    near(f.u.s.atk, f.u.base.atk * (1 + talent * (skill === 1 ? 1 : 2) + (skill === 2 ? bb.atk : 0)));
    near(f.u.s.def, f.u.base.def * (1 + (skill === 1 ? bb.def : 0)));
    assert.equal(f.controller.adapt(), true);
    near(f.u.s.atk, f.u.base.atk * (1 + talent * (skill === 1 ? 2 : 3)
      + (skill === 1 ? bb['extra.atk'] : bb.atk)));
    assert.equal(f.u.player.dp, skill === 1 ? 25 : 10);
    assert.equal(f.u.skill.spCost, f.record.source.spData.spCost);
    assert.equal(f.u.skill.sp, 0); assert.equal(f.u.skill.charges, 0); assert.equal(f.u.skill.activations, 1);
    assert.equal(f.u.skill.gainSp(100), 0);
  });

for (const skill of [1, 2]) test(`S${skill} selected E1/P6/trust stats are composed without invented E2 talent`, () => {
  const f = make({skill, elite: 1, rank: 7, potential: 6, trust: 200}); cast(f); mode(f, skill);
  assert.equal(f.record.talentBb[0].max_stack_cnt, 3); near(f.record.talentBb[0].atk, .03);
  assert.equal(f.talent.stack.stacks, skill === 1 ? 1 : 2);
  near(f.u.s.atk, f.u.base.atk * (1 + .03 * f.talent.stack.stacks + (skill === 2 ? f.record.bb.atk : 0)));
});

test('S2 retains up to three inputs, shares one receipt and deals separate Physical damage per recipient', () => {
  const f = make({skill: 2}), ts = [enemy(f), enemy(f, {col: 7}), enemy(f, {col: 8}), enemy(f)];
  cast(f); mode(f, 2); until(f, () => f.attacks.length === 1);
  assert.equal(f.attacks[0].targets.length, 3); assert.equal(f.hits.length, 3);
  assert.equal(new Set(f.hits.map(h => h.target)).size, 3);
  assert.equal(new Set(f.hits.map(h => h.dmg.attackId)).size, 1);
  assert.ok(f.hits.every(h => h.dmg.type === 'phys' && !h.dmg.isProjectile));
  near(ts.reduce((n, t) => n + t.s.maxHp - t.hp, 0), f.u.s.atk * 3);
});

test('S2 has no adaptation outside its active account and extends by selected 15 seconds only once', () => {
  const f = make({skill: 2}); f.ready(); assert.equal(f.controller.adapt(), false);
  cast(f); mode(f, 2); const s = f.controller.state;
  f.u.player.dp = 15; const base = s.deadline;
  assert.equal(f.controller.adapt(), true); near(s.deadline - base, 15); assert.equal(f.u.player.dp, 0);
  assert.equal(f.talent.stack.stacks, 3); assert.equal(f.u.skill.activations, 1);
  assert.equal(f.controller.adapt(), false);
  advance(f.b, 21); assert.equal(f.u.skill.active, true);
  until(f, () => !f.u.skill.active, 16); assert.equal(f.controller.mode, 0);
});

test('Removing S2 extension restores its original deadline, including immediate expiry after that deadline', () => {
  for (const late of [false, true]) {
    const f = make({skill: 2}); cast(f); mode(f, 2); f.controller.adapt();
    const s = f.controller.state, base = s.baseDeadline;
    if (late) advance(f.b, 21);
    f.b.removeBuff(f.u, s.extra);
    if (late) assert.equal(f.u.skill.active, false);
    else { near(s.deadline, base); until(f, () => !f.u.skill.active, 21); }
    assert.equal(f.u.skill.activations, 1);
  }
});

test('An S2 extension during startup remains bound to the actual later mode-producer origin', () => {
  const f = make({skill: 2}); cast(f); assert.equal(f.controller.adapt(), true);
  const s = f.controller.state; mode(f, 2);
  near(s.deadline - s.baseDeadline, 15); near(s.baseDeadline, f.b.time + 20, f.b.dt + 1e-6);
  assert.equal(f.u.player.dp, 74); assert.equal(f.talent.stack.stacks, 3);
});

test('A second real activation gets a fresh adaptation allowance without resetting persistent talent stacks', () => {
  const f = make(); cast(f); mode(f, 1); f.controller.adapt();
  f.u.skill.end(); f.ready(); cast(f); mode(f, 1);
  assert.equal(f.controller.adapt(), true); assert.equal(f.u.skill.activations, 2);
  assert.equal(f.u.player.dp, 79); assert.equal(f.talent.stack.stacks, 3);
});

for (const rejected of ['primary', 'mode', 'extra']) for (const skill of [1, 2])
  test(`S${skill} independently rejected ${rejected} does not fabricate or roll back other native actions`, () => {
    const f = make({skill});
    f.b.on('beforeBuff', ctx => {
      const k = ctx.buff.data?.nativeKey;
      if (ctx.unit === f.u && k?.startsWith(`hadiya_s_${skill}`)
        && (rejected === 'primary' ? k.endsWith('[buff]') : rejected === 'mode' ? k.endsWith('[switch_mode]')
          : k.endsWith('[extra_buff]') || k.endsWith('[extand_time]'))) ctx.cancel = true;
    });
    cast(f); advance(f.b, 1.1); const s = f.controller.state;
    assert.equal(!!s.primary, rejected !== 'primary'); assert.equal(!!s.mode, rejected !== 'mode');
    assert.equal(f.controller.mode, rejected === 'mode' ? 0 : skill);
    assert.equal(f.controller.adapt(), true); assert.equal(!!s.extra, rejected !== 'extra');
    assert.equal(f.u.player.dp, skill === 1 ? 89 : 74);
    assert.equal(f.controller.adapt(), false); assert.equal(f.u.skill.activations, 1);
    assert.equal(f.talent.stack.stacks, skill === 2 && rejected !== 'primary' ? 3 : 2);
    until(f, () => !f.u.skill.active, 37);
  });

for (const skill of [1, 2]) test(`S${skill} cast interruption cancels unborn primary and force-next enters mode`, () => {
  const f = make({skill}); cast(f);
  f.b.applyStatus(f.u, 'stun', {duration: .2}); advance(f.b, .04);
  assert.equal(f.controller.mode, skill); assert.equal(f.controller.state.primary, null);
  assert.equal(f.u.skill.active, true); assert.equal(f.talent.stack.stacks, 1);
  until(f, () => !f.u.skill.active, 31);
});

test('Active skill buffs/duration survive action controls and silence does not block native manual casting', () => {
  const f = make({skill: 2}); f.b.applyStatus(f.u, 'silence', {duration: 30}); cast(f); mode(f, 2);
  const state = f.controller.state, atk = f.u.s.atk;
  f.b.applyStatus(f.u, 'stun', {duration: 2}); advance(f.b, 1);
  assert.equal(f.u.skill.active, true); assert.equal(f.controller.state === state, true); near(f.u.s.atk, atk);
  assert.equal(f.controller.adapt(), false); // cannot perform manual adaptation while controlled
});

test('S2 source-to-default art mix plays original End without retaining a fake SP hold', () => {
  const f = make({skill: 2}); cast(f); mode(f, 2);
  f.u.skill.end(); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_2_End');
  assert.equal(f.controller.phase.kind, 'end'); assert.equal(f.u.skill.active, false);
  advance(f.b, .3); assert.ok(f.u.skill.sp > 0); assert.equal(f.u.skill.activate(), false);
  advance(f.b, .4); assert.equal(f.controller.phase, null); assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
});

test('Shared End cannot run a new original attack during its local presentation lock', () => {
  const f = make({skill: 2}), t = enemy(f); cast(f); mode(f, 2); f.u.skill.end();
  const cd = f.u.atkCd;
  assert.equal(f.controller.beginAttack([t]), false); near(f.u.atkCd, cd);
});

for (const dir of ['RIGHT', 'UP']) test(`Death keeps the literal ${dir} S2 pose and absent Back stays hidden`, () => {
  const f = make({skill: 2, dir}); cast(f); mode(f, 2); f.b.kill(f.u, null);
  if (dir === 'UP') assert.equal(f.u.mem.regularDeathVisual.hide, true);
  else { assert.equal(f.u.mem.regularDeathVisual.clip, 'Skill_2_Die'); near(f.u.mem.regularDeathVisual.duration, 1); }
});

test('Rejected real-account cast leaves Born, DP and SP unchanged', () => {
  const f = make({skill: 2}); f.ready(); f.u.player.dp = 9;
  const visual = f.u.mem.regularFormVisual;
  assert.equal(f.u.skill.activate(), false); assert.equal(f.u.mem.regularFormVisual === visual, true);
  assert.equal(f.controller.phase.kind, 'born'); assert.equal(f.u.player.dp, 9);
  assert.equal(f.u.skill.charges, 1); assert.equal(f.u.skill.sp, f.u.skill.spCost);
});

for (const skill of [1, 2]) test(`S${skill} real time-SP recovery reaches readiness without automatically casting`, () => {
  const f = make({skill});
  assert.equal(f.u.skill.sp, f.record.source.spData.initSp);
  assert.equal(f.u.skill.ready, false);
  until(f, () => f.u.skill.ready, 35);
  assert.equal(f.u.skill.activations, 0); assert.equal(f.u.player.dp, 99);
  assert.equal(skillHud(f.u.skill).canActivate, true);
  if (skill === 2) {
    f.u.player.dp = 9; assert.equal(skillHud(f.u.skill).canActivate, false);
    assert.equal(f.u.skill.activate(), false); assert.equal(f.u.skill.charges, 1);
    f.u.player.dp = 10;
  }
  assert.equal(f.u.skill.activate(), true); assert.equal(f.u.skill.charges, 0);
});

test('Withdrawing Hadiya does not request a native death pose', () => {
  const f = make({skill: 2}); cast(f); mode(f, 2); f.b.retreat(f.u);
  assert.equal(f.u.mem.regularDeathVisual.hide, true);
});

test('Mutation of an owner stat descriptor cannot grant unreviewed source modifiers', () => {
  const f = make();
  f.b.on('beforeBuff', ctx => {
    if (ctx.buff.data?.nativeKey === 'hadiya_s_1[buff]') ctx.buff.mods.defPct = 20;
  });
  cast(f); mode(f, 1); assert.equal(f.controller.state.primary, null); near(f.u.s.def, f.u.base.def);
});

for (const which of ['primary', 'mode', 'extra']) test(`Replacing S2 ${which} preserves its foreign replacement`, () => {
  const f = make({skill: 2}); cast(f); mode(f, 2); f.controller.adapt();
  const original = f.controller.state[which], replacement = f.b.addBuff(f.u, {key: original.key, mods: {defPct: .2}});
  advance(f.b, .04);
  assert.equal(f.u.findBuff(original.key), replacement);
  assert.equal(f.u.skill.active, which === 'extra');
  if (which === 'extra') near(f.controller.state.deadline, f.controller.state.baseDeadline);
  f.controller.stop(); assert.equal(f.u.findBuff(original.key), replacement);
});

test('No early or repeated forceAttack can fabricate an original release', () => {
  const f = make(), t = enemy(f); f.b.forceAttack(f.u, [t]); assert.equal(f.attacks.length, 0);
  until(f, () => f.controller.phase?.kind === 'attack');
  f.b.forceAttack(f.u, [t]); assert.equal(f.attacks.length, 0);
  until(f, () => f.attacks.length === 1); f.b.forceAttack(f.u, [t]); assert.equal(f.attacks.length, 1);
});

for (const action of ['veto', 'substitute', 'recursive', 'life', 'control'])
  test(`${action} during beforeAttack cannot borrow or duplicate the retained S2 batch`, () => {
    const f = make({skill: 2}), a = enemy(f), z = enemy(f), replacement = enemy(f, {col: 15});
    cast(f); mode(f, 2);
    f.b.on('beforeAttack', ctx => {
      if (ctx.attacker !== f.u) return;
      if (action === 'veto') ctx.targets = [];
      if (action === 'substitute') ctx.targets = [replacement];
      if (action === 'recursive') f.b.forceAttack(f.u, [a, z]);
      if (action === 'life') f.u.deploySeq++;
      if (action === 'control') f.b.applyStatus(f.u, 'stun', {duration: .2});
    });
    advance(f.b, .8);
    assert.equal(f.attacks.length, action === 'recursive' ? 1 : 0);
    assert.equal(f.hits.length, action === 'recursive' ? 2 : 0);
    near(replacement.hp, replacement.s.maxHp);
  });

test('A lost retained input is not replaced by a late entrant at the same marker', () => {
  const f = make({skill: 2}), a = enemy(f), z = enemy(f, {col: 7}), outside = enemy(f, {col: 15});
  cast(f); mode(f, 2); until(f, () => f.controller.phase?.kind === 'attack');
  a.hidden = true; outside.x = 6;
  until(f, () => f.attacks.length === 1);
  assert.equal(f.hits.length, 1); assert.equal(f.hits[0].target === z, true); near(outside.hp, outside.s.maxHp);
});

for (const how of ['retreat', 'death', 'life', 'account', 'hidden', 'stop', 'battleEnd'])
  test(`Source ${how} retires only its own active Hadiya work`, () => {
    const f = make({skill: 2}); enemy(f); cast(f); mode(f, 2); f.controller.adapt();
    until(f, () => f.controller.phase?.kind === 'attack'); const hits = f.hits.length;
    const foreign = f.b.addBuff(f.u, {key: 'fixture:foreign', mods: {defPct: .1}});
    if (how === 'retreat') f.b.retreat(f.u);
    if (how === 'death') f.b.kill(f.u, null);
    if (how === 'life') { f.u.deploySeq++; f.u.mem.regularFormVisual = {clip: 'foreign'}; }
    if (how === 'account') f.u.skill = null;
    if (how === 'hidden') f.u.hidden = true;
    if (how === 'stop') f.controller.stop();
    if (how === 'battleEnd') { f.b.finished = true; f.b.emit('battleEnd', {}); }
    advance(f.b, .8);
    assert.equal(f.hits.length, hits); assert.equal(f.controller.handles.length, 0);
    assert.equal(f.controller.owned.size, 0); assert.equal(f.payment.handles.length, 0);
    if (!['death', 'retreat'].includes(how)) assert.equal(f.u.buffs.includes(foreign), true);
    if (how === 'life') assert.equal(f.u.mem.regularFormVisual.clip, 'foreign');
  });

for (const change of ['count', 'clock', 'slow', 'range', 'target', 'repeat', 'outside', 'marker', 'lifetime', 'extension'])
  test(`Changed source ${change} cannot certify the composed owner`, () => {
    const n = structuredClone(hadiyaNativeInputs());
    if (change === 'count') n.modes[2].selector._limitedMaxTargetNumToBlockedCnt = 1;
    if (change === 'clock') n.modes[0].attack._maxAnimScale = -1;
    if (change === 'slow') n.modes[0].attack._affectedBySlowDown = 1;
    if (change === 'range') n.modes[1].range._extendable = 1;
    if (change === 'target') n.modes[2].selector._targetMotion = 3;
    if (change === 'repeat') n.skills[0].root._maxRetriggerCount = 2;
    if (change === 'outside') n.skills[1].root._allowRetriggerOutsideSkill = 1;
    if (change === 'marker') n.skills[0].marker._runActionOnEvent = 6;
    if (change === 'lifetime') n.skills[1].marker._buffs[0].lifeTimeType = 1;
    if (change === 'extension') n.templates['hadiya_s_2[extand_time]'].eventToActions.ON_BUFF_FINISH[0]._useOriginalCooldown = false;
    assert.throws(() => verifyHadiyaOwner(n), /Changed original/);
  });

for (const change of ['stat', 'modeBB', 'extraStat', 'mix']) test(`Changed native ${change} refuses owner admission`, () => {
  const n = structuredClone(hadiyaNativeInputs());
  if (change === 'stat') n.skills[0].marker._buffs[0].attributes.attributeModifiers[0].attributeType = 1;
  if (change === 'modeBB') n.skills[1].mode._buffs[0].blackboard[0].value = 1;
  if (change === 'extraStat') n.skills[0].extra._buffs[0].attributes.attributeModifiers[0].formulaItem = 0;
  if (change === 'mix') n.art._mixSettings[0].mixAnimName = 'Idle';
  assert.throws(() => verifyHadiyaOwner(n), /Changed original/);
});
