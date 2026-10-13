// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-rmixer-prefabs.json' with { type: 'json' };
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { RMIXER_SKILL_CONTRACT as CONTRACT, RMIXER_RUNTIME_CONTRACT as PUBLIC_CONTRACT, prepareRmixerSkills } from '../server/sim/content/arkpedia-rmixer-skills.js';
import { make as fixture, enemy, advance, until, cast } from './helpers/rmixer-fixture.js';
const ID = 'char_4194_rmixer';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
const make = opts => fixture({ skill: 1, contract: CONTRACT, prepare: prepareRmixerSkills, ...opts });
const stacks = f => f.u.buffs.find(x => x.key === 'rmixer:damage-stacks');
const charge = f => f.u.skill.gainSp(f.u.skill.spCost, 'fixture');
function ammoAlly(f, { col = 6, row = 5, tags = ['laterano'], active = true, kind = 'ammo', flags = {} } = {}) {
  const def = normalizeChess({ chessId: `fixture:ammo:${row}:${col}`, stats: { maxHp: 5000, atk: 0, def: 0,
    cost: 0, blockCnt: 0 }, tags, rangeGrid: [[0, 0]],
    skill: { skillId: 'fixture:ammo', durationType: kind === 'ammo' ? 'AMMO' : 'TIME', spCost: 0 } });
  const u = f.b._makeAlly(f.u.player, def, 'op', row, col, { dir: 'RIGHT' });
  f.b._setupUnit(u, { trait: { noAttack: true }, skill: { kind, ammo: 30, duration: 99, trigger: 'NEVER' } });
  assert.ok(f.b._deploy(u, { initial: false }));
  if (active) assert.ok(u.skill.activate('fixture', { free: true }));
  if (kind === 'ammo' && active) u.skill.ammoLeft = 10;
  f.b.addBuff(u, { key: 'fixture:flags', flags });
  return u;
}
function input(f, source, { amount = 1, type = 'true', ...extra } = {}) {
  return f.b.dealDamage(source, f.u, { amount, type, isAttack: true, ...extra });
}
function readyS3(f) { cast(f); until(f, () => f.u.mem.regularFormVisual.clip === 'Skill_3_Idle'); }

test('full diagnostic requires its own explicit contract and retains its historical source hold', () => {
  assert.ok(data.operators[ID]); assert.deepEqual(evidence.enabledOperators, []);
  assert.equal(CONTRACT.frameParity, false);
  assert.match(CONTRACT.limits, /literal maxStackCnt of one/);
  assert.match(CONTRACT.mapping, /multiple recipients are explicitly held/);
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed skill contract/);
  assert.throws(() => make({ mutate: d => d.skill.bb.atk_scale++ }), /Incomplete/);
});

test('every selected S1 rank launches three native-event projectiles for one charge and holds SP until completion', () => {
  for (const elite of [0, 1, 2]) for (let rank = 1; rank <= [4, 7, 10][elite]; rank++) {
    const f = make({ elite, rank }); enemy(f); charge(f);
    until(f, () => f.controller.phase?.s1); const p = f.controller.phase;
    assert.equal(f.u.skill.active, true); assert.equal(f.u.skill.pending, true);
    assert.equal(f.u.skill.activations, 1); assert.equal(f.u.skill.charges, 0);
    assert.equal(f.u.skill.gainSp(99, 'gift'), 0);
    near(p.events[1] - p.events[0], .23333333432674408);
    near(p.events[2] - p.events[0], .46666666865348816);
    until(f, () => f.hits.length === 3);
    for (const hit of f.hits) {
      near(hit.hpLoss, f.u.base.atk * f.record.bb.atk_scale);
      assert.equal(hit.dmg.isSkill, true); assert.deepEqual(hit.dmg.tags, ['rmixer:s1']);
    }
    assert.equal(f.attacks.length, 3); assert.equal(f.ammo.length, 0);
    assert.equal(f.u.skill.active, true);
    until(f, () => !f.u.skill.active);
    assert.equal(f.resources.completed.size, 1);
    assert.equal(f.u.skill.gainSp(1, 'gift'), 1);
    assert.equal(f.u.skill.active, false);
  }
});

