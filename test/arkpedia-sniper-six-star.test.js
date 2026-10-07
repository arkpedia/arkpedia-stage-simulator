// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-sniper-six-star-prefabs.json' with { type: 'json' };
import { SNIPER_SIX_STAR_OPERATORS as configs } from '../shared/arkpedia/sniper-six-star-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';

const ID = 'char_340_shwaz', KROOS = 'char_124_kroos', MEL = 'char_208_melan';
const near = (a, v) => assert.ok(Math.abs(a - v) < 1e-6, `${a} != ${v}`);
function build(id, { elite = 2, skill = 0, rank = 10, potential = 1 } = {}) {
  const op = data.operators[id]; elite = Math.min(elite, op.phases.length - 1);
  return { ...defaultBuild(op), elite, level: op.phases[elite].maxLevel, potential,
    skillId: op.skills[skill].id, skillRank: Math.min(rank, elite === 2 ? 10 : elite === 1 ? 7 : 4) };
}
function make(opts = {}, more = []) {
  const source = structuredClone(data); source.stage.geometry.waves[0].spawns = [];
  source.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(source, { operators: [build(ID, opts), ...more.map(id => build(id))] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const random = () => .999; random.int = () => 0; random.chance = p => random() < p; b.rng = random;
  const deploy = (id = ID, r = 3, c = 4, dir = 'RIGHT') => {
    b.addDp('arkpedia', 99); const u = b.deployOperator(id, r, c, dir); assert.ok(u);
    u.atkCd = 1000; u.skill.rule = 'NEVER'; return u;
  };
  return { b, deploy };
}
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function enemy(b, { r = 3, c = 5, def = 300, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [r, c] });
  Object.assign(e.base, { maxHp: 100000, atk: 0, def, res: 0 });
  e.markDirty(); void e.s; e.hp = 100000; if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { disarm: true, noMove: true } });
  b._buildEnemyIndex(); return e;
}
function cast(u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate('test'), true); u.atkCd = 1000; }
function shot(b, u, e) { b.forceAttack(u, [e]); u.atkCd = 1000; }
function crit(b) { const r = () => 0; r.int = () => 0; r.chance = p => r() < p; b.rng = r; }
const talent = u => u.def.talents.find(v => v.bb.prob != null).bb;
const nodes = rows => rows.flatMap(v => v.components);

