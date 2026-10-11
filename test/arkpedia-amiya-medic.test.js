// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-amiya-medic-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, catalogueFor } from '../shared/arkpedia/loadout.js';
import { prepareSquad } from '../shared/arkpedia/squad.js';
import { compileReviewedOperators } from '../tools/arkpedia/operator-source.mjs';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { dirVec } from '../server/sim/dir.js';
const ID = 'char_1037_amiya3';
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make({ skill = 0, rank = 10, elite = 2, potential = 1, companions = [] } = {}) {
  const src = structuredClone(data), op = src.operators[ID];
  src.stage.geometry.waves[0].spawns = []; src.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(op), elite, level: op.phases[elite].maxLevel, potential,
    skillId: op.skills[skill].id, skillRank: Math.min(rank, elite === 0 ? 4 : elite === 1 ? 7 : 10) };
  const extra = companions.map(id => ({ ...defaultBuild(src.operators[id]), elite: 0, level: 1,
    skillId: src.operators[id].skills[0].id, skillRank: 1 }));
  const b = new StandardBattle(src, { operators: [build, ...extra] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const hits = [], heals = [];
  b.on('damaged', ctx => hits.push(ctx)); b.on('calculatedHeal', ctx => heals.push(ctx));
  const deploy = (id = ID, r = 3, c = 4, dir = 'RIGHT') => {
    b.getPlayer('arkpedia').dp = 90; const u = b.deployOperator(id, r, c, dir); assert.ok(u);
    u.atkCd = 1000; u.skill.rule = 'NEVER'; u.profile.canAttack = () => false;
    return u;
  };
  return { b, deploy, hits, heals };
}
function enemy(b, { r = 3, c = 5, def = 0, res = 0, fly = false, hp = 100000 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [r, c] });
  Object.assign(e.base, { maxHp: hp, def, res, moveSpeed: 1, massLevel: 10 });
  e.markDirty(); void e.s; e.hp = hp; if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex();
  return e;
}
function cast(b, u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(b.activateOperator(ID), true); }
function shot(b, u, targets) { assert.equal(b.forceAttack(u, targets), true); u.atkCd = 1000; }
const dealt = (hits, u) => hits.filter(h => h.source === u);
const directHeals = (heals, u) => heals.filter(h => h.source === u && !h.opts.regen);

