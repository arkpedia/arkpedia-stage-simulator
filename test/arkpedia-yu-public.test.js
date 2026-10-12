// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-yu-prefabs.json' with { type: 'json' };
import review from '../data/arkpedia-yu-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { catalogueFor, defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { selectedYuBuild, YU_ID as ID } from '../server/sim/content/arkpedia-yu.js';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(b, condition, seconds = 80) {
  const end = b.time + seconds;
  while (!condition() && b.time < end) b.step();
  assert.ok(condition(), `Condition missing at ${b.time}`); assert.deepEqual(b.errors, []);
}
function make({ skill = 1, rank = 10, elite = 2, level = data.operators[ID].phases[elite].maxLevel,
  potential = 1, trust = 0, support = false, squad = [] } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(d.operators[ID]), elite, level, potential, trust,
    skillId: `skchr_yu_${skill}`, skillRank: rank };
  const members = ['char_500_noirc', 'char_196_sunbr', ...squad].map(id => defaultBuild(d.operators[id]));
  const b = new StandardBattle(d, support ? { operators: members, support: build } : { operators: [build, ...members] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.getPlayer('arkpedia').dp = 99;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  return { b, build: b.bench[ID].build };
}
function injured(b, id, row, col) {
  const a = b.deployOperator(id, row, col, 'RIGHT');
  b.addBuff(a, { key: 'qa:regen', flags: { noHpRecovery: true } });
  a.base.maxHp = 1e7; a.markDirty(); void a.s; a.hp = 1e6; return a;
}
function enemy(b, row = 5, col = 6) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(e.base, { maxHp: 1e7, atk: 0, def: 0, res: 0, moveSpeed: 0 });
  e.markDirty(); void e.s; e.hp = e.s.maxHp;
  b.addBuff(e, { key: 'qa:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}

test('public Yu retains the held native receipt and binds all skills and both original owner models', async () => {
  const bytes = await readFile(new URL('../data/arkpedia-yu-prefabs.json', import.meta.url));
  assert.equal(review.sourceFoundationSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(review.enabledOperators, [ID]); assert.deepEqual(evidence.enabledOperators, []);
  assert.deepEqual(evidence.heldOperators, [ID]); assert.equal(review.frameParity, false);
  assert.equal(evidence.source.commit, data.sources[evidence.source.repository]);
  assert.deepEqual(catalogueFor(data)[ID].skills.map(s => s.id), [1, 2, 3].map(n => `skchr_yu_${n}`));
  assert.deepEqual(catalogueFor(data)[ID].modules, []);
  for (const change of [{ elite: 0, level: 1, skillId: 'skchr_yu_2', skillRank: 1 },
    { elite: 1, level: 1, skillId: 'skchr_yu_3', skillRank: 1 }, { module: 'mod-x' }])
    assert.throws(() => recordFor({ ...defaultBuild(data.operators[ID]), ...change }, data));
  for (const face of ['front', 'back']) {
    const m = data.sd.models[`operator/${ID}/default/${face}`], art = review.originalArtwork[face];
    assert.deepEqual([m.skeleton, m.atlas, ...m.textures], art.files);
    assert.equal(m.skeleton.sha256, evidence.officialSkeletonBindings[ID][face === 'front' ? 'Front' : 'Back'].sha256);
    assert.deepEqual(m.animations, art.animations); assert.equal(m.premultipliedAlpha, true);
    assert.equal(m.animationRoles.die, face === 'front' ? 'Die' : null);
  }
});

for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++)
  test(`public Yu S${skill} rank ${rank}: selected source, natural SP, active mode and retirement`, () => {
    const { b, build } = make({ skill, rank }), r = selectedYuBuild(build);
    const before = b.dp, cost = b.cost(ID), u = b.deployOperator(ID, 5, 5, 'RIGHT'), c = u.mem.yuController;
    near(b.dp, before - cost); near(u.base.atk, r.stats.atk); near(u.skill.sp, r.source.spData.initSp);
    assert.equal(c.record.index, skill - 1);
    const e = enemy(b, 5, 5), hits = [];
    b.on('damaged', h => { if (h.source === u) hits.push({ ...h, atk: u.s.atk }); });
    if (skill === 1) {
      e.base.atk = 350; e.markDirty(); void e.s;
      b.removeBuff(e, 'qa:pin'); b.addBuff(e, { key: 'qa:stationary', flags: { noMove: true } });
    }
    until(b, () => u.skill.ready); assert.equal(b.activateOperator(ID), true);
    near(u.s.maxHp, r.stats.maxHp * (1 + r.bb.max_hp));
    near(u.s.atk, r.stats.atk * (1 + (r.bb.atk ?? 0)));
    near(u.s.def, r.stats.def * (1 + (r.bb.def ?? 0)));
    if (skill === 2) {
      until(b, () => hits.some(h => h.dmg.tags.includes('yu:s2:burst')));
      const burst = hits.find(h => h.dmg.tags.includes('yu:s2:burst')); near(burst.amount, burst.atk * r.bb.atk_scale);
      until(b, () => Math.abs(e.x - 5) >= .3 && Math.abs(e.y - 5) >= .3);
      assert.ok(Math.abs(e.x - 5) <= .450001 && Math.abs(e.y - 5) <= .450001);
    }
    until(b, () => hits.some(h => h.dmg.tags.includes(`yu:s${skill}:attack`)));
    const attack = hits.find(h => h.dmg.tags.includes(`yu:s${skill}:attack`));
    assert.equal(attack.type, skill === 2 ? 'arts' : 'phys'); near(attack.amount, attack.atk);
    assert.equal(attack.dmg.isSkill, true);
    until(b, () => !u.skill.active, 46);
    near(u.s.maxHp, r.stats.maxHp); near(u.s.atk, r.stats.atk); near(u.s.def, r.stats.def);
    assert.equal(c.skills.pending.size, 0); assert.equal(c.skills.wall.size, 0);
    assert.equal(b.projectiles.interceptors.size, 0);
    b.retreatOperator(ID); assert.equal(u.deployed, false); assert.equal(c.stopped, true); assert.equal(c.skills.handles.length, 0);
  });

for (const elite of [0, 1, 2]) test(`public Yu E${elite} preserves selected level, trust, potential and faction tags`, () => {
  const { b, build } = make({ skill: 1, elite, rank: [4, 7, 10][elite], level: 1, trust: 200, potential: 6 });
  const r = selectedYuBuild(build), u = b.deployOperator(ID, 5, 5, 'UP');
  for (const key of ['atk', 'def', 'maxHp']) near(u.base[key], r.stats[key]);
  assert.deepEqual(u.def.tags, r.tags);
  for (const key of ['elite', 'level', 'potential', 'trust', 'skillId', 'skillRank'])
    assert.equal(u.mem.yuController.record.build[key], build[key]);
});

for (const facing of ['RIGHT', 'LEFT', 'UP', 'DOWN']) test(`public Yu ${facing} uses original artwork and a fresh controller on redeployment`, () => {
  const { b } = make(); const u = b.deployOperator(ID, 5, 5, facing), c = u.mem.yuController;
  const face = ['UP', 'LEFT'].includes(facing) ? 'Back' : 'Front';
  assert.deepEqual(c.model(), evidence.models[ID][face]); advance(b, 1.1);
  b.retreatOperator(ID); assert.equal(u.deployed, false); until(b, () => b.bench[ID].readyAt <= b.time); b.getPlayer('arkpedia').dp = 99;
  const next = b.deployOperator(ID, 5, 5, facing);
  assert.ok(next); assert.notEqual(next, u); assert.notEqual(next.mem.yuController, c);
  assert.equal(c.stopped, true); assert.equal(c.skills.pending.size, 0); assert.equal(c.skills.wall.size, 0);
});

test('public Yu maxed support uses the selected source and rejects abnormal activation without spending SP', () => {
  const { b, build } = make({ skill: 3, support: true, trust: 200, potential: 6 });
  const u = b.deployOperator(ID, 5, 5, 'RIGHT'), r = selectedYuBuild(build);
  near(u.base.maxHp, r.stats.maxHp); until(b, () => u.skill.ready);
  b.addBuff(u, { key: 'qa:stun', flags: { stun: true } }); assert.equal(b.activateOperator(ID), false); assert.ok(u.skill.ready);
  b.removeBuff(u, 'qa:stun'); assert.equal(b.activateOperator(ID), true);
});

test('public Yu S3 extends independent HP/EP recovery, applies crossing injury and intercepts enemy projectiles', () => {
  const { b } = make({ skill: 3, squad: ['char_009_12fce'] });
  const u = b.deployOperator(ID, 5, 5, 'RIGHT'), c = u.mem.yuController;
  const ids = ['char_500_noirc', 'char_196_sunbr', 'char_009_12fce'];
  const allies = ids.map((id, i) => b.deployOperator(id, 9, 5 + i, 'RIGHT'));
  const a = allies[0]; b.addBuff(a, { key: 'qa:isolated', flags: { isolated: true, noHeal: true } });
  a.hp = a.s.maxHp / 2; b.dealDamage(null, a, { amount: 100, type: 'element', element: 'nervous' });
  until(b, () => u.skill.ready); assert.equal(b.activateOperator(ID), true); until(b, () => c.skills.wallReady);
  near(a.s.hpRegen, a.s.maxHp * c.record.market.hp_recovery_per_sec_by_max_hp_ratio);
  near(a.s.epRegen, a.s.maxHp * c.record.market.ep_heal_ratio);
  const hp = a.hp; advance(b, 1); assert.ok(a.hp > hp);
  const e = enemy(b, 9, 6), hits = []; b.on('damaged', h => { if (h.source === u) hits.push(h); });
  b.dealDamage(a, e, { amount: 1, type: 'arts' });
  assert.equal(hits.filter(h => h.dmg.tags.includes('yu:s3:wall')).length, 1);
  near(hits.find(h => h.dmg.tags.includes('yu:s3:wall')).amount, u.s.atk * c.record.bb.ep_damage_ratio);
  b.rng = Object.assign(() => 0, b.rng); let impacts = 0;
  const p = b.addProjectile({ source: e, from: { x: 4, y: 7 }, to: { x: 7, y: 7 }, speed: 1000, onHit: () => impacts++ });
  advance(b, b.dt); assert.equal(p.removed, true); assert.equal(impacts, 0);
  b.retreatOperator(ID); assert.equal(u.deployed, false); near(a.s.hpRegen, 0); near(a.s.epRegen, 0);
  assert.equal(c.skills.wall.size, 0); assert.equal(b.projectiles.interceptors.size, 0);
});