test('S1 uses original Front/Back clocks scaled at ability birth, not three simultaneous hits', () => {
  for (const [dir, row, col, aspd, speed] of [['RIGHT', 5, 6, 200, 3], ['UP', 6, 5, -50, .5]]) {
    const f = make({ dir }); enemy(f, { row, col }); charge(f);
    f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd } });
    until(f, () => f.controller.phase?.s1); const p = f.controller.phase;
    near(p.speed, speed); near(p.events[2] - p.events[0], .46666666865348816 / speed);
    until(f, () => f.attacks.length === 3);
    assert.ok(f.attacks[1].time > f.attacks[0].time);
    assert.ok(f.attacks[2].time > f.attacks[1].time);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_Loop');
  }
});

test('S1 naturally earns defensive SP and suppresses every recovery source during its three-shot cast', () => {
  const f = make(), t = enemy(f);
  assert.equal(f.u.skill.sp, 3); input(f, t);
  assert.equal(f.u.skill.charges, 1);
  until(f, () => f.attacks.length === 1);
  input(f, t); assert.equal(f.u.skill.sp, 0); assert.equal(f.u.skill.charges, 0);
  assert.equal(f.u.skill.gainSp(9, 'gift'), 0);
  until(f, () => !f.u.skill.active);
  input(f, t); assert.equal(f.u.skill.sp, 1);
});

test('S1 replenishes the sole nearby active Laterano ammo recipient once per ability, never per bullet', () => {
  const f = make(), ally = ammoAlly(f), recovered = [];
  f.b.on('rmixerAmmoRecovered', ctx => recovered.push(ctx)); enemy(f); charge(f);
  until(f, () => f.hits.length === 3);
  assert.equal(ally.skill.ammoLeft, 11); assert.equal(ally.skill.ammoMax, 30);
  assert.equal(recovered.length, 1); assert.equal(recovered[0].recipient, ally);
  assert.equal(f.u.skill.kind, 'instant'); assert.equal(f.ammo.length, 0);
});

test('S1 does not invent compiled ordering when two recipients are eligible', () => {
  const f = make(), a = ammoAlly(f), z = ammoAlly(f, { row: 6 }), held = [];
  f.b.on('rmixerRecipientHeld', ctx => held.push(ctx)); enemy(f); charge(f);
  until(f, () => f.hits.length === 3);
  assert.equal(a.skill.ammoLeft, 10); assert.equal(z.skill.ammoLeft, 10);
  assert.equal(held.length, 1); assert.deepEqual(new Set(held[0].candidates), new Set([a.id, z.id]));
  assert.equal(held[0].postFilter, 66);
});

test('public S1 selects missing ammo before deployment order, then newest deployment without using taunt', () => {
  for (const mode of ['missing-first', 'latest-time', 'same-tick-sequence', 'full-tie', 'exhausted-newest']) {
    const f = make({ contract: PUBLIC_CONTRACT }), a = ammoAlly(f);
    if (mode === 'latest-time') advance(f, .1);
    const z = ammoAlly(f, { row: 6 });
    a.aggroSeq = z.deploySeq + 100; z.aggroSeq = 0;
    let expected = z;
    if (mode === 'missing-first') { z.skill.ammoLeft = z.skill.ammoCapacity; expected = a; }
    if (mode === 'full-tie') { a.skill.ammoLeft = a.skill.ammoCapacity; z.skill.ammoLeft = z.skill.ammoCapacity; }
    if (mode === 'exhausted-newest') { z.skill.replenishAmmo(99); z.skill.ammoLeft = 0; expected = a; }
    const beforeA = a.skill.ammoLeft, beforeZ = z.skill.ammoLeft;
    enemy(f); charge(f); until(f, () => f.hits.length === 3);
    assert.equal(a.skill.ammoLeft, beforeA + Number(expected === a), mode);
    assert.equal(z.skill.ammoLeft, beforeZ + Number(expected === z), mode);
  }
});

