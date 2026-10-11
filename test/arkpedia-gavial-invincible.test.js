// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-gavial-invincible-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, enforceBlockCapacity } from '../server/sim/ai.js';
const ID = 'char_1026_gvial2';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advanceTo(b, time) { while (b.time < time - 1e-9) b.step(); assert.deepEqual(b.errors, []); }
function advance(b, seconds) { advanceTo(b, b.time + seconds); }
function make({ skill = 0, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, potential, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99);
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  const u = b.deployOperator(ID, 5, 5, dir); assert.ok(u);
  u.atkCd = 1000; u.profile.canAttack = () => false;
  return { b, u, receipts };
}
function enemy(b, { x = 6, y = 5, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: 100000, def: 0, res: 0, moveSpeed: 0 }); e.markDirty(); void e.s; e.hp = 100000;
  if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function cast(b, u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate('test'), true); }
function shot(b, u, e) { performAttack(b, u, effectiveProfile(u), [e]); u.atkCd = 1000; }
const outgoing = (rs, u) => rs.filter(r => r.source === u && r.target.side === 'enemy');
const incoming = (b, u, e, amount) => b.dealDamage(e, u, { amount, type: 'true', isAttack: true });
const bbFor = (skill, rank) => Object.fromEntries(source.tables.skills[`skchr_gvial2_${skill + 1}`].levels[rank - 1].blackboard.map(v => [v.key, v.value]));

const block = (b, u, e) => { e.x = u.x; e.y = u.y; assert.equal(b._checkBlock(e), true); assert.equal(e.blockedBy, u); };
const bleed = (rs, u) => rs.filter(r => r.target === u && r.dmg?.tags?.includes('gvial:bleed'));
test('source retains all native templates, selected ranks, fixed pull and direct debt receipts', () => {
  assert.equal(source.source.bundles.length, 5); assert.equal(Object.keys(source.templates).length, 8);
  assert.equal(source.frameParity, false); assert.equal(source.moduleSupport, false);
  assert.equal(Object.values(source.tables.skills).flatMap(s => s.levels).length, 30);
  const cs = source.projectiles.projectile_chr_gvial2_s2.flatMap(g => g.components).map(c => c.data);
  const m = cs.find(c => c._speed != null), p = cs.find(c => c._pullSourceOffset != null);
  near(m._speed, 10); assert.equal(m._keepUpdateTargetpos, 0); assert.equal(m._keepUpdateDirection, 0);
  assert.equal(p._managedBySource, 0); near(p._pullSourceOffset, .5); near(p._lifeTime, 5);
  const action = source.templates['gvial2_s_3[bleed]'].eventToActions.ON_BUFF_TRIGGER[0];
  assert.equal(action._damageType, 'PURE'); assert.equal(action._attackType, 'NORMAL');
  assert.equal(action._skipModifierEvent, true); assert.equal(action._considerUnhurtable, false);
  assert.equal(action._ignoreForSp, true); assert.equal(action._noSourceDamage, false);
  const debt = source.skills.skchr_gvial2_3.flatMap(g => g.components).flatMap(c => c.data._buffs ?? [])
    .find(c => c.buffKey === 'gvial2_s_3'); assert.equal(debt.onEventPriority, -3000);
  for (const face of ['Front', 'Back']) assert.equal(source.models[ID][face].sha256, source.officialSkeletonBindings[ID][face].sha256);
});
for (let skill = 0; skill < 3; skill++) for (let rank = 1; rank <= 10; rank++)
  test(`S${skill + 1} rank ${rank}: source duration, cost, stats, attack and cleanup`, () => {
    const { b, u, receipts } = make({ skill, rank }), s = source.tables.skills[`skchr_gvial2_${skill + 1}`].levels[rank - 1], bb = bbFor(skill, rank);
    near(u.skill.spCost, s.spData.spCost); const atk = u.base.atk, def = u.base.def;
    const blockCnt = u.s.blockCnt; cast(b, u);
    near(u.s.atk, atk * (1.1 + bb.atk)); near(u.s.def, def * (1.1 + (bb.def ?? 0)));
    near(u.s.blockCnt, blockCnt + (bb.block_cnt ?? 0)); near(u.s.aspd, 100 + (bb.attack_speed ?? 0));
    near(u.skill.timeLeft, s.duration);
    if (skill === 1) { assert.ok(u.findBuff('gvial:begin')); advance(b, .85); }
    const e = enemy(b, { x: skill === 1 ? 7 : 6 }); u.hp = 1;
    shot(b, u, e); advance(b, .45); const hits = outgoing(receipts, u);
    assert.equal(hits.length, 1); near(hits[0].amount, atk * (1.1 + bb.atk));
    if (skill === 0) near(u.hp, 1 + hits[0].amount * bb.heal_scale * 1.4);
    else if (skill === 2) { u.hp = u.s.maxHp; incoming(b, u, e, 100); near(u.mem.gvialDebt, 50); }
    advanceTo(b, s.duration + .1); assert.equal(u.skill.active, false);
    near(u.s.aspd, 100); near(u.s.blockCnt, blockCnt); near(u.s.atk, atk * (1.1 + .04 * u.blocking.length));
    if (skill === 2) { const hp = u.hp; advance(b, 20.1); near(u.hp, hp - 50 + bleed(receipts, u).filter(r => r.time <= s.duration + .1).reduce((n, r) => n + r.amount, 0)); }
  });
