import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make(id, { skill = 0, rank = 10, elite = 2, level = 70, potential = 1,
  enemies = 0, companions = [] } = {}) {
  const source = structuredClone(data);
  source.stage.geometry.waves[0].spawns = enemies
    ? [{ enemy_id: 'enemy_1007_slime', count: enemies, time: 0, interval: 0, route: 1 }] : [];
  Object.assign(source.enemies.enemy_1007_slime.stats, {
    maxHp: 100000, atk: 100, def: 0, magicResistance: 0, moveSpeed: 0,
  });
  const op = source.operators[id];
  const build = { ...defaultBuild(op), skillId: op.skills[skill].id,
    skillRank: rank, elite, level, potential };
  const b = new StandardBattle(source, { operators: [build,
    ...companions.map(id => defaultBuild(source.operators[id]))] });
  b.autoFinish = false;
  b.setViewport('fullscreen-workspace');
  b.addDp('arkpedia', 99);
  return { b, build, source };
}
function deploy(b, id, row = 2, col = 7) {
  const u = b.deployOperator(id, row, col, 'RIGHT');
  u.atkCd = 1000;
  return u;
}
function activate(b, u) {
  u.skill.gainSp(u.skill.spCost, 'test');
  assert.equal(u.skill.activate('test'), true);
}
function pinEnemies(b) {
  b.step();
  for (const e of b.enemies) {
    b.addBuff(e, { key: 'test:pin', persist: true, flags: { noMove: true, disarm: true } });
    e.x = 8; e.y = 2;
  }
  b.step();
}

test('Matoimaru uses her E2-only HP/DEF talent and source percentage self-heal at every rank', () => {
  const id = 'char_289_gyuki';
  for (const [elite, level, potential, hpBonus] of [[1, 60, 1, 0], [2, 1, 1, .2], [2, 70, 5, .23]]) {
    const { b } = make(id, { elite, level, potential, rank: 7 });
    const u = deploy(b, id);
    near(u.hp, u.base.maxHp * (1 + hpBonus));
    near(u.s.def, u.base.def * (elite === 2 ? .8 : 1));
  }
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make(id, { rank });
    const u = deploy(b, id);
    u.hp = u.s.maxHp * .1;
    const hp = u.hp;
    activate(b, u);
    const ratio = source.operators[id].skills[0].levels[rank - 1].blackboard
      .find(e => e.key === 'heal_scale').value;
    near(u.hp - hp, u.s.maxHp * ratio);
    assert.equal(u.skill.active, false);
    assert.equal(u.profile.maxTargets, 1);
  }
});

test('Matoimaru S2 sets DEF to exactly zero through outside buffs and restores stats on expiry', () => {
  const id = 'char_289_gyuki';
  for (let rank = 1; rank <= 10; rank++) {
    const { b, source } = make(id, { skill: 1, rank });
    const u = deploy(b, id);
    b.addBuff(u, { key: 'test:outside-def', mods: { defPct: .7, defFlat: 40 } });
    const normalDef = u.s.def, normalAtk = u.s.atk;
    const lv = source.operators[id].skills[1].levels[rank - 1];
    activate(b, u);
    near(u.s.def, 0);
    near(u.s.atk - normalAtk, u.base.atk * lv.blackboard.find(e => e.key === 'atk').value);
    advance(b, lv.duration + .1);
    near(u.s.def, normalDef); near(u.s.atk, normalAtk);
  }
});

test('Estelle attacks only up to her current block count, without splash or extra duplicate hits', () => {
  const id = 'char_127_estell';
  for (const [elite, level, count] of [[1, 60, 2], [2, 70, 3]]) {
    const { b } = make(id, { elite, level, rank: 7, enemies: 4 });
    const u = deploy(b, id); pinEnemies(b);
    assert.equal(u.s.blockCnt, count);
    const targets = acquireTargets(b, u, effectiveProfile(u));
    assert.equal(targets.length, count);
    const hp = b.enemies.map(e => e.hp);
    b.forceAttack(u, targets);
    assert.equal(b.enemies.filter((e, i) => e.hp < hp[i]).length, count);
    near(u.profile.splashRadius, 0);
  }
});

test('Estelle heals on nearby enemy kills by anyone, including flying enemies, but not outside the source talent grid', () => {
  const id = 'char_127_estell';
  for (const [elite, level, potential, ratio] of [[0, 45, 1, 0], [1, 1, 1, .07], [1, 60, 5, .09], [2, 70, 1, .12], [2, 70, 5, .14]]) {
    const { b } = make(id, { elite, level, potential, rank: 4, enemies: 4 });
    const u = deploy(b, id); pinEnemies(b); u.hp = 1;
    const [close, ownTile, diagonal, far] = b.enemies;
    close.x = 8; close.y = 2;
    ownTile.x = 7; ownTile.y = 2;
    diagonal.x = 8; diagonal.y = 3; diagonal.motion = 'FLY';
    far.x = 5; far.y = 2;
    let hp = u.hp; b.kill(close, null); near(u.hp - hp, u.s.maxHp * ratio);
    hp = u.hp; b.kill(ownTile, null); near(u.hp - hp, u.s.maxHp * ratio);
    hp = u.hp; b.kill(diagonal, null); near(u.hp - hp, u.s.maxHp * ratio);
    hp = u.hp; b.kill(far, null); near(u.hp, hp);
    b.kill(close, null); near(u.hp, hp);
    assert.deepEqual(b.errors, []);
  }
});