test('public S1 revalidates captured recipients if recovery retires the source', () => {
  const f = make({ contract: PUBLIC_CONTRACT }), a = ammoAlly(f), z = ammoAlly(f, { row: 6 });
  const original = z.skill.spec.onAmmoReplenish;
  z.skill.spec.onAmmoReplenish = ctx => { original?.(ctx); f.b.retreat(f.u, { permanent: true }); };
  f.controller.replenish(true);
  assert.equal(z.skill.ammoReplenished, 1); assert.equal(a.skill.ammoReplenished, 0);
  assert.equal(f.controller.stopped, true); assert.equal(f.u.alive, false);
});

test('S1 filters out inactive, wrong-group, non-ammo, isolated, hidden and outside-range recipients', () => {
  for (const options of [{ active: false }, { tags: ['ursus'] }, { kind: 'duration' },
    { flags: { isolated: true } }, { col: 7 }, { col: 15 }, { flags: {}, hidden: true }]) {
    const f = make(), a = ammoAlly(f, options), old = a.skill.ammoLeft;
    if (options.hidden) a.hidden = true;
    enemy(f); charge(f); until(f, () => f.hits.length === 3);
    assert.equal(a.skill.ammoLeft, old);
  }
});

test('S1 reaches every surrounding tile for every facing, independently of ordinary attack-range extensions', () => {
  for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const f = make({ dir }), a = ammoAlly(f, { row: 5 + dr, col: 5 + dc });
    f.b.addBuff(f.u, { key: 'fixture:range', mods: { rangeExtend: 5 } });
    f.controller.replenish(true);
    assert.equal(a.skill.ammoLeft, 11, `${dir} ${dr},${dc}`);
    assert.equal(a.skill.ammoReplenished, 1);
  }
  const f = make(), a = ammoAlly(f, { col: 7 });
  f.b.addBuff(f.u, { key: 'fixture:range', mods: { rangeExtend: 5 } });
  f.controller.replenish(true); assert.equal(a.skill.ammoLeft, 10);
});

test('an exhausted recovery allowance removes a recipient from S1 ambiguity and bounds S3 grants', () => {
  const f = make(), a = ammoAlly(f), z = ammoAlly(f, { row: 6 }), recovered = [];
  assert.equal(z.skill.replenishAmmo(100), 30);
  f.b.on('rmixerAmmoRecovered', ctx => recovered.push(ctx));
  f.controller.replenish(true);
  assert.equal(a.skill.ammoLeft, 11); assert.equal(z.skill.ammoLeft, 40);
  assert.equal(recovered.length, 1); assert.equal(recovered[0].recipient, a);
  const g = make({ skill: 3 }), other = ammoAlly(g, { col: 14 });
  assert.equal(other.skill.replenishAmmo(29), 29);
  g.b.on('rmixerAmmoRecovered', ctx => recovered.push(ctx));
  cast(g);
  assert.equal(other.skill.ammoReplenished, 30); assert.equal(other.skill.ammoLeft, 40);
  assert.equal(recovered.at(-1).count, 1); assert.equal(other.skill.ammoCapacity, 30);
  g.controller.replenish(false); assert.equal(recovered.length, 2);
});

test('Sankta S1 and S3 replenish a public Lemuen build through her real ammunition controller', () => {
  for (const skill of [1, 3]) {
    const op = data.operators.char_4193_lemuen;
    assert.ok(op, 'Pinned public Lemuen source');
    const build = { ...defaultBuild(op), elite: 2, level: 90, skillId: 'skchr_lemuen_1', skillRank: 10 };
    const f = make({ skill, operators: [build] });
    f.b.addDp('arkpedia', 99);
    const a = f.b.deployOperator(op.id, 4, 5, 'RIGHT'); assert.ok(a);
    advance(f, 1.1); assert.ok(a.skill.activate('fixture', { free: true }));
    const ammo = a.mem.lemuenAmmunition, before = ammo.current;
    if (skill === 1) f.controller.replenish(true); else cast(f);
    const added = skill === 1 ? f.record.bb.charge : f.record.bb.ammo;
    assert.equal(ammo.current, before + added); assert.equal(a.skill.ammoReplenished, added);
    enemy(f, { row: 4, col: 6 });
    until(f, () => ammo.current < before + added);
    assert.equal(a.skill.ammoLeft, ammo.current); assert.equal(a.skill.active, true);
  }
});