test('complete Schwarz kit retains original source fields, exact facings and held Exusiai blocker', () => {
  assert.deepEqual(Object.keys(configs), [ID]); assert.equal(configs[ID].criticalTalent, false);
  const char = nodes(evidence.characters[ID]);
  assert.equal(char.find(v => v._professionMask != null)._professionMask, 2);
  assert.equal(char.find(v => v._professionMask != null)._minCount, 2);
  assert.equal(char.find(v => v._onlyPlayBeginAnimWhenFirstAttack != null)._onlyPlayBeginAnimWhenFirstAttack, 1);
  for (const face of ['Front', 'Back']) {
    assert.match(evidence.originalModels[ID][face].sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(evidence.originalModels[ID][face].hits.Skill_Loop, [.033]);
  }
  const aliases = evidence.originalAnimatorAliases[ID].animations;
  assert.equal(aliases.find(v => v.animKey === 'Skill').animName, 'Skill_Loop');
  const actions = evidence.buffTemplates.shwaz_t_1.eventToActions.ON_CALCULATE_DAMAGE;
  assert.match(actions[0].$type, /Dice/); assert.match(actions[1].$type, /AtkScaleUp/); assert.match(actions[2].$type, /CreateBuff/);
  assert.match(evidence.deferredOperators.char_103_angel.reason, /two separate BASE_ATTACK_TIME/);
});

test('all three source skills and ten ranks load without inheriting mode-critical talent', () => {
  for (let skill = 0; skill < 3; skill++) for (let rank = 1; rank <= 10; rank++) {
    const { b, deploy } = make({ skill, rank }), u = deploy();
    assert.equal(u.skill.id, configs[ID].skillIds[skill]); assert.equal(u.def.raw.arkpedia.critical, undefined);
    assert.deepEqual(b.errors, []);
  }
});

test('source normal opening plays once per engagement, scales uncapped and preserves projectile flight', () => {
  const { b, deploy } = make(), u = deploy(), e = enemy(b, { def: 0 });
  shot(b, u, e); let v = b._evq.filter(v => v[0] === 'atk').at(-1)[4];
  near(v.windup, .266); assert.deepEqual(v.animation, { begin: 'Attack_Begin', loop: 'Attack_Loop', beginDuration: .233 });
  advance(b, .267); assert.equal(e.hp, 100000); assert.equal(b.projectiles.list.length, 1);
  advance(b, .15); near(100000 - e.hp, u.s.atk);
  shot(b, u, e); v = b._evq.filter(v => v[0] === 'atk').at(-1)[4];
  assert.equal(v.animation, 'Attack_Loop'); near(v.windup, .033); advance(b, .2);
  b.addBuff(u, { key: 'test:ASPD', mods: { aspd: 200 } }); near(u.profile.windup(b, u), .011);
  e.x = 0; e.y = 0; e.tileC = 0; e.tileR = 0; b._enemiesDirty = true; b._buildEnemyIndex();
  advance(b, .1); near(u.profile.windup(b, u), .266 / 3);
});

test('original ten-unit projectile speed is distance dependent and retains crit after source withdrawal', () => {
  const { b, deploy } = make(), u = deploy(), e = enemy(b, { c: 6, def: 300 });
  crit(b); shot(b, u, e); advance(b, .267); assert.equal(e.hp, 100000);
  b.retreat(u); advance(b, .1); assert.equal(e.hp, 100000); advance(b, .15);
  near(e.s.def, 240); near(100000 - e.hp, u.s.atk * talent(u).atk_scale - 240);
});

test('normal critical talent applies ordered scale and DEF reduction once without stacking on refresh', () => {
  const { b, deploy } = make(), u = deploy(), e = enemy(b); crit(b);
  shot(b, u, e); advance(b, .45); near(e.s.def, 240);
  near(100000 - e.hp, u.s.atk * 1.6 - 240);
  const before = e.hp; shot(b, u, e); advance(b, .25); near(e.s.def, 240);
  near(before - e.hp, u.s.atk * 1.6 - 240); assert.equal(e.buffs.filter(v => v.key === 'schwarz:defdown').length, 1);
  advance(b, 5.1); near(e.s.def, 300);
});

test('E0 zero-duration DEF field does not increase or permanently change target DEF; E1 uses ten percent', () => {
  for (const elite of [0, 1]) {
    const { b, deploy } = make({ elite, rank: 4 }), u = deploy(), e = enemy(b); crit(b);
    shot(b, u, e); advance(b, .45);
    const def = elite === 0 ? 300 : 270; near(e.s.def, def);
    near(100000 - e.hp, u.s.atk * 1.3 - def);
    if (elite === 0) assert.equal(e.findBuff('schwarz:defdown'), null);
  }
});

test('S1 scale and talent probability apply to the same source shot at selected ranks', () => {
  for (const rank of [1, 7, 10]) {
    const { b, deploy } = make({ rank }), u = deploy(), e = enemy(b); cast(u);
    const r = () => .3; r.int = () => 0; r.chance = p => r() < p; b.rng = r;
    shot(b, u, e); advance(b, .45);
    near(100000 - e.hp, u.s.atk * u.skill.bb.atk_scale * talent(u).atk_scale - 240);
    assert.equal(u.skill.charges, 0);
  }
});

test('S1 dead pre-emission input refunds the charge; already emitted dead target does not', () => {
  const { b, deploy } = make(), u = deploy(), e = enemy(b); cast(u); shot(b, u, e);
  b.kill(e); advance(b, .3); assert.equal(u.skill.charges, 1); assert.equal(b.projectiles.list.length, 0);
  const z = enemy(b); cast(u); shot(b, u, z); advance(b, .267); assert.ok(b.projectiles.list.length);
  b.kill(z); advance(b, .3); assert.equal(u.skill.charges, 0);
});

test('S2 ATK/probability and exact duration do not invent a separate skill animation', () => {
  const { b, deploy } = make({ skill: 1 }), u = deploy(), e = enemy(b), atk = u.s.atk;
  cast(u); near(u.s.atk, atk * 2.3); const r = () => .4; r.int = () => 0; r.chance = p => r() < p; b.rng = r;
  shot(b, u, e); advance(b, .45); near(100000 - e.hp, u.s.atk * 1.6 - 240);
  assert.equal(b._evq.filter(v => v[0] === 'atk').at(-1)[4].animation.loop, 'Attack_Loop');
  advance(b, 40); assert.equal(u.skill.active, false); near(u.s.atk, atk);
});

test('S3 source flat BAT/range/form and guaranteed talent restore after selected duration', () => {
  for (const rank of [1, 7, 10]) {
    const { b, deploy } = make({ skill: 2, rank }), u = deploy(), e = enemy(b, { c: 7 }), atk = u.s.atk, bat = u.s.bat;
    cast(u); assert.equal(u.mem.regularFormVisual.clip, 'Skill_Begin'); near(u.s.bat, bat + u.skill.bb.base_attack_time);
    near(u.s.atk, atk * (1 + u.skill.bb.atk)); assert.ok(acquireTargets(b, u, effectiveProfile(u)).includes(e));
    advance(b, .267); assert.equal(u.mem.regularFormVisual.clip, 'Skill_Idle');
    shot(b, u, e); advance(b, .4); assert.ok(e.findBuff('schwarz:defdown'));
    assert.equal(b._evq.filter(v => v[0] === 'atk').at(-1)[4].animation, 'Skill_Loop');
    advance(b, u.skill.def.duration); assert.equal(u.skill.active, false); advance(b, .3);
    near(u.s.bat, bat); near(u.s.atk, atk); assert.equal(u.mem.regularFormVisual, null);
    assert.equal(acquireTargets(b, u, u.profile).includes(e), false);
  }
});

test('Crossfire requires another deployed Sniper, never bench or non-Sniper, and cleans up both departures', () => {
  const { b, deploy } = make({}, [KROOS, MEL]), u = deploy(), other = deploy(MEL, 2, 3);
  near(u.s.atk, u.base.atk); const ordinaryAtk = other.s.atk;
  const s = deploy(KROOS, 2, 4); advance(b, b.dt);
  near(u.s.atk, u.base.atk * 1.08); near(s.s.atk, s.base.atk * 1.08); near(other.s.atk, ordinaryAtk);
  b.retreat(s); advance(b, b.dt); near(u.s.atk, u.base.atk);
  advance(b, 75); const again = deploy(KROOS, 2, 4); advance(b, b.dt);
  b.retreat(u); advance(b, b.dt); near(again.s.atk, again.base.atk); assert.equal(again.findBuff('schwarz:crossfire'), null);
});

test('Crossfire E2 potential bonus and E0/E1 absence follow source promotion gates', () => {
  for (const elite of [0, 1, 2]) for (const potential of [1, 6]) {
    const { b, deploy } = make({ elite, potential }, [KROOS]), u = deploy(), s = deploy(KROOS, 2, 4); advance(b, b.dt);
    const value = elite < 2 ? 0 : potential === 6 ? .1 : .08;
    near(u.s.atk, u.base.atk * (1 + value)); near(s.s.atk, s.base.atk * (1 + value));
  }
});

test('Crossfire counts a deployed isolated Sniper but its friendly selector excludes that recipient', () => {
  const { b, deploy } = make({}, [KROOS]), u = deploy(), s = deploy(KROOS, 2, 4);
  b.addBuff(s, { key: 'test:isolation', flags: { isolated: true, untargetable: true, healFree: true } });
  advance(b, b.dt); near(u.s.atk, u.base.atk * 1.08); near(s.s.atk, s.base.atk);
  b.removeBuff(s, 'test:isolation');
  b.addBuff(s, { key: 'test:target-free', flags: { untargetable: true, healFree: true, sleep: true } });
  advance(b, b.dt); near(s.s.atk, s.base.atk * 1.08);
  b.addBuff(u, { key: 'test:self-isolation', flags: { isolated: true } });
  advance(b, b.dt); near(u.s.atk, u.base.atk * 1.08);
  b.retreat(u); near(s.s.atk, s.base.atk);
});

test('S2 born projectile retains its critical probability when the skill expires during flight', () => {
  const { b, deploy } = make({ skill: 1 }), u = deploy(), e = enemy(b, { c: 7 });
  cast(u); u.skill.timeLeft = .4;
  const r = () => .4; r.int = () => 0; r.chance = p => r() < p; b.rng = r;
  shot(b, u, e); advance(b, .3); assert.equal(b.projectiles.list.length, 1);
  advance(b, .35); assert.equal(u.skill.active, false); near(e.s.def, 240);
  near(100000 - e.hp, u.s.atk * 1.6 - 240);
});

test('natural normal and S3 combat stay single-target when targets overlap', () => {
  for (const skill of [0, 2]) {
    const { b, deploy } = make({ skill }), u = deploy(), e = enemy(b, { def: 0 }), z = enemy(b, { c: 5.2, def: 0 });
    if (skill === 2) { cast(u); advance(b, .267); }
    u.atkCd = 0; advance(b, 4);
    assert.equal([e, z].filter(v => v.hp < 100000).length, 1);
    assert.ok(u.stats.attacks >= 2);
  }
});

test('brief control before release cancels an unfired shot without damaging another enemy', () => {
  const { b, deploy } = make(), u = deploy(), e = enemy(b);
  shot(b, u, e); advance(b, .1); b.applyStatus(u, 'stun', { duration: .05, source: e });
  advance(b, .5); near(e.hp, 100000); assert.equal(b.projectiles.list.length, 0);
});