test('Estelle S2 blocks ally healing while retaining block count and her own talent recovery, then clears the restriction', () => {
  const id = 'char_127_estell';
  const { b } = make(id, { skill: 1, enemies: 1, companions: ['char_120_hibisc'] });
  const u = deploy(b, id), medic = deploy(b, 'char_120_hibisc', 1, 7);
  pinEnemies(b); u.hp = 1;
  activate(b, u);
  assert.equal(u.s.blockCnt, 3);
  near(b.heal(medic, u, 1000), 0); near(u.hp, 1);
  b.addBuff(u, { key: 'test:healFree', flags: { healFree: true } });
  b.kill(b.enemies[0], medic);
  near(u.hp, 1 + u.s.maxHp * .12);
  b.removeBuff(u, 'test:healFree');
  advance(b, 15.1);
  assert.equal(u.s.flags.noHeal, undefined);
  assert.ok(b.heal(medic, u, 1000) > 0);
});

test('Dobermann buffs deployed three-stars globally, including later deployments; S2 multiplies only this aura and retreat clears it', () => {
  const id = 'char_130_doberm';
  const { b, build, source } = make(id, { skill: 1, potential: 5,
    companions: ['char_123_fang', 'char_208_melan', 'char_500_noirc'] });
  const fang = deploy(b, 'char_123_fang', 2, 3), twoStar = deploy(b, 'char_500_noirc', 3, 4);
  const fangAtk = fang.s.atk, twoStarAtk = twoStar.s.atk;
  const u = deploy(b, id);
  near(u.s.atk, u.base.atk); // The talent is not an extra Dobermann self buff.
  near(fang.s.atk - fangAtk, fang.base.atk * .11);
  near(twoStar.s.atk, twoStarAtk);
  const late = deploy(b, 'char_208_melan', 2, 6);
  const own = recordFor(defaultBuild(source.operators.char_208_melan), source).arkpedia.modifiers.atkPct;
  near(late.s.atk, late.base.atk * (1 + own + .11));
  activate(b, u);
  near(fang.s.atk - fangAtk, fang.base.atk * .33);
  near(u.s.atk, u.base.atk * 1.8);
  advance(b, 25.1);
  near(fang.s.atk - fangAtk, fang.base.atk * .11);
  b.retreatOperator(id);
  near(fang.s.atk, fangAtk);
  near(late.s.atk, late.base.atk * (1 + own));
  assert.equal(recordFor(build, source).arkpedia.modifiers.atkPct, undefined);
});

test('Dobermann instructor trait uses 120% ATK only against enemies she does not block, with S1 source damage scale', () => {
  const id = 'char_130_doberm';
  for (const blocked of [false, true]) {
    const { b } = make(id, { enemies: 1 });
    const u = deploy(b, id); pinEnemies(b);
    const e = b.enemies[0]; if (blocked) { e.blockedBy = u; u.blocking = [e]; }
    const factor = blocked ? 1 : 1.2;
    let hp = e.hp; b.forceAttack(u, [e]); near(hp - e.hp, u.s.atk * factor);
    activate(b, u); hp = e.hp;
    b.forceAttack(u, [e]); near(hp - e.hp, u.s.atk * factor * 2.3);
    assert.equal(u.skill.active, false);
  }
});

test('Mousse deals Arts and her alternate normal combo strikes the same enemy twice, while Scratch is a separate boosted hit', () => {
  const id = 'char_185_frncat';
  for (const proc of [false, true]) {
    const { b } = make(id, { potential: 5, enemies: 2 });
    const u = deploy(b, id); pinEnemies(b);
    const [e, untouched] = b.enemies;
    e.base.def = 100000; e.base.res = 0; e.markDirty();
    let rolls = 0;
    b.rng.chance = p => { near(p, .23); rolls++; return proc; };
    let hp = e.hp; b.forceAttack(u, [e]);
    near(hp - e.hp, u.s.atk * (proc ? 2 : 1));
    near(untouched.hp, untouched.s.maxHp); assert.equal(rolls, 1);
    activate(b, u); hp = e.hp; const atk = u.s.atk;
    b.forceAttack(u, [e]); near(hp - e.hp, atk);
    assert.equal(rolls, 1); assert.equal(u.skill.active, false);
    near(u.s.atk, u.base.atk);
    near(e.s.atk, e.base.atk * .6); near(e.s.def, e.base.def);
    advance(b, 5.1); near(e.s.atk, e.base.atk);
  }
});