test('S3 keeps its fixed counter range while extensions still affect ordinary attacks after it ends', () => {
  const f = make({ skill: 3 });
  f.b.addBuff(f.u, { key: 'fixture:range', mods: { rangeExtend: 5 } });
  readyS3(f);
  const outside = enemy(f, { col: 9 }); input(f, outside);
  assert.equal(f.hits.length, 0); assert.equal(f.u.skill.ammoLeft, 29);
  f.u.skill.end('manual');
  until(f, () => f.controller.phase?.kind !== 'transition');
  assert.ok(f.controller.targets().includes(outside));
});

test('S1 reselection uses a living legal enemy after an earlier wave kills its input', () => {
  const f = make(), a = enemy(f, { hp: 100 }), z = enemy(f, { col: 6.2 }); charge(f);
  until(f, () => f.hits.length === 3);
  assert.equal(a.alive, false); assert.equal(f.hits.filter(h => h.target === z).length, 2);
  assert.equal(f.u.skill.activations, 1);
});

test('S1 target loss before its first event returns one charge without an accepted completion', () => {
  const f = make(), a = enemy(f); charge(f);
  until(f, () => f.controller.phase?.s1); f.b.kill(a, f.u);
  advance(f, f.b.dt);
  assert.equal(f.hits.length, 0); assert.equal(f.u.skill.active, false);
  assert.equal(f.u.skill.charges, 1); assert.equal(f.resources.completed.size, 0);
  assert.equal(!!f.u.s.flags.noSp, false);
});

test('S1 transient control cancels later unissued events, retains born shots and unlocks SP', () => {
  const f = make(), a = enemy(f, { col: 7 }); charge(f);
  until(f, () => f.attacks.length === 1);
  f.b.applyStatus(f.u, 'stun', { duration: f.b.dt / 2 });
  advance(f, .8);
  assert.equal(f.attacks.length, 1);
  assert.equal(f.hits.filter(h => h.dmg.isSkill).length, 1);
  assert.equal(f.hits[0].target, a); assert.equal(f.u.skill.active, false);
  assert.equal(!!f.u.s.flags.noSp, false); assert.equal(f.resources.completed.size, 1);
});

test('every S3 rank applies selected stats/range and stops ordinary attacking during the skill', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 3, rank }); readyS3(f);
    const bb = f.record.bb;
    near(f.u.s.atk, f.u.base.atk * (1 + bb.atk)); near(f.u.s.def, f.u.base.def * (1 + bb.def));
    near(f.u.s.maxHp, f.u.base.maxHp * (1 + bb.max_hp));
    near(f.u.s.interval, f.u.base.bat * bb.base_attack_time);
    assert.equal(f.u.skill.ammoLeft, 30); assert.deepEqual(f.u.skill.spec.targeting.rangeGrid, f.record.skillRange);
    enemy(f); advance(f, 2); assert.equal(f.hits.length, 0); assert.equal(f.attacks.length, 0);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_Idle');
    input(f, f.b.enemies[0]); assert.equal(f.hits.length, 1);
    near(f.hits[0].hpLoss, f.u.base.atk * (1 + bb.atk)); assert.equal(f.u.skill.ammoLeft, 29);
  }
});

test('S3 counters use the rotated selected range and original Front/Back idle at all four facings', () => {
  for (const [dir, row, col, face] of [['RIGHT', 5, 6, 'Front'], ['UP', 6, 5, 'Back'],
    ['LEFT', 5, 4, 'Back'], ['DOWN', 4, 5, 'Front']]) {
    const f = make({ skill: 3, dir }); readyS3(f); const t = enemy(f, { row, col });
    input(f, t); assert.equal(f.hits.length, 1); assert.equal(f.hits[0].target, t);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_Idle');
    assert.equal(f.controller.model(), evidence.models[ID][face]);
  }
});