test('Medic compiles complete Global form identity, unlock and both literal source skills', () => {
  const op = data.operators[ID]; assert.equal(op.name, 'Amiya (Medic)'); assert.equal(op.sourceName, 'Amiya');
  assert.equal(op.formOf, 'char_002_amiya'); assert.equal(op.profession, 'MEDIC');
  assert.deepEqual(op.formUnlock, evidence.tables.unlockConds[ID]);
  const global = { characters: {}, skills: evidence.tables.skills, ranges: evidence.tables.ranges,
    forms: { patchChars: { [ID]: evidence.tables.character }, infos: { char_002_amiya: evidence.tables.formInfo },
      unlockConds: evidence.tables.unlockConds, patchDetailInfoList: evidence.tables.patchDetailInfoList } };
  assert.deepEqual(compileReviewedOperators({ registry: { [ID]: REGULAR_OPERATORS[ID] }, global })[ID], op);
  for (const skill of op.skills) assert.deepEqual(skill.levels, evidence.tables.skills[skill.id].levels.map(l => l.rangeId
    ? { ...l, rangeGrid: evidence.tables.ranges[l.rangeId].grids.map(p => [p.row, p.col]) } : l));
});
test('all Amiya form pairs are rejected across squad and maxed support', () => {
  const ids = ['char_002_amiya', 'char_1001_amiya2', ID], catalogue = catalogueFor(data);
  for (const a of ids) for (const z of ids) if (a !== z) {
    const one = defaultBuild(data.operators[a]), two = defaultBuild(data.operators[z]);
    assert.throws(() => prepareSquad({ operators: [one, two] }, catalogue), /one form/);
    assert.throws(() => prepareSquad({ operators: [one], support: { id: z, skillId: two.skillId } }, catalogue), /one form/);
  }
});
test('normal attack releases one legal ground/air Arts projectile at the original event and flight delay', () => {
  const { b, deploy, hits } = make({ elite: 0 }), u = deploy(), e = enemy(b, { res: 20, def: 10000 }), other = enemy(b, { c: 5.1 });
  assert.equal(acquireTargets(b, u, effectiveProfile(u)).length, 1);
  shot(b, u, [e]); advance(b, .73); assert.equal(dealt(hits, u).length, 0);
  advance(b, .3); assert.equal(dealt(hits, u).length, 1); near(dealt(hits, u)[0].hpLoss, u.s.atk * .8); near(other.hp, 100000);
  const air = enemy(b, { fly: true }); shot(b, u, [air]); advance(b, 1.1);
  assert.equal(dealt(hits, u).at(-1).target, air);
});
test('trait heals calculated damage through overkill and shields, not real HP loss', () => {
  for (const kind of ['overkill', 'shield', 'floor']) {
    const { b, deploy, hits, heals } = make({ elite: 0, companions: ['char_208_melan'] }), u = deploy(), a = deploy('char_208_melan', 2, 5);
    a.hp = 1; const e = enemy(b, { hp: kind === 'overkill' ? 1 : 100000, res: 50 });
    if (kind === 'shield') b.addBuff(e, { key: 'test:shield', shield: 10000 });
    if (kind === 'floor') b.addBuff(e, { key: 'test:floor', mods: { damageHpFloorRatio: 1 } });
    shot(b, u, [e]); advance(b, 1.1);
    const hs = directHeals(heals, u); assert.equal(hs.length, 1); assert.equal(hs[0].target, a);
    near(hs[0].amount, u.s.atk * .5 * .5);
    assert.ok(dealt(hits, u)[0].hpLoss < hs[0].amount);
  }
});
test('trait selects the lowest eligible HP ratio in attack range and skips hidden/no-heal allies', () => {
  const { b, deploy, heals } = make({ elite: 0, companions: ['char_208_melan', 'char_123_fang', 'char_240_wyvern'] });
  const u = deploy(), a = deploy('char_208_melan', 2, 5), blocked = deploy('char_123_fang', 3, 6), outside = deploy('char_240_wyvern', 3, 2);
  a.hp = a.s.maxHp * .2; blocked.hp = 1; outside.hp = 1;
  b.addBuff(blocked, { key: 'test:no-heal', flags: { noHeal: true } });
  const e = enemy(b); shot(b, u, [e]); advance(b, 1.1); assert.equal(directHeals(heals, u)[0].target, a);
  b.addBuff(a, { key: 'test:hidden', flags: { untargetable: true } });
  u.hp = 1; heals.length = 0; shot(b, u, [e]); advance(b, 1.1); assert.equal(directHeals(heals, u)[0].target, u);
});
test('every S1 rank uses selected ASPD and separate ATK-based area healing before the trait', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy, heals } = make({ rank, companions: ['char_208_melan', 'char_123_fang'] });
    const u = deploy(), ahead = deploy('char_208_melan', 2, 5), behind = deploy('char_123_fang', 3, 2), e = enemy(b, { res: 50 });
    cast(b, u); advance(b, .3); u.hp = ahead.hp = behind.hp = 1;
    b.addBuff(u, { key: 'test:damage-scale', mods: { atkScaleMul: 2 } });
    shot(b, u, [e]); advance(b, .8);
    near(u.s.aspd, 100 + u.skill.bb.attack_speed);
    const hs = directHeals(heals, u); assert.equal(hs.length, 4);
    assert.deepEqual(new Set(hs.slice(0, 3).map(h => h.target)), new Set([u, ahead, behind]));
    for (const h of hs.slice(0, 3)) near(h.amount, u.s.atk * u.skill.bb.heal_scale);
    near(hs[3].amount, u.s.atk * 2 * .5 * .5);
  }
});
test('S1 healing area does not enlarge enemy attack range or heal without an attack receipt', () => {
  const { b, deploy, heals } = make(), u = deploy(), e = enemy(b, { c: 2 });
  const base = [...u.rangeKeys]; cast(b, u); advance(b, .3); assert.deepEqual(u.rangeKeys, base);
  assert.equal(acquireTargets(b, u, effectiveProfile(u)).includes(e), false);
  advance(b, 1); assert.equal(directHeals(heals, u).length, 0);
});
test('S1 can heal target-free allies in its area but respects heal-free/no-heal recipients', () => {
  const { b, deploy, heals } = make({ companions: ['char_208_melan', 'char_123_fang', 'char_240_wyvern'] });
  const u = deploy(), a = deploy('char_208_melan', 3, 2), noHeal = deploy('char_123_fang', 2, 4), healFree = deploy('char_240_wyvern', 4, 4);
  b.addBuff(a, { key: 'test:target-free', flags: { untargetable: true } });
  b.addBuff(noHeal, { key: 'test:no-heal', flags: { noHeal: true } });
  b.addBuff(healFree, { key: 'test:heal-free', flags: { healFree: true } });
  cast(b, u); advance(b, .3); a.hp = noHeal.hp = healFree.hp = 1;
  shot(b, u, [enemy(b)]); advance(b, .8);
  assert.ok(directHeals(heals, u).some(h => h.target === a));
  assert.ok(directHeals(heals, u).every(h => ![noHeal, healFree].includes(h.target)));
});
test('damage dodge/immunity and non-attack damage never create an S1 area-heal receipt', () => {
  for (const kind of ['dodge', 'invulnerable', 'not-attack']) {
    const { b, deploy, heals } = make(), u = deploy(), e = enemy(b); cast(b, u); advance(b, .3);
    if (kind === 'dodge') { b.addBuff(e, { key: 'test:dodge', mods: { dodgeArts: 1 } }); b.rng = () => 0; }
    if (kind === 'invulnerable') b.addBuff(e, { key: 'test:invuln', flags: { invulnerable: true } });
    b.dealDamage(u, e, { amount: 100, type: 'arts', isAttack: kind !== 'not-attack' });
    const hs = directHeals(heals, u); assert.equal(hs.length, kind === 'not-attack' ? 1 : 0);
  }
});
test('unfired attacks cancel on brief control; fired Arts projectiles retain their damage after skill end', () => {
  const { b, deploy, hits, heals } = make(), u = deploy(), e = enemy(b, { c: 7 });
  shot(b, u, [e]); advance(b, .3); b.applyStatus(u, 'stun', { duration: .01 }); advance(b, 1);
  assert.equal(dealt(hits, u).length, 0);
  cast(b, u); advance(b, .3); shot(b, u, [e]); advance(b, .47); u.skill.end('test'); advance(b, .5);
  assert.equal(dealt(hits, u).length, 1); assert.equal(dealt(hits, u)[0].type, 'arts');
  assert.equal(directHeals(heals, u).length, 1);
});
test('ordinary/S1 release and Begin timing preserve four facings and capped playback', () => {
  for (const dir of ['UP', 'RIGHT', 'DOWN', 'LEFT']) {
    const { b, deploy } = make(), u = deploy(ID, 3, 4, dir); b.addBuff(u, { key: 'test:fast', mods: { aspd: 200 } });
    near(effectiveProfile(u).windup(b, u), .76666665); cast(b, u);
    const back = ['UP', 'LEFT'].includes(dir); advance(b, 7 * b.dt);
    assert.equal(!!u.mem.amiyaMedicCast, back); advance(b, .1);
    near(effectiveProfile(u).windup(b, u), .43333334);
    b.addBuff(u, { key: 'test:slow', mods: { aspd: -325 } });
    near(effectiveProfile(u).windup(b, u), .43333334 / .5);
  }
});
test('S2 every rank independently mitigates a snapshot Arts burst and caps enemy-hit ATK stacks', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy, hits } = make({ skill: 1, rank }), u = deploy(), bb = u.skill.bb;
    const victims = Array.from({ length: 7 }, (_, i) => enemy(b, { c: 5 + i * .02, res: 30, fly: i === 6 }));
    const atk = u.s.atk; cast(b, u); advance(b, 1.05); assert.equal(dealt(hits, u).length, 0);
    advance(b, .15); assert.equal(dealt(hits, u).length, 7);
    for (const h of dealt(hits, u)) near(h.hpLoss, atk * bb.atk_scale * .7);
    near(u.s.atk, atk * (1 + 5 * bb.atk)); assert.equal(u.mem.amiyaMedicBurstStacks, 5);
    assert.ok(victims.every(e => e.findBuff('amiya3:debuff')));
  }
});
test('S2 no-target activation consumes its one use without ATK stacks and cannot refund it on retreat', () => {
  const { b, deploy } = make({ skill: 1 }), u = deploy(); cast(b, u); advance(b, 2);
  assert.equal(u.mem.amiyaMedicBurstStacks, 0); assert.equal(u.findBuff('amiya3:atk'), null);
  u.skill.end('test'); advance(b, .3); u.skill.setSpTotal(20); assert.equal(b.activateOperator(ID), false);
  b.retreatOperator(ID); advance(b, 71); const next = deploy(); next.skill.setSpTotal(20);
  assert.equal(b.activateOperator(ID), false); assert.equal(next.skill.exhausted, true);
  const fresh = make({ skill: 1 }); cast(fresh.b, fresh.deploy());
});
test('post-burst attacks deliver True damage to exactly two distinct legal victims', () => {
  const { b, deploy, hits, heals } = make({ skill: 1 }), u = deploy(); cast(b, u); advance(b, 2);
  const victims = Array.from({ length: 3 }, (_, i) => enemy(b, { c: 5 + i * .1, def: 99999, res: 100 }));
  const targets = acquireTargets(b, u, effectiveProfile(u)); assert.equal(targets.length, 2);
  shot(b, u, targets); advance(b, .7); assert.equal(dealt(hits, u).length, 2);
  for (const h of dealt(hits, u)) { assert.equal(h.type, 'true'); near(h.hpLoss, u.s.atk); }
  near(victims.find(e => !targets.includes(e)).hp, 100000); assert.equal(directHeals(heals, u).length, 2);
});
test('S2 debuffs use each selected rank duration and survive the caster skill ending', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make({ skill: 1, rank }), u = deploy(), e = enemy(b); cast(b, u); advance(b, 1.2);
    near(e.s.aspd, 40); near(e.s.moveSpeed, .4); const ttl = e.findBuff('amiya3:debuff').timeLeft;
    u.skill.end('test'); advance(b, .3); assert.ok(e.findBuff('amiya3:debuff'));
    advance(b, ttl); assert.equal(e.findBuff('amiya3:debuff'), null); near(e.s.aspd, 100); near(e.s.moveSpeed, 1);
    assert.equal(u.findBuff('amiya3:atk'), null);
  }
});
test('burst targets are sampled at release; invalid targets receive no stack/debuff and later kills add none', () => {
  const { b, deploy, hits } = make({ skill: 1 }), u = deploy(), outside = enemy(b, { c: 2 }), hidden = enemy(b), immune = enemy(b);
  b.addBuff(hidden, { key: 'test:stealth', flags: { stealth: true } });
  b.addBuff(immune, { key: 'test:invuln', flags: { invulnerable: true } }); cast(b, u);
  advance(b, .5); const late = enemy(b, { hp: 1 }); advance(b, .7);
  assert.equal(dealt(hits, u).length, 1); assert.equal(dealt(hits, u)[0].target, late);
  assert.equal(u.mem.amiyaMedicBurstStacks, 1); near(outside.hp, 100000); near(hidden.hp, 100000);
  assert.equal(immune.findBuff('amiya3:debuff'), null); b.kill(outside, u); assert.equal(u.mem.amiyaMedicBurstStacks, 1);
});
test('S2 cast is interruptible without granting invulnerability, untargetability or status immunity', () => {
  for (const status of ['stun', 'freeze', 'sleep', 'levitate']) {
    const { b, deploy, hits } = make({ skill: 1 }), u = deploy(), e = enemy(b); cast(b, u);
    assert.equal(!!u.s.flags.invulnerable, false); assert.equal(!!u.s.flags.untargetable, false);
    const hp = u.hp; b.dealDamage(e, u, { amount: 100, type: 'true' }); near(u.hp, hp - 100);
    advance(b, .5); assert.equal(b.applyStatus(u, status, { duration: .01 }), true); advance(b, 1);
    assert.equal(dealt(hits, u).length, 0); assert.equal(u.mem.amiyaMedicCast, null);
    assert.equal(b.bench[ID].amiyaMedicSecondUsed, true);
  }
});
test('promotion/potential aura values compose with unrelated HP modifiers and reach later allies', () => {
  for (const [elite, potential, pct, regen] of [[0,1,0,0], [1,1,.05,.015], [2,1,.08,.025], [2,6,.08,.025]]) {
    const { b, deploy } = make({ elite, potential, companions: ['char_208_melan'] }), u = deploy();
    near(u.s.maxHp, u.base.maxHp * (1 + pct)); cast(b, u);
    const a = deploy('char_208_melan', 2, 2); near(a.s.maxHp, a.base.maxHp * (1 + pct));
    near(a.s.hpRegen, a.s.maxHp * regen); a.hp = a.s.maxHp * .4;
    b.addBuff(a, { key: 'other:hp', mods: { hpPct: .2 } }); near(a.hpRatio, .4);
    near(a.s.maxHp, a.base.maxHp * (1 + pct + .2)); near(a.s.hpRegen, a.s.maxHp * regen);
    u.skill.end('test'); near(a.s.hpRegen, 0); b.retreatOperator(ID);
    near(a.s.maxHp, a.base.maxHp * 1.2); assert.equal(a.findBuff('amiya3:hp'), null);
  }
});
test('active talent regeneration heals no-heal allies without becoming a direct S1/trait heal', () => {
  const { b, deploy, heals } = make({ companions: ['char_208_melan'] }), u = deploy(), a = deploy('char_208_melan', 2, 2);
  b.addBuff(a, { key: 'test:no-heal', flags: { noHeal: true } }); cast(b, u); a.hp = 1;
  const hp = a.hp; advance(b, 1); assert.ok(a.hp > hp); near(a.s.hpRegen, a.s.maxHp * .025);
  assert.equal(directHeals(heals, u).length, 0); assert.equal(a.buffs.filter(v => v.key === 'amiya3:regen').length, 1);
});
test('skill expiry, death, retreat and battle end clear owned casts/ATK/auras without resetting S2 use', () => {
  for (const reason of ['expire', 'death', 'retreat', 'battleEnd']) {
    const { b, deploy } = make({ skill: 1, companions: ['char_208_melan'] }), u = deploy(), a = deploy('char_208_melan', 2, 2);
    enemy(b); cast(b, u); advance(b, 2); assert.ok(u.findBuff('amiya3:atk'));
    if (reason === 'expire') advance(b, 30.3); else if (reason === 'death') b.kill(u, null);
    else if (reason === 'retreat') b.retreatOperator(ID); else b.emit('battleEnd', {});
    assert.equal(u.findBuff('amiya3:atk'), null); assert.equal(u.mem.amiyaMedicCast, null);
    assert.equal(a.findBuff('amiya3:regen'), null); if (reason !== 'expire') assert.equal(a.findBuff('amiya3:hp'), null);
    assert.equal(b.bench[ID].amiyaMedicSecondUsed, true);
  }
});