for (const elite of [0, 1, 2]) for (const potential of [1, 3, 5, 6])
  test(`E${elite} P${potential}: actual blocked enemy count and selected talents`, () => {
    const { b, u } = make({ elite, potential });
    const base = elite === 0 ? 0 : (elite === 1 ? .05 : .1) + (potential >= 3 ? .02 : 0);
    const add = elite === 0 ? 0 : (elite === 1 ? .03 : .04) + (potential >= 3 ? .01 : 0);
    near(u.s.atk, u.base.atk * (1 + base)); const e = enemy(b);
    e.blockWeight = 2; block(b, u, e); near(u.s.atk, u.base.atk * (1 + base + add));
    near(u.s.def, u.base.def * (1 + base + add));
    b._unblock(e); near(u.s.atk, u.base.atk * (1 + base));
    e.blockWeight = 1; block(b, u, e); b.kill(e); near(u.s.atk, u.base.atk * (1 + base));
    for (let i = 0; i < u.s.blockCnt; i++) block(b, u, enemy(b));
    near(u.s.atk, u.base.atk * (1 + base + add * u.s.blockCnt));
    b.releaseBlocked(u); near(u.s.atk, u.base.atk * (1 + base));
    u.hp = u.s.maxHp * .5; const hp = u.hp; b.heal(u, u, 100);
    near(u.hp - hp, elite === 2 ? potential >= 5 ? 125 : 120 : 100);
    u.hp = u.s.maxHp * .5 - 1; const low = u.hp; b.heal(u, u, 100);
    near(u.hp - low, elite === 2 ? potential >= 5 ? 145 : 140 : 100);
  });
test('capacity loss and accepted stun immediately remove block bonuses', () => {
  const { b, u } = make(); for (let i = 0; i < 3; i++) block(b, u, enemy(b));
  b.addBuff(u, { key: 'test:cap', mods: { blockCnt: -2 } }); enforceBlockCapacity(b, u);
  assert.equal(u.blocking.length, 1); near(u.s.atk, u.base.atk * 1.14);
  b.applyStatus(u, 'stun', { duration: 3 }); assert.equal(u.blocking.length, 0); near(u.s.atk, u.base.atk * 1.1);
});
test('axe, healing and active skills are not silenced', () => {
  const { b, u } = make(); cast(b, u); b.applyStatus(u, 'silence', { duration: 5 });
  const e = enemy(b); block(b, u, e); near(u.s.atk, u.base.atk * 1.94);
  u.hp = 1; b.heal(u, u, 100); near(u.hp, 141); assert.equal(u.skill.active, true);
});
test('medical background applies ordinary multipliers but excludes HP regeneration', () => {
  const { b, u } = make(); u.hp = 1; b.addBuff(u, { key: 'test:heal', mods: { healingTakenMul: .5, healingDealtMul: .5 } });
  b.heal(u, u, 100); near(u.hp, 36); b.heal(u, u, 100, { regen: true }); near(u.hp, 61);
  b.addBuff(u, { key: 'test:refuse', flags: { healFree: true } }); b.heal(u, u, 100); near(u.hp, 61);
});
for (const elite of [0, 1, 2]) test(`E${elite}: multi-target cap, retained input, air and zero-block minimum`, () => {
  const { b, u, receipts } = make({ elite }); const es = Array.from({ length: 6 }, () => enemy(b));
  const air = enemy(b, { fly: true }); shot(b, u, es[5]); advance(b, .45);
  const hits = outgoing(receipts, u); assert.equal(hits.length, elite === 2 ? 3 : 2); assert.equal(hits[0].target, es[5]);
  near(air.hp, air.s.maxHp); b.addBuff(u, { key: 'test:no-block', mods: { blockCnt: -9 } });
  shot(b, u, es[0]); advance(b, .45); assert.equal(outgoing(receipts, u).length, hits.length + 1);
});
for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) for (const skill of [0, 1, 2])
  test(`${dir} S${skill + 1}: original facing hit event, uncapped speed and skill clip`, () => {
    const { b, u, receipts } = make({ dir, skill }), e = enemy(b, { x: 5, y: 5 });
    cast(b, u); if (skill === 1) advance(b, .85);
    b.addBuff(u, { key: 'test:aspd', mods: { aspd: 300 } }); shot(b, u, e);
    const delay = .4 / (u.base.bat / u.s.interval); advance(b, delay - .035);
    assert.equal(outgoing(receipts, u).length, 0); advance(b, .07); assert.equal(outgoing(receipts, u).length, 1);
    assert.equal(u.mem.gvialClip, skill === 0 ? 'Skill_1' : skill === 1 ? dir === 'DOWN' ? 'Skill_2_Loop_Down' : 'Skill_2_Loop' : 'Skill_3');
  });