test('S3 globally replenishes other active Laterano ammo skills, including an owner outside attack range', () => {
  const f = make({ skill: 3 }), a = ammoAlly(f, { col: 15 }), z = ammoAlly(f), wrong = ammoAlly(f, { col: 9, tags: ['ursus'] });
  readyS3(f);
  assert.equal(a.skill.ammoLeft, 14); assert.equal(z.skill.ammoLeft, 14); assert.equal(wrong.skill.ammoLeft, 10);
  assert.equal(f.u.skill.ammoLeft, 30); // table's 'other' contract; native owner exclusion stays explicitly held
});

test('S3 directly damages at most three legal ground/aerial targets and spends one round per group', () => {
  const f = make({ skill: 3 }); readyS3(f);
  const targets = [enemy(f), enemy(f, { col: 6.1 }), enemy(f, { row: 6, col: 6, fly: true }), enemy(f, { col: 7 })];
  const initialAtk = f.u.s.atk;
  input(f, targets[0]);
  assert.equal(f.hits.length, 3); assert.equal(f.attacks.length, 1); assert.equal(f.b.projectiles.list.length, 0);
  assert.equal(new Set(f.hits.map(h => h.target)).size, 3);
  for (const h of f.hits) { near(h.hpLoss, initialAtk); assert.deepEqual(h.dmg.tags, ['rmixer:s3']); }
  assert.equal(f.ammo.length, 1); assert.equal(f.u.skill.ammoLeft, 29);
  input(f, targets[0]); assert.equal(f.hits.length, 3); assert.equal(f.u.skill.ammoLeft, 29);
  advance(f, f.u.s.interval + f.b.dt); input(f, targets[0]);
  assert.equal(f.hits.length, 6); assert.equal(f.u.skill.ammoLeft, 28);
});

test('S3 cooldown follows current ASPD and source BAT, consumes empty-input counters and keeps the barrier timer', () => {
  const f = make({ skill: 3 }); readyS3(f);
  f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd: 100 } });
  const before = f.resources.waitAt, now = f.b.time;
  input(f, null); near(f.controller.counterAt - now, .06);
  assert.equal(f.u.skill.ammoLeft, 29); assert.equal(f.resources.waitAt, before);
  assert.equal(f.resources.completed.size, 1); assert.equal(f.hits.length, 0);
  input(f, null); assert.equal(f.u.skill.ammoLeft, 29);
  advance(f, .1); input(f, null); assert.equal(f.u.skill.ammoLeft, 28);
});

test('S3 responds to accepted shielded damage, but not invulnerability, dodge, canceled damage, HP loss or element gauges', () => {
  for (const mode of ['shield', 'invulnerable', 'dodge', 'cancel', 'hpLoss', 'element']) {
    const f = make({ skill: 3 }); readyS3(f); const t = enemy(f);
    if (mode === 'shield') f.b.addBuff(f.u, { key: 'fixture:shield', shield: 9999 });
    if (mode === 'invulnerable') f.b.addBuff(f.u, { key: 'fixture:invul', flags: { invulnerable: true } });
    if (mode === 'dodge') f.b.addBuff(f.u, { key: 'fixture:dodge', mods: { dodgePhys: 1 } });
    if (mode === 'cancel') f.b.on('damageFinal', ctx => { if (ctx.target === f.u) ctx.cancel = true; });
    if (mode === 'hpLoss') f.b.loseHp(t, f.u, 1);
    else input(f, t, { type: mode === 'dodge' ? 'phys' : mode === 'element' ? 'element' : 'true' });
    assert.equal(f.hits.length, mode === 'shield' ? 1 : 0, mode);
    assert.equal(f.u.skill.ammoLeft, mode === 'shield' ? 29 : 30, mode);
  }
});