test('Mousse Scratch debuff refreshes rather than stacking; Fury buffs ATK/DEF, preserves combo talent and expires', () => {
  const id = 'char_185_frncat';
  const { b } = make(id, { enemies: 1 });
  const u = deploy(b, id); pinEnemies(b); const e = b.enemies[0];
  b.rng.chance = () => false;
  for (let i = 0; i < 2; i++) { activate(b, u); b.forceAttack(u, [e]); }
  near(e.s.atk, e.base.atk * .6);
  assert.equal(e.buffs.filter(v => v.key.startsWith('mousse:scratch')).length, 1);
  const second = make(id, { skill: 1, enemies: 1 }), v = deploy(second.b, id);
  pinEnemies(second.b); second.b.rng.chance = () => true;
  activate(second.b, v);
  near(v.s.atk, v.base.atk * 1.75); near(v.s.def, v.base.def * 1.75);
  const target = second.b.enemies[0], hp = target.hp;
  second.b.forceAttack(v, [target]); near(hp - target.hp, v.s.atk * 2);
  advance(second.b, 40.1);
  near(v.s.atk, v.base.atk); near(v.s.def, v.base.def);
});

test('Frostleaf E2 source range replaces her normal grid and the talent adds exactly 0.15 seconds to attack time', () => {
  const id = 'char_193_frostl';
  const first = make(id, { elite: 1, level: 60, rank: 7 }), second = make(id);
  const a = deploy(first.b, id), b = deploy(second.b, id);
  near(a.s.bat, a.base.bat); near(b.s.bat, b.base.bat + .15);
  assert.equal(a.rangeGrid.length, 8); assert.equal(b.rangeGrid.length, 10);
  assert.deepEqual(b.rangeGrid, b.def.talents[0].rangeGrid);
  assert.equal(b.profile.canHitFly, true);
});

test('Frostleaf S1 slows only the struck enemy for source duration; S2 guaranteed slow and independent Bind chance expire', () => {
  const id = 'char_193_frostl';
  const first = make(id, { enemies: 2 }), a = deploy(first.b, id);
  pinEnemies(first.b); const [target, outside] = first.b.enemies;
  target.base.moveSpeed = 1; target.markDirty(); outside.base.moveSpeed = 1; outside.markDirty();
  activate(first.b, a); first.b.forceAttack(a, [target]); advance(first.b, .5);
  near(target.s.moveSpeed, .5); near(outside.s.moveSpeed, 1);
  advance(first.b, 3.1); near(target.s.moveSpeed, 1);
  for (const proc of [false, true]) {
    const { b } = make(id, { skill: 1, enemies: 1 });
    const u = deploy(b, id); pinEnemies(b); const e = b.enemies[0];
    e.base.moveSpeed = 1; e.markDirty(); let rolls = 0;
    b.rng.chance = p => { near(p, .4); rolls++; return proc; };
    activate(b, u); near(u.s.aspd, u.base.aspd + 50);
    b.forceAttack(u, [e]); advance(b, .5);
    near(e.s.moveSpeed, proc ? 0 : .5);
    assert.equal(Boolean(e.s.flags.bind), proc); assert.equal(rolls, 1);
    advance(b, 2.1); near(e.s.moveSpeed, 1);
    advance(b, 25.1); near(u.s.aspd, u.base.aspd);
  }
});

test('Frostleaf S1 retains the lord ranged penalty and applies source damage scale without splashing another enemy', () => {
  const id = 'char_193_frostl';
  for (const melee of [false, true]) for (const rank of [1, 7, 10]) {
    const { b, source } = make(id, { rank, enemies: 2 });
    const u = deploy(b, id, 2, 5); pinEnemies(b);
    const [e, untouched] = b.enemies;
    e.x = melee ? 6 : 7; e.y = 2;
    e.base.def = 0; e.markDirty();
    activate(b, u);
    const hp = e.hp, otherHp = untouched.hp;
    const scale = source.operators[id].skills[0].levels[rank - 1].blackboard
      .find(v => v.key === 'atk_scale').value;
    b.forceAttack(u, [e]);
    near(hp - e.hp, u.s.atk * scale * (melee ? 1 : .8));
    near(untouched.hp, otherHp);
    assert.equal(u.skill.active, false);
  }
});

test('Dobermann death removes her three-star aura immediately, including while Spur is active', () => {
  const id = 'char_130_doberm';
  for (const active of [false, true]) {
    const { b } = make(id, { skill: 1, companions: ['char_123_fang'] });
    const fang = deploy(b, 'char_123_fang', 2, 3), base = fang.s.atk;
    const u = deploy(b, id);
    if (active) activate(b, u);
    assert.ok(fang.s.atk > base);
    b.kill(u, null);
    near(fang.s.atk, base);
    advance(b, 1);
    near(fang.s.atk, base);
    assert.equal(fang.buffs.some(v => v.key.startsWith('dobermann:')), false);
  }
});
