// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-spuria-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const ID = 'char_4015_spuria', KROOS = 'char_124_kroos', JESSICA = 'char_235_jesica';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make({ skill = 0, rank = 10, elite = 2, dir = 'RIGHT', defer = false } = {}) {
  const d = structuredClone(data), o = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(o), elite, level: o.phases[elite].maxLevel,
    skillId: o.skills[skill].id, skillRank: Math.min(rank, [4, 7, 10][elite]) };
  const b = new StandardBattle(d, { operators: [build, ...[KROOS, JESSICA, 'char_208_melan'].map(id => defaultBuild(d.operators[id]))] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const deploy = (id = ID, r = 5, c = 5, f = dir) => {
    b.addDp('arkpedia', 99); const u = b.deployOperator(id, r, c, f);
    u.atkCd = 1000; if (u.skill) u.skill.rule = 'NEVER'; return u;
  };
  const receipts = []; b.on('damaged', c => receipts.push({ ...c, time: b.time }));
  return { b, u: defer ? null : deploy(), deploy, receipts };
}
function enemy(b, { x = 6, y = 5, def = 0, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [y, x] });
  Object.assign(e.base, { maxHp: 100000, def, res: 0, moveSpeed: 0 }); e.markDirty(); void e.s;
  e.hp = 100000; if (fly) e.motion = 'FLY';
  b.addBuff(e, { key: 'test:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function branch(b, n = -1) { b.rng.chance = () => n >= 0; b.rng.int = () => n; }
const hits = (r, u, e) => r.filter(x => x.source === u && x.target === e);
function shot(b, u, e) { assert.equal(b.forceAttack(u, [e]), true); u.atkCd = 1000; }
function cast(b, u) { u.skill.setSpTotal(u.skill.spCost); assert.equal(b.activateOperator(ID), true); u.atkCd = 1000; }

test('Spuria retains five verified bundle identities, twenty ranks and two exact original facing bindings', () => {
  assert.equal(evidence.source.bundles.length, 5); assert.equal(evidence.frameParity, false);
  for (const f of ['Front', 'Back']) {
    assert.equal(evidence.models[ID][f].sha256, evidence.originalFacingBindings[ID][f].sha256);
    assert.deepEqual(evidence.models[ID][f].hits.Attack_Loop, [.033]);
  }
  assert.equal(Object.values(evidence.tables[ID].skills).flatMap(s => s.levels).length, 20);
  const t = evidence.buffTemplates.spuria_t_1.eventToActions.ON_BUFF_START;
  assert.equal(t[2]._probKey, 'prob'); assert.deepEqual(t[3]._datas.map(x => x.weight), [1, 1, 1]);
  assert.equal(evidence.buffTemplates['spuria_t_1[attack]'].eventToActions.ON_BUFF_START[0]._applyWay, 'RANGED');
});

test('all ten S1 ranks grant only source ASPD for the exact deployment duration', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u } = make({ rank }); const s = data.operators[ID].skills[0].levels[rank - 1];
    near(u.s.aspd, 100 + s.blackboard[0].value); near(u.s.atk, u.base.atk);
    advance(b, s.duration - b.dt); assert.ok(u.findBuff('spuria:s1'));
    advance(b, 2 * b.dt); assert.equal(u.findBuff('spuria:s1'), null); near(u.s.aspd, 100);
  }
});
test('S1 deployment buff is fresh after withdrawal; no automatic reapplication at expiry', () => {
  const { b, u, deploy } = make(); advance(b, 25); near(u.s.aspd, 100);
  b.retreatOperator(ID); advance(b, 100); const fresh = deploy(); assert.notEqual(u, fresh); near(fresh.s.aspd, 200);
});
test('source one-percent HP drain waits one second, repeats and cannot kill', () => {
  const { b, u } = make(); const hp = u.hp;
  advance(b, .9); near(u.hp, hp); advance(b, .134); near(u.hp, hp - hp * .01);
  b.addBuff(u, { key: 'shield', mods: { shield: 9999, dmgTakenMul: 0 }, flags: { invulnerable: true } });
  advance(b, 1); near(u.hp, hp - 2 * hp * .01);
  u.hp = 2; advance(b, 2); near(u.hp, 1); assert.equal(u.alive, true);
});
test('HP drain does not grant defensive SP or opposing damage credit and stops on withdrawal', () => {
  const { b, u, receipts } = make({ skill: 1 }); u.skill.setSpTotal(0);
  advance(b, 2); near(u.skill.spTotal, 2); near(u.stats.dmg, 0);
  assert.ok(receipts.filter(x => x.target === u).every(x => x.dmg.noSp));
  b.retreatOperator(ID); const n = receipts.length; advance(b, 3); assert.equal(receipts.length, n);
});
test('four facing families retain first-only native beginning and a single emitted projectile', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const { b, u, receipts } = make({ dir }); branch(b);
    const [x, y] = { RIGHT: [6, 5], LEFT: [4, 5], UP: [5, 6], DOWN: [5, 4] }[dir];
    const e = enemy(b, { x, y }), other = enemy(b, { x: x + .05, y: y + .05 });
    shot(b, u, e); advance(b, .066); assert.equal(b.projectiles.list.length, 0);
    advance(b, .334); assert.equal(hits(receipts, u, e).length, 1); near(other.hp, 100000);
    shot(b, u, e); advance(b, .034); assert.equal(b.projectiles.list.length, 1);
    advance(b, .2); assert.equal(hits(receipts, u, e).length, 2);
  }
});
test('normal ranged shots can hit aerial enemies without applying physical splash', () => {
  const { b, u, receipts } = make(); branch(b); const e = enemy(b, { fly: true });
  shot(b, u, e); advance(b, .4); assert.equal(hits(receipts, u, e).length, 1);
  assert.equal(hits(receipts, u, e)[0].dmg.applyWay, 'ranged');
  assert.equal(hits(receipts, u, e)[0].dmg.isSkill, false);
});
test('each promotion uses its selected talent probability, stun and DEF penetration', () => {
  for (const elite of [0, 1, 2]) for (const n of [-1, 0, 1, 2]) {
    const { b, u, receipts } = make({ elite }); const e = enemy(b, { def: 500 });
    let prob; b.rng.chance = p => { prob = p; return n >= 0; }; b.rng.int = () => n;
    shot(b, u, e); advance(b, .5); const rs = hits(receipts, u, e);
    near(prob, [.3, .5, .7][elite]); assert.equal(rs.length, n === 0 ? 2 : 1);
    const armor = 500 * (1 - (n === 2 ? [.6, .6, .8][elite] : 0));
    rs.forEach(x => near(x.amount, Math.max(u.s.atk - armor, .05 * u.s.atk)));
    assert.equal(!!e.s.flags.stun, n === 1);
  }
});
test('talent extra is one born ranged hit and never rerolls its own talent', () => {
  const { b, u, receipts } = make(); const e = enemy(b); let rolls = 0;
  b.rng.chance = () => { rolls++; return true; }; b.rng.int = () => 0;
  shot(b, u, e); advance(b, .4); assert.equal(rolls, 1); assert.equal(hits(receipts, u, e).length, 2);
  assert.equal(hits(receipts, u, e)[0].dmg.tags[0], 'spuria:extra');
});
test('an emitted shot survives owner withdrawal but an unfired windup is interrupted', () => {
  for (const emitted of [false, true]) {
    const { b, u, receipts } = make(); branch(b); const e = enemy(b, { x: 8 });
    shot(b, u, e); advance(b, emitted ? .134 : .034); b.retreatOperator(ID); advance(b, .5);
    assert.equal(hits(receipts, u, e).length, emitted ? 1 : 0);
  }
});
test('untargetable victims suppress born shot impacts without damage or a talent roll', () => {
  const { b, u, receipts } = make(); const e = enemy(b, { x: 8 }); let rolls = 0;
  b.rng.chance = () => { rolls++; return false; };
  shot(b, u, e); advance(b, .134); b.addBuff(e, { key: 'free', flags: { untargetable: true } });
  advance(b, .5); assert.equal(hits(receipts, u, e).length, 0); assert.equal(rolls, 0);
});
test('S2 refuses to spend SP without an eligible forward Sniper', () => {
  const { b, u, deploy } = make({ skill: 1 }); u.skill.setSpTotal(u.skill.spCost);
  assert.equal(b.activateOperator(ID), false); near(u.skill.spTotal, u.skill.spCost);
  deploy(KROOS, 5, 4); deploy('char_208_melan', 5, 6);
  assert.equal(b.activateOperator(ID), false); near(u.skill.spTotal, u.skill.spCost);
});
test('all ten S2 ranks apply exact ATK/ASPD to one recipient and the owner', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const { b, u, deploy } = make({ skill: 1, rank }); const a = deploy(KROOS, 5, 6), z = deploy(JESSICA, 5, 7);
    cast(b, u); const bb = u.skill.bb;
    for (const t of [u, a]) { near(t.s.atk, t.base.atk * (1 + bb.atk)); near(t.s.aspd, 100 + bb.attack_speed); }
    assert.equal(z.findBuff(`spuria:s2:${u.id}`), null);
    advance(b, u.skill.duration + .1); near(u.s.atk, u.base.atk); near(a.s.atk, a.base.atk);
  }
});
test('four directions select the directly forward Sniper and do not retarget after removal', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const { b, u, deploy } = make({ skill: 1, dir });
    const [r, c] = { RIGHT: [5, 6], LEFT: [5, 4], UP: [6, 5], DOWN: [4, 5] }[dir];
    const a = deploy(KROOS, r, c), z = deploy(JESSICA, r + (r === 5 ? 1 : 0), c + (c === 5 ? 1 : 0));
    cast(b, u); assert.ok(a.findBuff(`spuria:s2:${u.id}`)); assert.equal(z.findBuff(`spuria:s2:${u.id}`), null);
    b.retreatOperator(KROOS); advance(b, .2); assert.equal(z.findBuff(`spuria:s2:${u.id}`), null);
  }
});
test('S2 self-stun rolls only on outputs and at most one success per multi-hit family', () => {
  const { b, u, deploy } = make({ skill: 1 }); const a = deploy(KROOS, 5, 6), e = enemy(b, { x: 7 });
  cast(b, u); let rolls = 0; b.rng.chance = () => { rolls++; return true; };
  shot(b, a, e); advance(b, .5); assert.equal(a.s.flags.stun, true);
  assert.equal(u.s.flags.stun, false); assert.equal(rolls, 2); // Kroos critical roll plus one S2 roll.
});
test('S2 stun immunity preserves the buff while failed stun still spends that family mark', () => {
  const { b, u, deploy } = make({ skill: 1 }); const a = deploy(KROOS, 5, 6), e = enemy(b, { x: 7 });
  a.def.immune.add('stun'); cast(b, u); b.rng.chance = () => true;
  shot(b, a, e); advance(b, .5); assert.equal(!!a.s.flags.stun, false); assert.ok(a.findBuff(`spuria:s2:${u.id}`));
});
test('successfully born Sniper buff keeps its own expiry and stun hooks after source withdrawal', () => {
  const { b, u, deploy } = make({ skill: 1 }); const a = deploy(KROOS, 5, 6), e = enemy(b, { x: 7 });
  cast(b, u); b.retreatOperator(ID); assert.ok(a.findBuff(`spuria:s2:${u.id}`)); b.rng.chance = () => true;
  shot(b, a, e); advance(b, .5); assert.equal(a.s.flags.stun, true);
  advance(b, 20); assert.equal(a.findBuff(`spuria:s2:${u.id}`), null); near(a.s.aspd, a.base.aspd);
});
test('both original S2 facing loops release one projectile and retain native mode artwork', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const { b, u, deploy, receipts } = make({ skill: 1, dir });
    const [x, y] = { RIGHT: [6, 5], LEFT: [4, 5], UP: [5, 6], DOWN: [5, 4] }[dir];
    deploy(KROOS, y, x); const e = enemy(b, { x, y }); cast(b, u); branch(b); advance(b, 1.1);
    assert.equal(u.mem.regularFormVisual.clip, 'Skill_Idle'); shot(b, u, e); advance(b, .3);
    assert.equal(hits(receipts, u, e).length, 1); assert.equal(u.mem.spuriaClip, dir === 'DOWN' ? 'Skill_Down_Loop' : 'Skill_Loop');
  }
});

test('normal and born extra hits retain external attack scaling without recursive talent rolls', () => {
  const { b, u, receipts } = make(); const e = enemy(b, { def: 500 }); branch(b, 0);
  b.addBuff(u, { key: 'test:attack-scale', mods: { atkScaleMul: 1.5 } });
  shot(b, u, e); advance(b, .4);
  const rs = hits(receipts, u, e); assert.equal(rs.length, 2);
  rs.forEach(x => near(x.amount, Math.max(u.s.atk * 1.5 - 500, .05 * u.s.atk * 1.5)));
});
test('emitted S2 projectile keeps its skill identity after the skill ends', () => {
  const { b, u, deploy, receipts } = make({ skill: 1 }); deploy(KROOS, 5, 6); cast(b, u);
  const e = enemy(b, { x: 8 }); branch(b); shot(b, u, e); advance(b, .067);
  u.skill.end(); advance(b, .4);
  assert.equal(hits(receipts, u, e).length, 1);
  assert.equal(hits(receipts, u, e)[0].dmg.isSkill, true);
});