test('S3 input legality, attack cancellation and abnormal controls cannot spend rejected counter groups', () => {
  for (const mode of ['cancel', 'stun', 'disarm']) {
    const f = make({ skill: 3 }); readyS3(f); const t = enemy(f);
    if (mode === 'cancel') f.b.on('beforeAttack', ctx => { if (ctx.attacker === f.u) ctx.targets.length = 0; });
    if (mode === 'stun') f.b.applyStatus(f.u, 'stun', { duration: 2 });
    if (mode === 'disarm') f.b.addBuff(f.u, { key: 'fixture:disarm', flags: { disarm: true } });
    input(f, t); assert.equal(f.hits.length, 0); assert.equal(f.u.skill.ammoLeft, 30);
  }
  const f = make({ skill: 3 }); readyS3(f);
  for (const flags of [{ stealth: true }, { camou: true }]) enemy(f, { flags });
  const sleepy = enemy(f); f.b.applyStatus(sleepy, 'sleep', { duration: 99 });
  enemy(f, { col: 15 }); input(f, null);
  assert.equal(f.hits.length, 0); assert.equal(f.u.skill.ammoLeft, 29); // genuinely empty input allowed
});

test('last S3 group uses active stats before ending, restores range/stats, and allows the real cancel command', () => {
  const f = make({ skill: 3 }); readyS3(f); const t = enemy(f); f.u.skill.ammoLeft = 1;
  const atk = f.u.s.atk; input(f, t);
  near(f.hits[0].hpLoss, atk); assert.equal(f.u.skill.active, false);
  near(f.u.s.atk, f.u.base.atk); near(f.u.s.maxHp, f.u.base.maxHp);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_End');
  until(f, () => f.u.mem.regularFormVisual.clip !== 'Skill_3_End');
  until(f, () => f.hits.some(h => !h.dmg.isSkill));
  const g = make({ skill: 3 }); readyS3(g); g.b.bench[ID] = { unit: g.u };
  assert.ok(g.b.activateOperator(ID)); assert.equal(g.u.skill.active, false);
  assert.equal(g.u.mem.regularFormVisual.clip, 'Skill_3_End');
});

test('S3 reentrant incoming damage cannot recursively duplicate the same counter or spend new activations', () => {
  const f = make({ skill: 3 }); readyS3(f); const t = enemy(f);
  f.b.on('damaged', ctx => { if (ctx.source === f.u) input(f, t); });
  input(f, t); assert.equal(f.hits.length, 1); assert.equal(f.ammo.length, 1);
  assert.equal(f.u.skill.ammoLeft, 29);
  const g = make({ skill: 3 }); readyS3(g); const z = enemy(g);
  g.b.on('beforeAttack', ctx => { if (ctx.attacker === g.u) g.b.retreat(g.u); });
  input(g, z); assert.equal(g.hits.length, 0); assert.equal(g.ammo.length, 0); assert.equal(g.controller.stopped, true);
});

test('S3 native Begin blocks counters until ready; lethal accepted input cannot keep a dead controller active', () => {
  const f = make({ skill: 3 }); cast(f); const t = enemy(f);
  input(f, t); assert.equal(f.hits.length, 0); assert.equal(f.u.skill.ammoLeft, 30);
  until(f, () => f.u.mem.regularFormVisual.clip === 'Skill_3_Idle');
  f.b.removeBuff(f.u, 'rmixer:idle-barrier');
  input(f, t, { amount: f.u.hp * 2 });
  assert.equal(f.hits.length, 1); // explicit accepted pre-HP counter mapping
  assert.equal(f.u.alive, false); assert.equal(f.controller.stopped, true);
  assert.equal(stacks(f), undefined); advance(f, 2); assert.equal(f.hits.length, 1);
});

test('S2 remains completion-driven with the talent installed, including its final round and survival guard', () => {
  const f = make({ skill: 2 }); cast(f); const t = enemy(f);
  const atk = f.u.s.atk; f.u.skill.ammoLeft = 1;
  until(f, () => f.hits.length === 1);
  near(f.hits[0].hpLoss, atk); assert.equal(f.ammo.length, 1); assert.equal(f.u.skill.active, false);
  assert.equal(stacks(f).stacks, 1); near(f.u.s.def, f.u.base.def + 30);
  const g = make({ skill: 2 }); cast(g); g.u.skill.ammoLeft = 10;
  input(g, t, { amount: 1e8 });
  assert.ok(g.u.alive); assert.equal(g.u.skill.active, false); assert.equal(g.ammo.length, 0);
});