test('S1 heals once per mitigated damage receipt and reevaluates half HP for each victim', () => {
  const { b, u } = make(); cast(b, u); const e = enemy(b); u.hp = u.s.maxHp * .5 - 10;
  const hp = u.hp; b.dealDamage(u, e, { amount: 100, type: 'true', isAttack: false }); near(u.hp - hp, 56);
  const next = u.hp; b.dealDamage(u, e, { amount: 100, type: 'true', isAttack: false }); near(u.hp - next, 48);
  b.addBuff(e, { key: 'test:shield', shield: 1000 }); const shielded = u.hp;
  b.dealDamage(u, e, { amount: 100, type: 'true' }); near(u.hp, shielded);
  b.removeBuff(e, 'test:shield'); b.addBuff(e, { key: 'test:dodge', mods: { dodgePhys: 1 } });
  b.dealDamage(u, e, { amount: 100, type: 'phys' }); near(u.hp, shielded);
  b.addBuff(u, { key: 'test:refuse', flags: { healFree: true } }); b.dealDamage(u, e, { amount: 100, type: 'true' }); near(u.hp, shielded);
});
test('S1 terminates at source duration and cannot heal after the mode ends', () => {
  const { b, u } = make(); cast(b, u); advance(b, 25.1); const e = enemy(b); u.hp = 1;
  b.dealDamage(u, e, { amount: 100, type: 'true' }); near(u.hp, 1);
});
test('S1 overkill healing follows the damage receipt, without turning HP regeneration into damage', () => {
  const { b, u } = make(); cast(b, u); const e = enemy(b); e.hp = 1; u.hp = 1;
  b.dealDamage(u, e, { amount: 100, type: 'true' }); near(u.hp, 57); near(u.stats.dmg, 1);
});
test('a blocked airborne target is legal while other airborne enemies are excluded', () => {
  const { b, u, receipts } = make(), air = enemy(b, { x: 5, y: 5, fly: true });
  b.addBuff(u, { key: 'test:block-air', flags: { blockFly: true } }); block(b, u, air);
  const other = enemy(b, { fly: true }); shot(b, u, air); advance(b, .45);
  assert.equal(outgoing(receipts, u).length, 1); assert.equal(outgoing(receipts, u)[0].target, air); near(other.hp, other.s.maxHp);
});
test('a target lost during windup is replaced by the current legal target, while accepted control cancels an unfired strike', () => {
  const { b, u, receipts } = make(); const first = enemy(b); shot(b, u, first); b.kill(first);
  const next = enemy(b); advance(b, .45); assert.equal(outgoing(receipts, u)[0].target, next);
  shot(b, u, next); b.applyStatus(u, 'stun', { duration: .1 }); advance(b, .5);
  assert.equal(outgoing(receipts, u).length, 1);
});
test('switching into a skill discards the ordinary strike that has not fired', () => {
  const { b, u, receipts } = make(); const e = enemy(b); shot(b, u, e); cast(b, u); advance(b, .45);
  assert.equal(outgoing(receipts, u).length, 0); shot(b, u, e); advance(b, .45); assert.equal(outgoing(receipts, u).length, 1);
});
test('S2 Begin holds attacks, then original range and immutable invisible projectile pull apply', () => {
  const { b, u, receipts } = make({ skill: 1 }); cast(b, u); assert.equal(u.mem.regularFormVisual.clip, 'Skill_2_Begin');
  advance(b, .7); assert.ok(u.findBuff('gvial:begin')); advance(b, .15); assert.equal(u.findBuff('gvial:begin'), null);
  assert.equal(u.mem.regularFormVisual.clip, 'Skill_2_Idle');
  const e = enemy(b, { x: 7 }); shot(b, u, e); advance(b, .45);
  assert.equal(outgoing(receipts, u).length, 1); const p = b.projectiles.list[0]; assert.ok(p);
  near(p.speed, 10); near(p.maxAge, 5); assert.equal(p.target, null); near(p.tx, 7); assert.equal(p.visual, 'none');
  near(e.x, 7); e.x = 8; b._buildEnemyIndex(); advance(b, .07); near(p.tx, 7);
  advance(b, .3); assert.ok(e.x < 7); assert.ok(e.x >= 5.5 - 1e-6);
  u.skill.end(); assert.equal(u.mem.regularFormVisual.clip, 'Skill_2_End'); advance(b, .5); assert.equal(u.mem.regularFormVisual, null);
});
for (const mode of ['own', 'other', 'blocking', 'air', 'invisible', 'immune', 'heavy', 'dead', 'retreat', 'skill-end', 'block-late'])
  test(`S2 pull boundary: ${mode}`, () => {
    const { b, u, receipts } = make({ skill: 1 }); cast(b, u); advance(b, .85);
    const e = enemy(b, { x: 7, fly: mode === 'air' });
    if (mode === 'own') block(b, u, e);
    if (mode === 'other') e.blockedBy = { side: 'ally', id: -2, alive: true, deployed: true, s: { flags: {} }, blocking: [e] };
    if (mode === 'blocking') e.blocking = [{}];
    if (mode === 'invisible') b.addBuff(e, { key: 'test:hidden', flags: { stealth: true } });
    if (mode === 'immune') b.addBuff(e, { key: 'test:immune', flags: { noDisplace: true } });
    if (mode === 'heavy') { e.base.massLevel = 5; e.markDirty(); }
    const x = e.x; shot(b, u, e); advance(b, .45);
    const launched = !['own', 'other', 'blocking', 'air', 'invisible'].includes(mode);
    assert.equal(b.projectiles.list.length, launched ? 1 : 0);
    if (mode === 'dead') b.kill(e);
    if (mode === 'retreat') b.retreat(u);
    if (mode === 'skill-end') u.skill.end();
    if (mode === 'block-late') e.blockedBy = { side: 'ally', id: -2, alive: true, deployed: true, s: { flags: {} }, blocking: [e] };
    advance(b, .5);
    if (['retreat', 'skill-end'].includes(mode)) assert.ok(e.x < x);
    else near(e.x, x);
    if (['air', 'invisible'].includes(mode)) assert.equal(outgoing(receipts, u).length, 0);
  });
