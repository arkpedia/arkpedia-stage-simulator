// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-sand-reckoner-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { summonRecordFor, summonCardId, summonUnitId } from '../shared/arkpedia/summons.js';
import { deployRegularSummon, retreatRegularSummon, regularSummonCards, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';

const ID = 'char_4140_lasher', TOKEN = 'token_10036_lasher_mcbird', FANG = 'char_123_fang';
const near = (a, e, t = 1e-5) => assert.ok(Math.abs(a - e) < t, `${a} != ${e}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function make({ skill = 0, rank = 10, elite = 2, level = null, potential = 1, trust = 0, dir = 'RIGHT', others = [] } = {}) {
  const source = structuredClone(data), op = source.operators[ID];
  source.stage.geometry.waves[0].spawns = []; source.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(op), elite, level: level ?? op.phases[elite].maxLevel, potential, trust,
    skillId: op.skills[skill].id, skillRank: rank };
  const b = new StandardBattle(source, { operators: [build, ...others.map(id => defaultBuild(source.operators[id]))] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, build: 'ALL', pass: 'ALL' }));
  const deploy = (id = ID, row = 1, col = 4) => {
    b.addDp('arkpedia', 99); const u = b.deployOperator(id, row, col, dir); assert.ok(u); u.atkCd = 1000;
    u.skill.rule = 'NEVER'; return u;
  };
  return { b, u: deploy(), build, deploy };
}
const bb = (skill, rank = 10) => Object.fromEntries(data.operators[ID].skills[skill].levels[rank - 1].blackboard.map(x => [x.key, x.value]));
const card = b => regularSummonCards(b).find(s => s.ownerId === ID);
const bird = (b, row = 2, col = 5, dir = 'RIGHT') => {
  const t = deployRegularSummon(b, summonCardId(ID), row, col, dir); assert.ok(t); t.atkCd = 1000; return t;
};
function cast(b, u) {
  u.skill.setSpTotal(u.skill.spCost);
  assert.equal(u.skill.manual ? b.activateOperator(ID) : u.skill.activate('test'), true); assert.equal(u.skill.active, true);
  for (const t of b.allyUnits) t.atkCd = 1000;
}
function enemy(b, { x = 6, y = 2, res = 0, def = 0, fly = false, machine = false, weight = 1 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.x = x; e.y = y; e.base.maxHp = 100000; e.base.def = def; e.base.res = res; e.base.moveSpeed = 0;
  e.base.massLevel = weight; if (fly) e.motion = 'FLY'; if (machine) e.tags.add('machine');
  e.markDirty(); void e.s; e.hp = 100000;
  b.addBuff(e, { key: 'pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
const shot = (b, u, e, seconds = 1) => { b.forceAttack(u, [e]); u.atkCd = 1000; advance(b, seconds); };

test('all20 source ranks select a complete Arts kit without generic ATK amplification', () => {
  for (let skill = 0; skill < 2; skill++) for (let rank = 1; rank <= 10; rank++) {
    const { b, u } = make({ skill, rank });
    near(u.s.atk, u.base.atk); assert.equal(u.profile.dmgType, 'arts'); assert.equal(u.profile.maxTargets, 1);
    assert.equal(u.profile.retargetOnRelease, false); assert.equal(u.skill.kind, 'duration'); assert.deepEqual(b.errors, []);
  }
});
test('born stocks3/4/5 and native four stored cards plus ready card allow a five summon cap', () => {
  for (const elite of [0, 1, 2]) {
    const { b, build } = make({ elite, rank: [4, 7, 10][elite] }), r = summonRecordFor(ID, build, data.tokens);
    assert.equal(card(b).stock, elite + 3); assert.equal(r.stats.maxDeployCount, 5); assert.equal(r.stats.maxDeckStackCnt, 5);
    assert.equal(r.stats.respawnTime, 10);
  }
});
test('Fowlbeast uses its own selected source stats without inherited trust or potential', () => {
  for (const elite of [0, 1, 2]) for (const level of [1, data.operators[ID].phases[elite].maxLevel]) {
    const { b } = make({ elite, level, potential: 6, trust: 200, rank: [4, 7, 10][elite] }), t = bird(b);
    const frames = data.tokens[TOKEN].phases[elite].attributesKeyFrames, lo = frames[0], hi = frames.at(-1);
    for (const key of ['atk', 'def', 'maxHp']) near(t.base[key], Math.round(lo.data[key] +
      (hi.data[key] - lo.data[key]) * (level - lo.level) / (hi.level - lo.level)));
    assert.equal(t.def.skill, null); assert.equal(t.s.flags.healFree, true); near(t.base.bat, 1.6);
  }
});
test('high-ground deployment spends8DP, one slot and one stock, with chosen facing and10s redeploy', () => {
  const { b, u } = make(), dp = b.dp, slots = b.deployedSlots();
  b.grid.tiles[1 * 21 + 5].build = 'MELEE';
  assert.match(summonPlacementError(b, summonCardId(ID), 1, 5), /tile/);
  b.grid.tiles[2 * 21 + 5].build = 'RANGED';
  const t = bird(b, 2, 5, 'LEFT'); near(dp - b.dp, 8); assert.equal(b.deployedSlots(), slots + 1);
  assert.equal(t.dir, 'LEFT'); assert.equal(t.ownerUnit, u); assert.equal(card(b).stock, 4); near(card(b).readyAt, 10);
  assert.equal(summonPlacementError(b, summonCardId(ID), 2, 6), 'Summon is still redeploying.');
  advance(b, 10); assert.equal(summonPlacementError(b, summonCardId(ID), 2, 6), null);
});
test('retreat refunds4DP and defeat or withdrawal never replenish spent Fowlbeasts', () => {
  for (const defeat of [false, true]) {
    const { b } = make(), t = bird(b), dp = b.dp;
    if (defeat) b.kill(t, enemy(b)); else retreatRegularSummon(b, summonUnitId(t));
    assert.equal(t.alive, false); near(b.dp - dp, defeat ? 0 : 4); assert.equal(card(b).stock, 4); near(card(b).readyAt, 10);
  }
});
test('missing original summon, invalid phase and fabricated deck limits fail closed', () => {
  const { build } = make(), tokens = structuredClone(data.tokens); delete tokens[TOKEN];
  assert.throws(() => summonRecordFor(ID, build, tokens), /Missing reviewed/);
  assert.throws(() => summonRecordFor(ID, { ...build, elite: 3 }, data.tokens), /promotion/);
  assert.throws(() => summonRecordFor(ID, { ...build, level: 81 }, data.tokens), /promotion/);
  const invalid = structuredClone(data.tokens);
  for (const t of invalid[TOKEN].talents[0].candidates) t.blackboard.push({ key: 'max_deck_stack_cnt', value: 9 });
  assert.throws(() => summonRecordFor(ID, build, invalid), /stock|deck|limits|source|capacity/i);
});
test('normal owner direct Arts hit occurs at original .533 event without a projectile or splash', () => {
  const { b, u } = make(), e = enemy(b, { y: 1, res: 25 }), other = enemy(b, { y: 1 });
  shot(b, u, e, .5); near(e.hp, 100000); assert.equal(b.projectiles.list.length, 0);
  advance(b, .067); near(100000 - e.hp, u.base.atk * .75); near(other.hp, 100000);
  assert.equal(b.projectiles.list.length, 0);
});
test('normal Fowlbeast original .567 event releases speed10 Arts projectile and can target air', () => {
  const { b } = make(), t = bird(b), e = enemy(b, { x: 7, fly: true, res: 25 });
  assert.ok(acquireTargets(b, t, effectiveProfile(t)).includes(e));
  shot(b, t, e, .533); near(e.hp, 100000); advance(b, .134); assert.ok(b.projectiles.list.length);
  advance(b, .3); near(100000 - e.hp, t.base.atk * .75); assert.equal(!!e.s.flags.sluggish, false);
});
test('both facings retain original owner and token attack timing while ASPD caps windup at1', () => {
  for (const dir of ['RIGHT', 'LEFT']) {
    const { b, u } = make({ dir }), t = bird(b, 2, 5, dir);
    near(effectiveProfile(u).windup(b, u), .533); near(effectiveProfile(t).windup(b, t), .567);
    for (const x of [u, t]) b.addBuff(x, { key: 'fast', mods: { aspd: 100 } });
    near(effectiveProfile(u).windup(b, u), .533); near(effectiveProfile(t).windup(b, t), .567);
    near(t.s.interval, .8);
  }
});
test('Machine talent uses selected E0/E1/E2 source coefficient on owner and summon Arts damage', () => {
  for (const elite of [0, 1, 2]) {
    const { b, u } = make({ elite, rank: [4, 7, 10][elite] }), t = bird(b), scale = elite ? 1.2 : 1.1;
    for (const x of [u, t]) {
      const e = enemy(b, { machine: true, res: 25, y: x.y }); shot(b, x, e);
      near(100000 - e.hp, x.base.atk * .75 * scale);
    }
  }
});
test('Machine modifier is damage-stage phys/Arts only, not ATK, True damage or ordinary enemies', () => {
  const { b, u } = make(), t = bird(b);
  for (const x of [u, t]) for (const type of ['phys', 'arts', 'true']) for (const machine of [true, false]) {
    const e = enemy(b, { machine, def: 10, res: 25 });
    b.dealDamage(x, e, { amount: 100, type, isAttack: true });
    near(100000 - e.hp, (type === 'phys' ? 90 : type === 'arts' ? 75 : 100) * (machine && type !== 'true' ? 1.2 : 1));
  }
  near(u.s.atk, u.base.atk); near(t.s.atk, t.base.atk);
});
test('S1 every rank speeds owner and owned Fowlbeast without ATK, DEF or stock buffs', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u } = make({ rank }), t = bird(b), stock = card(b).stock; cast(b, u);
    for (const x of [u, t]) {
      near(x.s.interval, x.base.bat / (1 + bb(0, rank).attack_speed / 100));
      near(x.s.atk, x.base.atk); near(x.s.def, x.base.def);
    }
    assert.equal(card(b).stock, stock); assert.equal(t.mem.lasherMode, 1);
  }
});
test('S1 auto activates naturally at full SP without enemies while S2 stays manual', () => {
  for (const skill of [0, 1]) {
    const { b, u } = make({ skill });
    u.skill.rule = skill === 0 ? 'SP_FULL' : 'NEVER';
    advance(b, skill === 0 ? 10.1 : 20.1);
    assert.equal(u.skill.active, skill === 0);
    if (skill === 0) assert.equal(b.activateOperator(ID), false);
    else { assert.equal(u.skill.ready, true); assert.equal(b.activateOperator(ID), true); }
  }
});
test('S1 source .8s loop uses reduced animation playback rate and .1 hit event', () => {
  const { b, u } = make(), t = bird(b); cast(b, u); advance(b, .3);
  near(effectiveProfile(u).windup(b, u), .125); near(effectiveProfile(t).windup(b, t), .567);
  assert.equal(effectiveProfile(u).attackVisual(b, u), 'Skill_1_Loop');
  assert.equal(effectiveProfile(t).attackVisual(b, t), 'Attack');
  const e = enemy(b, { y: 1 }); shot(b, u, e, .1); near(e.hp, 100000);
  advance(b, .1); assert.ok(b.projectiles.list.length); advance(b, .3); near(100000 - e.hp, u.base.atk);
});
test('both skills transition through native Begin/Idle/End clips and recover SP only after ending', () => {
  for (const skill of [0, 1]) {
    const { b, u } = make({ skill }), t = bird(b); cast(b, u);
    assert.equal(u.mem.regularFormVisual.clip, `Skill_${skill + 1}_Begin`);
    assert.equal(u.s.flags.disarm, true); advance(b, .334);
    assert.equal(u.mem.regularFormVisual.clip, `Skill_${skill + 1}_Idle`);
    advance(b, u.skill.duration - .5); assert.equal(u.skill.active, true); near(u.skill.spTotal, 0);
    advance(b, .2); assert.equal(u.skill.active, false); assert.equal(t.mem.lasherMode, 0);
    assert.equal(u.mem.regularFormVisual.clip, `Skill_${skill + 1}_End`);
    advance(b, .3); assert.equal(u.mem.regularFormVisual, null); assert.ok(u.skill.spTotal > 0);
    near(t.s.atk, t.base.atk); near(t.s.interval, t.base.bat);
  }
});
test('S2 every rank adds one capped stock and token-only ATK without owner stat amplification', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u } = make({ skill: 1, rank }), t = bird(b); cast(b, u);
    near(t.s.atk, t.base.atk * (1 + bb(1, rank).atk)); near(u.s.atk, u.base.atk);
    near(u.s.interval, u.base.bat); near(t.s.interval, t.base.bat); assert.equal(card(b).stock, 5);
    assert.equal(t.mem.lasherMode, 2); assert.equal(t.profile.priority, 'heaviest');
  }
});
test('S2 can recharge with zero deployed summons, cannot exceed source ready-card cap', () => {
  for (const stock of [0, 4, 5]) {
    const { b, u } = make({ skill: 1 }); b.regularSummons.get(summonCardId(ID)).stock = stock;
    cast(b, u); assert.equal(card(b).stock, Math.min(5, stock + 1));
  }
});
test('late deployed owned token joins active skill; ordinary ally or another owner token never inherits it', () => {
  for (const skill of [0, 1]) {
    const { b, u, deploy } = make({ skill, others: [FANG] }), ally = deploy(FANG, 2, 3);
    cast(b, u); const t = bird(b), state = b.regularSummons.get(summonCardId(ID));
    const q = b.spawnToken(ally, TOKEN, 2, 4, { def: state.record, kit: { skill: null, trait: { canAttack: () => false } } });
    assert.ok(q); advance(b, .1); assert.equal(t.mem.lasherMode, skill + 1);
    near(q.s.atk, q.base.atk); near(ally.s.atk, ally.base.atk);
    assert.equal(q.findBuff(`lasher:mode:${u.id}`), null);
  }
});
test('S2 selects heaviest in-range enemy across ground and air, then resets normal priority', () => {
  const { b, u } = make({ skill: 1 }), t = bird(b);
  const light = enemy(b, { x: 6, weight: 1 }), heavy = enemy(b, { x: 6.1, weight: 5, fly: true });
  light.progress = 100; heavy.progress = 0;
  cast(b, u); assert.equal(acquireTargets(b, t, effectiveProfile(t))[0], heavy);
  u.skill.end('test'); assert.equal(t.profile.priority, null); assert.equal(acquireTargets(b, t, effectiveProfile(t))[0], light);
});
test('S2 token hit applies selected1s Sluggish without owner Slow or additional targets', () => {
  const { b, u } = make({ skill: 1 }), t = bird(b); cast(b, u); advance(b, .3);
  const e = enemy(b), other = enemy(b, { x: 6.1 }); shot(b, t, e, .8);
  near(100000 - e.hp, t.base.atk * 1.4); assert.ok(e.findBuff('sluggish')); near(e.findBuff('sluggish').duration, 1);
  near(other.hp, 100000); advance(b, 1.1); assert.equal(e.findBuff('sluggish'), null);
  const ownerTarget = enemy(b, { y: 1 }); shot(b, u, ownerTarget); assert.equal(ownerTarget.findBuff('sluggish'), null);
});
test('S2 mode restarts pending token phase while already emitted rounds retain their selected Slow', () => {
  const { b, u } = make({ skill: 1 }), t = bird(b), e = enemy(b);
  b.forceAttack(t, [e]); advance(b, .1); cast(b, u); advance(b, .8); near(e.hp, 100000);
  b.forceAttack(t, [e]); t.atkCd = 1000; advance(b, .567); assert.ok(b.projectiles.list.length);
  u.skill.end('test'); t.atkCd = 1000; advance(b, .3);
  assert.ok(e.hp < 100000); assert.ok(e.findBuff('sluggish')); assert.equal(t.mem.lasherMode, 0);
});
test('emitted normal token projectile does not acquire retroactive S2 Slow', () => {
  const { b, u } = make({ skill: 1 }), t = bird(b), e = enemy(b, { x: 7 });
  b.forceAttack(t, [e]); advance(b, .667); assert.ok(b.projectiles.list.length);
  cast(b, u); advance(b, .3); assert.ok(e.hp < 100000); assert.equal(e.findBuff('sluggish'), null);
});
test('short control interrupts pending strikes and owner withdrawal removes owned summons and resets born stock', () => {
  const { b, u, deploy } = make({ skill: 1 }), t = bird(b), e = enemy(b);
  b.forceAttack(t, [e]); advance(b, .1); b.applyStatus(t, 'stun', { duration: .001 }); advance(b, .9); near(e.hp, 100000);
  cast(b, u); b.retreatOperator(ID); assert.equal(t.alive, false); assert.equal(card(b).available, false);
  b.time = 100; const next = deploy(); assert.notEqual(next, u); assert.equal(card(b).stock, 5); assert.equal(card(b).owner, next);
});
test('remote skill and Machine bonus remain non-silenceable, but free or hidden token loses skill eligibility', () => {
  const { b, u } = make({ skill: 1 }), t = bird(b); b.addBuff(t, { key: 'silence', flags: { silence: true } });
  cast(b, u); near(t.s.atk, t.base.atk * 1.4);
  const e = enemy(b, { machine: true }); shot(b, t, e); near(100000 - e.hp, t.base.atk * 1.4 * 1.2);
  b.addBuff(t, { key: 'free', flags: { untargetable: true } }); u.mem.summonSkillSync(); near(t.s.atk, t.base.atk);
  b.removeBuff(t, 'free'); u.mem.summonSkillSync(); near(t.s.atk, t.base.atk * 1.4);
  t.hidden = true; u.mem.summonSkillSync();
  assert.equal(t.mem.lasherMode, 0); near(t.s.atk, t.base.atk);
});