test('talent uses each selected elite DEF/ASPD, a shared refreshed timer and the explicit table cap', () => {
  for (const elite of [0, 1, 2]) {
    const f = make({ elite }), t = enemy(f); advance(f, 1);
    for (let i = 0; i < 5; i++) f.b.dealDamage(f.u, t, { amount: 1, type: 'true' });
    if (elite === 0) { assert.equal(stacks(f), undefined); continue; }
    assert.equal(stacks(f).stacks, 3);
    near(f.u.s.def, f.u.base.def + [0, 20, 30][elite] * 3);
    near(f.u.s.aspd, 100 + [0, 2, 3][elite] * 3);
    f.b.addBuff(f.u, { key: 'fixture:no-attacks', flags: { disarm: true } });
    advance(f, 9); f.b.dealDamage(f.u, t, { amount: 1, type: 'true' });
    assert.equal(stacks(f).stacks, 3); advance(f, 9); assert.ok(stacks(f));
    advance(f, 1 + f.b.dt); assert.equal(stacks(f), undefined); near(f.u.s.def, f.u.base.def);
  }
});

test('talent counts accepted fully absorbed output, excludes canceled/evaded/invulnerable/HP-loss/gauge output', () => {
  for (const mode of ['shield', 'cancel', 'dodge', 'invulnerable', 'hpLoss', 'element']) {
    const f = make(), t = enemy(f); advance(f, 1);
    if (mode === 'shield') f.b.addBuff(t, { key: 'fixture:shield', shield: 1000 });
    if (mode === 'cancel') f.b.on('damageFinal', ctx => { if (ctx.source === f.u) ctx.cancel = true; });
    if (mode === 'dodge') f.b.addBuff(t, { key: 'fixture:dodge', mods: { dodgePhys: 1 } });
    if (mode === 'invulnerable') f.b.addBuff(t, { key: 'fixture:invul', flags: { invulnerable: true } });
    if (mode === 'hpLoss') f.b.loseHp(f.u, t, 1);
    else f.b.dealDamage(f.u, t, { amount: 1, type: mode === 'dodge' ? 'phys' : mode === 'element' ? 'element' : 'true' });
    assert.equal(stacks(f)?.stacks ?? 0, mode === 'shield' ? 1 : 0, mode);
  }
});

test('retirement stops remaining S1 events and stacks while its born projectile keeps retirement ATK', () => {
  const f = make(), t = enemy(f, { col: 7 }); charge(f);
  until(f, () => f.attacks.length === 1);
  const atk = f.u.s.atk; f.b.retreat(f.u); advance(f, 1);
  assert.equal(f.hits.length, 1); near(f.hits[0].hpLoss, atk * f.record.bb.atk_scale);
  assert.equal(f.hits[0].target, t); assert.equal(stacks(f), undefined);
  assert.equal(f.controller.stopped, true); assert.equal(f.u.mem.regularFormVisual, null);
  assert.equal(!!f.u.s.flags.noSp, false);
});

test('battle finish cancels pending events/counters and repeated stop cannot remove a later stack', () => {
  const f = make(); enemy(f); charge(f); until(f, () => f.attacks.length === 1);
  f.b.forceEnd('fixture'); advance(f, 1); assert.equal(f.hits.length, 0); assert.equal(f.controller.stopped, true);
  assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.pending, false); assert.equal(!!f.u.s.flags.noSp, false);
  const g = make({ skill: 3 }); readyS3(g); const t = enemy(g); g.controller.stop();
  g.b.addBuff(g.u, { key: 'rmixer:damage-stacks', mods: { defFlat: 77 } });
  g.controller.stop(); assert.ok(stacks(g));
  input(g, t); assert.equal(g.hits.length, 0); assert.equal(g.ammo.length, 0);
});