test('S3 expands the current target cap to five and restores it on finish', () => {
  const { b, u, receipts } = make({ skill: 2 }); const es = Array.from({ length: 6 }, () => enemy(b));
  cast(b, u); shot(b, u, es[5]); advance(b, .21); assert.equal(outgoing(receipts, u).length, 5);
  u.skill.end(); shot(b, u, es[0]); advance(b, .45); assert.equal(outgoing(receipts, u).length, 8);
});
for (const type of ['phys', 'arts', 'true', 'elemental']) test(`S3 ${type}: caches only the native ANY_ATTACK share after mitigation`, () => {
  const { b, u } = make({ skill: 2 }), e = enemy(b); cast(b, u); const hp = u.hp;
  b.addBuff(u, { key: 'test:mitigate', mods: { dmgTakenMul: .8, physTakenMul: .5, artsTakenMul: .6, trueTakenMul: .7, resFlat: 20 } });
  const expected = type === 'phys' ? Math.max(2000 - u.s.def, 100) * .8 * .5
    : type === 'arts' ? 2000 * .8 * .8 * .6 : type === 'true' ? 2000 * .8 * .7 : 2000;
  b.dealDamage(e, u, { amount: 2000, type });
  near(hp - u.hp, expected * (type === 'elemental' ? 1 : .5)); near(u.mem.gvialDebt, type === 'elemental' ? 0 : expected * .5);
});
test('S3 repays all cached damage in 200 direct pulses without SP, shields, modifiers or immunity', () => {
  const { b, u, receipts } = make({ skill: 2 }), e = enemy(b); cast(b, u); incoming(b, u, e, 200);
  incoming(b, u, e, 400); near(u.mem.gvialDebt, 300); const hp = u.hp;
  u.skill.end(); assert.equal(bleed(receipts, u).length, 0); advance(b, .06); assert.equal(bleed(receipts, u).length, 0);
  b.addBuff(u, { key: 'test:invuln', flags: { invulnerable: true }, mods: { trueTakenMul: 0 }, shield: 1000 });
  advance(b, 20.1); const rs = bleed(receipts, u); assert.equal(rs.length, 200); near(u.hp, hp - 300);
  assert.ok(rs.every(r => r.source === u && r.dmg.noSp && r.dmg.isAttack && !r.dmg.isSkill && !r.dmg.tags.includes('hpLoss')));
  near(u.findBuff('test:invuln').shield, 1000); assert.equal(u.findBuff('gvial:bleed'), null);
});
test('S3 rejects dodge, cancelled and invulnerable hits; HPLOSS and element gauge bypass the reserve', () => {
  const { b, u } = make({ skill: 2 }), e = enemy(b); cast(b, u);
  b.addBuff(u, { key: 'test:dodge', mods: { dodgePhys: 1 } }); b.dealDamage(e, u, { amount: 100, type: 'phys' }); near(u.mem.gvialDebt, 0);
  b.addBuff(u, { key: 'test:invuln', flags: { invulnerable: true } }); incoming(b, u, e, 100); near(u.mem.gvialDebt, 0);
  b.removeBuff(u, 'test:invuln'); b.on('hit', c => { if (c.target === u) c.dmg.cancel = true; });
  incoming(b, u, e, 100); near(u.mem.gvialDebt, 0); b.off('hit');
  const hp = u.hp; b.loseHp(u, 100); near(u.hp, hp - 100); near(u.mem.gvialDebt, 0);
  b.dealDamage(e, u, { amount: 10, type: 'element', element: 'neural' }); near(u.mem.gvialDebt, 0);
});
test('S3 reserve records the pre-shield share, at its source -3000 priority', () => {
  const { b, u } = make({ skill: 2 }), e = enemy(b); cast(b, u); const hp = u.hp;
  b.on('damageFinal', c => { if (c.target === u) c.amount *= .8; }, { priority: -2000 });
  b.on('damageFinal', c => { if (c.target === u) c.amount *= .5; }, { priority: -4000 });
  b.addBuff(u, { key: 'test:shield', shield: 1000 }); incoming(b, u, e, 1000);
  near(u.mem.gvialDebt, 400); near(u.hp, hp); near(u.findBuff('test:shield').shield, 800);
});
test('zero S3 receipts do not create a repayment buff', () => {
  const { b, u } = make({ skill: 2 }); cast(b, u); u.skill.end(); assert.equal(u.findBuff('gvial:bleed'), null);
});
test('S3 continues through control; direct debt during a recast is not reserved twice', () => {
  const { b, u } = make({ skill: 2 }), e = enemy(b); cast(b, u); incoming(b, u, e, 200); u.skill.end();
  cast(b, u); b.applyStatus(u, 'stun', { duration: 2 }); advance(b, 1);
  assert.equal(u.skill.active, true); near(u.mem.gvialDebt, 0); incoming(b, u, e, 100); near(u.mem.gvialDebt, 50);
  u.skill.end(); assert.equal(u.buffs.filter(x => x.key === 'gvial:bleed').length, 1);
  near(u.findBuff('gvial:bleed').data.debt, 50);
});
for (const mode of ['retreat', 'death']) test(`S3 ${mode}: no debt, talent or stale callbacks leak into redeployment`, () => {
  const { b, u } = make({ skill: 2 }), e = enemy(b); cast(b, u); incoming(b, u, e, 100);
  if (mode === 'retreat') b.retreat(u); else b.kill(u);
  assert.equal(u.findBuff('gvial:bleed'), null); advance(b, 71); b.addDp('arkpedia', 99);
  const next = b.deployOperator(ID, 5, 5, 'RIGHT'); assert.ok(next); const hp = next.hp;
  advance(b, 21); near(next.hp, hp); near(next.mem.gvialDebt, 0); near(next.s.atk, next.base.atk * 1.1);
});
test('unpaid direct bleed can kill, with no incoming defensive SP from those pulses', () => {
  const { b, u, receipts } = make({ skill: 2 }), e = enemy(b); cast(b, u); incoming(b, u, e, 200); u.skill.end();
  u.hp = 1; u.skill.spType = 'DEFENSE'; u.skill.setSpTotal(0); advance(b, .2);
  assert.equal(u.alive, false); assert.equal(bleed(receipts, u).length, 2); near(u.skill.spTotal, 0);
});
