// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered talent mechanics and shared Steal interactions, not native
// frame/VFX parity or a claim of public roster support.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-narant-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { NarantuyaProjectiles, NARANT_ID } from '../server/sim/content/arkpedia-narant-projectiles.js';
import { NarantuyaTalents, selectedNarantTalents } from '../server/sim/content/arkpedia-narant-talents.js';
import { aggregateMods, makeBuff } from '../server/sim/buffs.js';
import { customizeEntelechiaKit, installEntelechia } from '../server/sim/content/arkpedia-entelechia.js';

const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make(actors = []) {
  const src = structuredClone(data);
  src.stage.geometry.waves[0].spawns = []; src.stage.battle.dp_per_second = 0;
  src.stage.geometry.rows = 19; src.stage.geometry.cols = 21;
  src.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const builds = (actors.length ? actors : ['char_289_gyuki']).map(id => ({ ...defaultBuild(src.operators[id]),
    skillId: src.operators[id].skills[1]?.id ?? src.operators[id].skills[0].id }));
  const b = new StandardBattle(src, { operators: builds });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  return b;
}
function narant(b, { elite = 2, potential = 1, row = 5, col = 5, dir = 'RIGHT', skill = 1 } = {}) {
  const c = evidence.tables.character, phase = c.phases[elite], id = `skchr_narant_${skill}`;
  const build = { elite, level: phase.maxLevel, potential, skillId: id, skillRank: 1 };
  const level = evidence.tables.skills[id].levels[0];
  const def = normalizeChess({ chessId: NARANT_ID, charId: NARANT_ID, name: c.name,
    stats: phase.attributesKeyFrames.at(-1).data, profession: c.profession, position: c.position,
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId: id, trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', row, col, { dir });
  b._setupUnit(u, { trait: { noAttack: true }, skill: { id, kind: 'duration', duration: 100 } });
  const talents = new NarantuyaTalents(b, u);
  assert.equal(b._deploy(u, { initial: false }), true);
  return { u, talents, links: new NarantuyaProjectiles(b, u) };
}
function enemy(b, { row = 5, col = 6, atk = 500, def = 500, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(e.base, { maxHp: 1e7, atk, def, res: 0, moveSpeed: 0 });
  if (fly) e.motion = 'FLY'; e.markDirty(); void e.s; e.hp = 1e7;
  b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  b._buildEnemyIndex(); return e;
}
const hit = (b, u, e, extras = {}) => b.dealDamage(u, e, { amount: 1000, type: 'phys', canDodge: false, ...extras });

test('talents select all elite/potential candidates independently of the chosen skill', () => {
  for (const elite of [0, 1, 2]) for (let potential = 1; potential <= 6; potential++) {
    const bb = selectedNarantTalents({ elite, potential, level: 1 });
    if (!elite) { assert.deepEqual(bb, [null, null]); continue; }
    near(bb[0]['attack@steal_atk'], (elite === 1 ? 15 : 25) + (potential >= 5 ? 2 : 0));
    near(bb[0]['attack@steal_def'], (elite === 1 ? 10 : 20) + (potential >= 5 ? 1 : 0));
    near(bb[0]['attack@steal_atk_max'], bb[0]['attack@steal_atk'] * 10);
    near(bb[0]['attack@steal_def_max'], bb[0]['attack@steal_def'] * 10);
    if (elite === 1) assert.equal(bb[1], null);
    else near(bb[1].prob, potential >= 3 ? .38 : .35);
  }
  for (const build of [null, { elite: 3, potential: 1, level: 1 }, { elite: 0, potential: 7, level: 1 },
    { elite: 2, potential: 1, level: 91 }, { elite: 2, potential: 1, level: 0 }])
    assert.throws(() => selectedNarantTalents(build));
});

test('selected theft grows per damage instance and caps both attributes at each promotion/potential', () => {
  for (const [elite, potential] of [[0, 1], [1, 1], [1, 5], [2, 1], [2, 5]]) {
    const b = make(), { u, talents } = narant(b, { elite, potential }), e = enemy(b), base = { ...u.s };
    for (let i = 0; i < 12; i++) hit(b, u, e);
    const bb = selectedNarantTalents({ elite, potential, level: 1 })[0];
    const atk = bb?.['attack@steal_atk_max'] ?? 0, def = bb?.['attack@steal_def_max'] ?? 0;
    near(u.s.atk, base.atk + atk); near(u.s.def, base.def + def);
    near(e.s.atk, 500 - atk); near(e.s.def, 500 - def);
    assert.deepEqual(talents.gains, { atk, def }); near(u.skill.spTotal, u.skill.initSp);
  }
});

test('owner and each victim have independent caps; exhausted owner still reduces a new victim', () => {
  const b = make(), { u, talents } = narant(b), first = enemy(b), second = enemy(b), base = u.s.atk;
  for (let i = 0; i < 10; i++) hit(b, u, first);
  for (let i = 0; i < 10; i++) hit(b, u, second);
  near(u.s.atk, base + 250); near(first.s.atk, 250); near(second.s.atk, 250);
  b.kill(first, u); near(u.s.atk, base + 250); assert.equal(talents.victims.has(first), false);
  b.kill(second, u); near(u.s.atk, base + 250); assert.equal(talents.victims.size, 0);
});

test('low victim stats do not limit gains and final additions are outside percentage/multiplier buffs', () => {
  const b = make(), { u } = narant(b), e = enemy(b, { atk: 0, def: 0 }), base = { ...u.s };
  b.addBuff(u, { key: 'external', mods: { atkPct: 1, defPct: 1, atkMul: 1.5, defMul: 1.5 } });
  b.addBuff(u, { key: 'inspiration', tags: ['inspire'], mods: { atkFinalFlat: 50, defFinalFlat: 60 } });
  hit(b, u, e); near(u.s.atk, base.atk * 3 + 50 + 25); near(u.s.def, base.def * 3 + 60 + 20);
  near(e.s.atk, 0); near(e.s.def, 0);
  b.addBuff(e, { key: 'later-stats', mods: { atkFlat: 100, defFlat: 100, atkPct: 1, defPct: 1 } });
  near(e.s.atk, 175); near(e.s.def, 180);
});

test('HP damage types and DOT use the pre-mitigation bridge; canceled damage and buildup do not', () => {
  const b = make(), { u, talents } = narant(b), e = enemy(b);
  for (const type of ['phys', 'arts', 'true', 'elemental']) hit(b, u, e, { type, tags: ['dot'] });
  assert.deepEqual(talents.gains, { atk: 100, def: 80 });
  const cancel = b.on('hit', ctx => { ctx.dmg.cancel = true; }, { priority: 100 });
  hit(b, u, e); b.off(cancel); hit(b, u, e, { type: 'element', element: 'necrosis', amount: 1 });
  assert.deepEqual(talents.gains, { atk: 100, def: 80 });
  b.addBuff(e, { key: 'invulnerable', flags: { invulnerable: true } }); hit(b, u, e);
  assert.deepEqual(talents.gains, { atk: 100, def: 80 });
});

test('theft precedes same-hit mitigation and persists through a shield or local dodge roll', () => {
  const b = make(), { u, talents } = narant(b), e = enemy(b);
  near(hit(b, u, e), 520);
  b.addBuff(e, { key: 'shield', shield: 10000 }); near(hit(b, u, e), 0);
  b.addBuff(e, { key: 'dodge', mods: { dodgePhys: 1 } }); near(hit(b, u, e, { canDodge: true }), 0);
  assert.deepEqual(talents.gains, { atk: 75, def: 60 });
});

test('victim invalidation removes penalties while owner gains remain; a new life starts fresh', () => {
  for (const invalid of ['hidden', 'free', 'new-life']) {
    const b = make(), { u, talents } = narant(b), e = enemy(b); hit(b, u, e);
    if (invalid === 'hidden') e.hidden = true;
    else if (invalid === 'free') b.addBuff(e, { key: 'free', flags: { untargetable: true } });
    else e.deploySeq++;
    advance(b, b.dt); assert.equal(e.findBuff(talents.victimKey), null);
    assert.deepEqual(talents.gains, { atk: 25, def: 20 });
    e.hidden = false; b.removeBuff(e, 'free'); hit(b, u, e);
    near(e.s.atk, 475); assert.deepEqual(talents.gains, { atk: 50, def: 40 });
  }
});

test('withdrawal/death clear only owned theft and dodge; redeployment resets gains', () => {
  for (const action of ['retreat', 'death']) {
    const b = make(), { u, talents } = narant(b), e = enemy(b); hit(b, u, e);
    b.addBuff(e, { key: 'unrelated', mods: { atkFlat: -10 } });
    if (action === 'retreat') b.retreat(u); else b.kill(u, null);
    near(e.s.atk, 490); near(e.s.hitRatePhys, 1);
    assert.equal(e.findBuff(talents.victimKey), null); assert.equal(u.findBuff(talents.evadeKey), null);
    assert.equal(b._deploy(u, { initial: false }), true); assert.deepEqual(talents.gains, { atk: 0, def: 0 });
    hit(b, u, e); near(e.s.atk, 465); assert.deepEqual(talents.gains, { atk: 25, def: 20 });
  }
});

test('E2 dodge uses selected potential, composes independent dodge, and never affects True damage', () => {
  for (const [elite, potential, dodge] of [[1, 1, 0], [2, 1, .35], [2, 3, .38]]) {
    const b = make(), { u } = narant(b, { elite, potential }), e = enemy(b, { col: 10 });
    near(u.s.dodgePhys, dodge); near(u.s.dodgeArts, dodge);
    b.addBuff(u, { key: 'external-dodge', mods: { dodgePhys: .5 } });
    near(u.s.dodgePhys, 1 - (1 - dodge) * .5); near(u.s.dodgeArts, dodge);
    b.rng = () => 0;
    near(b.dealDamage(e, u, { amount: 100, type: 'phys', canDodge: true }), 0);
    near(b.dealDamage(e, u, { amount: 100, type: 'true', canDodge: true }), 100);
  }
});

test('hit-rate aura uses source tiles, ground/air and huge bodies; attack range changes do not move it', () => {
  for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN']) {
    const b = make(), { u } = narant(b, { dir }), diagonal = enemy(b, { row: 6, col: 6, fly: true }),
      outside = enemy(b, { row: 5, col: 7 }), huge = enemy(b, { row: 5, col: 8 });
    huge.hitArea = { w: 5, h: 1, dx: 0, dy: 0 };
    b.addBuff(u, { key: 'expanded-attacks', mods: { rangeExtend: 5 } }); advance(b, b.dt);
    near(diagonal.s.hitRatePhys, .8); near(diagonal.s.hitRateArts, .8);
    near(outside.s.hitRatePhys, 1); near(huge.s.hitRatePhys, .8);
    diagonal.x = 9; advance(b, b.dt); near(diagonal.s.hitRatePhys, 1);
  }
});

test('aura excludes target-free/stealthed enemies, accepts camouflage, and removes each departing target', () => {
  const b = make(); narant(b); const e = enemy(b); advance(b, b.dt); near(e.s.hitRatePhys, .8);
  b.addBuff(e, { key: 'camou', flags: { camou: true } }); advance(b, b.dt); near(e.s.hitRatePhys, .8);
  for (const flag of ['untargetable', 'stealth']) {
    b.addBuff(e, { key: 'invalid', flags: { [flag]: true } }); advance(b, b.dt); near(e.s.hitRatePhys, 1);
    b.removeBuff(e, 'invalid'); advance(b, b.dt); near(e.s.hitRatePhys, .8);
  }
});

test('an enemy inside the aura can miss any ally; True and non-missable damage bypass hit rate', () => {
  const b = make(); narant(b); const { u: target } = narant(b, { elite: 1, col: 10 }), e = enemy(b);
  advance(b, b.dt); b.rng = () => .9;
  const damage = type => b.dealDamage(e, target, { amount: 100, type, canDodge: true, defIgnorePct: 1 });
  near(damage('phys'), 0); near(damage('arts'), 0); near(damage('true'), 100);
  near(b.dealDamage(e, target, { amount: 100, type: 'phys', canDodge: false, defIgnorePct: 1 }), 100);
  b.rng = () => .1; near(damage('phys'), 100); near(damage('arts'), 100);
});

test('two source areas never compound or remove each other; battle end/disposal releases owned work', () => {
  const b = make(), a = narant(b), z = narant(b, { row: 6 }), e = enemy(b); advance(b, b.dt);
  near(e.s.hitRatePhys, .8); b.retreat(a.u); near(e.s.hitRatePhys, .8);
  z.talents.dispose(); near(e.s.hitRatePhys, 1); assert.equal(z.talents.handles.length, 0);
  const fresh = narant(b, { col: 4 }); advance(b, b.dt);
  hit(b, fresh.u, e); b.forceEnd(); assert.equal(e.findBuff(fresh.talents.victimKey), null);
  assert.equal(b.narantTalentAuras.providers.size, 0); near(e.s.hitRatePhys, 1);
});

test('born blade hits apply talents only while the original owner deployment is live', () => {
  for (const withdraw of [false, true]) {
    const b = make(), { u, talents, links } = narant(b), e = enemy(b);
    links.launch(e, 101, 0); if (withdraw) b.retreat(u); advance(b, .6);
    assert.deepEqual(talents.gains, withdraw ? { atk: 0, def: 0 } : { atk: 25, def: 20 });
    assert.ok(e.hp < 1e7); assert.equal(b.projectiles.list.length, 0);
  }
});

test('an old born blade never credits theft to a fresh deployment of its owner', () => {
  const b = make(), { u, talents, links } = narant(b), e = enemy(b);
  links.launch(e, 111, 0); b.retreat(u); assert.equal(b._deploy(u, { initial: false }), true);
  advance(b, .6); assert.ok(e.hp < 1e7); assert.deepEqual(talents.gains, { atk: 0, def: 0 });
  links.launch(e, 112, 0); advance(b, .6); assert.deepEqual(talents.gains, { atk: 25, def: 20 });
});

test('strongest Steal chooses each victim attribute independently and retains unrelated final additions', () => {
  const a = makeBuff({ key: 'a', tags: ['steal-victim'], mods: { atkFinalFlat: -90, defFinalFlat: -10, aspd: -15, hpFinalFlat: -30 } });
  const z = makeBuff({ key: 'z', tags: ['steal-victim'], mods: { atkFinalFlat: -25, defFinalFlat: -20, aspd: -30, hpFinalFlat: -20 } });
  const other = makeBuff({ key: 'other', mods: { atkFinalFlat: -5, defFinalFlat: 7, aspd: -1, hpFinalFlat: 10 } });
  const add = aggregateMods([a, z, other]).add;
  near(add.atkFinalFlat, -95); near(add.defFinalFlat, -13); near(add.aspd, -31); near(add.hpFinalFlat, -20);
  near(aggregateMods([z, other]).add.atkFinalFlat, -30);
});

test('Ines and Narantuya share strongest-victim ATK but keep independent final owner gains', () => {
  const b = make(['char_4087_ines']), { u, talents } = narant(b), e = enemy(b);
  b.getPlayer('arkpedia').dp = 90; const ines = b.deployOperator('char_4087_ines', 4, 5, 'RIGHT');
  ines.atkCd = 1000; ines.skill.rule = 'NEVER';
  const base = ines.s.atk; b.addBuff(ines, { key: 'percentage', mods: { atkPct: 1 } });
  b.addBuff(e, { key: 'percentage', mods: { atkPct: 1 } });
  hit(b, ines, e); near(ines.s.atk, base * 2 + 90);
  hit(b, u, e); near(e.s.atk, 1000 - 90);
  for (let i = 0; i < 3; i++) hit(b, u, e); near(e.s.atk, 900);
  b.retreat(u); near(e.s.atk, 910); assert.equal(e.findBuff(talents.victimKey), null);
  b.retreatOperator('char_4087_ines'); near(e.s.atk, 1000);
});

test('Surfer and Narantuya share strongest-victim DEF and retain independent owner gains', () => {
  const b = make(['char_4052_surfer']), { u } = narant(b), e = enemy(b);
  b.getPlayer('arkpedia').dp = 90; const surfer = b.deployOperator('char_4052_surfer', 4, 5, 'RIGHT');
  surfer.atkCd = 1000; surfer.skill.rule = 'NEVER';
  const base = surfer.s.def; b.addBuff(surfer, { key: 'percentage', mods: { defPct: 1 } });
  surfer.skill.setSpTotal(surfer.skill.spCost); assert.equal(surfer.skill.activate('fixture'), true); advance(b, .2);
  hit(b, surfer, e, { isAttack: true, tags: ['surfer:attack'] }); near(surfer.s.def, base * 2 + 55);
  hit(b, u, e); near(e.s.def, 445); for (let i = 0; i < 2; i++) hit(b, u, e); near(e.s.def, 440);
  b.retreat(u); near(e.s.def, 445); surfer.skill.end('duration'); near(e.s.def, 500);
});

test('Viviana native double-hit theft resumes after a stronger ASPD Steal source is removed', () => {
  const id = 'char_4098_vvana', b = make([id]), e = enemy(b);
  b.getPlayer('arkpedia').dp = 90; const u = b.deployOperator(id, 5, 5, 'RIGHT');
  u.atkCd = 1000; u.skill.rule = 'NEVER';
  u.skill.setSpTotal(u.skill.spCost); assert.equal(u.skill.activate('fixture'), true); advance(b, .2);
  b.addBuff(e, { key: 'stronger-theft', tags: ['steal-victim'], mods: { aspd: -60 } });
  b.rng = () => 0; assert.equal(b.forceAttack(u, [e]), true); u.atkCd = 1000; advance(b, .5);
  near(u.mem.vivianaStolen, 40); near(e.s.aspd, e.base.aspd - 60);
  b.removeBuff(e, 'stronger-theft'); near(e.s.aspd, e.base.aspd - 40);
  u.skill.end('duration'); near(e.s.aspd, e.base.aspd);
});

test('Entelechia HP theft keeps the strongest penalty and removal does not refill victim HP', () => {
  const id = 'char_4010_etlchi', b = make([id]), e = enemy(b);
  b.getPlayer('arkpedia').dp = 90; const u = b.deployOperator(id, 5, 5, 'RIGHT');
  u.atkCd = 1000; u.skill.rule = 'NEVER'; const baseHp = u.s.maxHp;
  const amount = u.def.talents.find(t => t.bb['attack@steal_hp'] != null).bb['attack@steal_hp'];
  const z = b._makeAlly(b.getPlayer('arkpedia'), u.def, 'op', 6, 5, { dir: 'RIGHT' });
  const kit = {};
  customizeEntelechiaKit({ battle: b, id, def: z.def, unit: z, kit });
  b._setupUnit(z, kit); installEntelechia({ battle: b, unit: z, def: z.def });
  assert.equal(b._deploy(z, { initial: false }), true);
  z.atkCd = 1000; z.skill.rule = 'NEVER';
  let beforeHealing;
  b.on('hit', ctx => { if (ctx.source === u) beforeHealing = u.hp; }, { priority: -100 });
  hit(b, u, e, { isAttack: true, tags: ['entelechia:attack'] });
  near(u.s.maxHp, baseHp + amount); near(beforeHealing, baseHp);
  near(u.hp, baseHp + u.def.traitBb.value); // Separate Reaper hit-healing still applies.
  hit(b, u, e, { isAttack: true, tags: ['entelechia:attack'] });
  hit(b, z, e, { isAttack: true, tags: ['entelechia:attack'] }); near(e.s.maxHp, 1e7 - amount * 2);
  const hp = e.hp; b.retreatOperator(id); near(e.s.maxHp, 1e7 - amount); near(e.hp, hp);
  b.retreat(z); near(e.s.maxHp, 1e7); near(e.hp, hp);
});
