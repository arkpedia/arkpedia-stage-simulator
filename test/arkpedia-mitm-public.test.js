// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-mitm-prefabs.json' with { type: 'json' };
import art from '../data/arkpedia-mitm-device-art.json' with { type: 'json' };
import review from '../data/arkpedia-mitm-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { catalogueFor, defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { regularModelKey } from '../shared/arkpedia/facing.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { regularTokenIdsFor, summonCardId, summonUnitId } from '../shared/arkpedia/summons.js';
import { deployRegularSummon, retreatRegularSummon, regularSummonCards, selectedRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { MITM_ID as ID, selectedMitmBuild } from '../server/sim/content/arkpedia-mitm.js';
const TOKEN = 'token_10037_mitm_trshrb', card = summonCardId(ID);
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let n = 0; n < Math.ceil(seconds / b.dt - 1e-9); n++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(b, condition, seconds = 80) {
  const end = b.time + seconds;
  while (!condition() && b.time < end) b.step();
  assert.ok(condition(), `Condition missing at ${b.time}`); assert.deepEqual(b.errors, []);
}
function make({ skill = 1, rank = 10, elite = 2, level = data.operators[ID].phases[elite].maxLevel,
  trust = 0, potential = 1, support = false } = {}) {
  const d = structuredClone(data);d.stage.geometry.waves[0].spawns = [];d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19;d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(d.operators[ID]), elite, level, trust, potential, skillRank: rank, skillId: `skchr_mitm_${skill}` };
  const members = ['char_500_noirc', 'char_196_sunbr'].map(id => defaultBuild(d.operators[id]));
  const b = new StandardBattle(d, support ? { operators: members, support: build } : { operators: [build, ...members] });
  b.autoFinish = false;b.recordEvents = true;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp = 99;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  return { b, build: b.bench[ID].build };
}
function enemy(b, row = 5, col = 7) {
  const t = b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: 1e7, atk: 0, def: 0, res: 0, moveSpeed: 0 });t.markDirty();void t.s;t.hp = t.s.maxHp;
  b.addBuff(t, { key: 'qa:pin', flags: { noMove: true, disarm: true } });b._buildEnemyIndex();return t;
}

test('public Mitm binds strict source builds and all four original models without changing held receipts', async () => {
  for (const [file, key] of [['arkpedia-mitm-prefabs.json', 'sourceFoundationSha256'], ['arkpedia-mitm-device-art.json', 'deviceArtworkSha256']])
    assert.equal(review[key], createHash('sha256').update(await readFile(new URL('../data/' + file, import.meta.url))).digest('hex'));
  assert.deepEqual(source.enabledOperators, []);assert.deepEqual(art.enabledOperators, []);assert.deepEqual(review.enabledOperators, [ID]);
  for (const flag of ['frameParity', 'moduleSupport', 'nativeShaderParity', 'nativeParticleSupport']) assert.equal(review[flag], false);
  assert.equal(source.source.commit, data.sources[source.source.repository]);
  assert.deepEqual(catalogueFor(data)[ID].skills.map(s => s.id), [1, 2].map(n => `skchr_mitm_${n}`));
  assert.deepEqual(catalogueFor(data)[ID].modules, []);assert.deepEqual(regularTokenIdsFor([ID]), [TOKEN]);
  assert.equal(Object.keys(review.originalArtwork).length, 4);
  for (const [key, model] of Object.entries(review.originalArtwork)) assert.deepEqual(data.sd.models[key], model);
  for (const face of ['front', 'back']) {
    const a = data.sd.models[`operator/${TOKEN}/default/${face}`], r = art.models[TOKEN];
    assert.deepEqual(a.source.originalPathIds, r.originalPathIds);assert.deepEqual(a.animations, r.durations);
    for (const f of [a.skeleton, a.atlas, ...a.textures, a.avatar]) assert.equal(f.sha256, r.files[f.path.split('/').at(-1)].sha256);
  }
  for (const change of [{ elite: 0, level: 1, skillRank: 1, skillId: 'skchr_mitm_2' }, { module: 'TAC-X' }])
    assert.throws(() => recordFor({ ...defaultBuild(data.operators[ID]), ...change }, data));
});

for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++) test(`public Mitm S${skill} rank ${rank}: natural SP, token state, selected damage and DP`, () => {
  const { b, build } = make({ skill, rank }), r = selectedMitmBuild(build), dp = b.dp;
  const cost = b.cost(ID), u = b.deployOperator(ID, 5, 5, 'RIGHT'), c = u.mem.mitmController;
  near(b.dp, dp - cost);near(u.base.atk, r.stats.atk);near(u.skill.sp, r.source.spData.initSp);
  const slots = b.deployedSlots(), before = b.dp, t = deployRegularSummon(b, card, 5, 6);
  assert.equal(t.ownerUnit, u);assert.equal(t.deploymentSlotCost, 0);assert.equal(b.deployedSlots(), slots);near(b.dp, before);
  assert.equal(t.dir, 'RIGHT');assert.equal(c.devices.stock, 0);assert.equal(selectedRegularSummon(b, summonUnitId(t)).unit, t);
  assert.equal(regularSummonCards(b).find(v => v.key === card).available, false);
  assert.equal(c.devices.point.mode, 'warming');near(t.mem.mitmReadyAt, b.time + 1);
  advance(b, 1.1);assert.equal(c.devices.point.mode, 1);assert.equal(t.s.blockCnt, 1);
  const target = enemy(b), hits = [];
  b.on('damaged', h => { if (h.source === u) hits.push({ ...h, atk: u.s.atk }); });
  until(b, () => u.skill.ready);assert.equal(skillHud(u.skill).ready, true);
  const castDp = b.dp;assert.equal(b.activateOperator(ID), true);
  if (skill === 1) {
    near(b.dp, castDp + r.bb.cost);assert.equal(c.skills.command.released, false);
    assert.equal(u.mem.regularFormVisual.clip, 'Skill_1');
    until(b, () => hits.some(h => h.dmg.tags.includes('mitm:s1')));
    const hit = hits.find(h => h.dmg.tags.includes('mitm:s1'));
    assert.equal(hit.target, target);near(hit.amount, hit.atk * r.bb.aoe_damage_scale);
    assert.equal(c.devices.point.mode, 0);assert.equal(c.devices.tokens.size, 1);
  } else {
    near(b.dp, castDp);near(u.s.atk, r.stats.atk * (1 + r.bb.atk));
    assert.equal(c.devices.point.mode, 3);assert.equal(t.s.blockCnt, 2);
    near(t.s.def, r.token.stats.def * (1 + r.bb['mitm_s_2[to_token].def']));
    assert.equal(skillHud(u.skill).state, 'active');
    until(b, () => hits.some(h => h.dmg.tags.includes('mitm:s2')));
    const hit = hits.find(h => h.dmg.tags.includes('mitm:s2'));
    assert.equal(hit.target, target);near(hit.amount, hit.atk);assert.equal(hit.dmg.isSkill, true);
    until(b, () => !u.skill.active);assert.equal(c.skills.pulses, 12);
    near(b.dp, Math.min(99, castDp + 12 * r.bb['mitm_s_2[cost].cost']));
    assert.equal(c.devices.point.mode, 0);near(u.s.atk, r.stats.atk);
  }
  until(b, () => c.devices.point.mode === 1, 25);near(t.hp, t.s.maxHp);
  b.retreatOperator(ID);assert.equal(t.alive, false);assert.equal(c.devices.tokens.size, 0);
  assert.equal(c.stopped, true);assert.equal(b.regularSummons.has(card), false);
  assert.equal(c.phase, null);assert.equal(c.skills.command, null);assert.deepEqual(c.skills.parents, []);assert.deepEqual(b.errors, []);
});

for (const elite of [0, 1, 2]) test(`public Mitm E${elite} preserves selected owner and independent token keyframes`, () => {
  const { b, build } = make({ elite, level: 1, skill: elite === 0 ? 1 : 2, rank: [4, 7, 10][elite], trust: 200, potential: 6 });
  const r = selectedMitmBuild(build), u = b.deployOperator(ID, 5, 5, 'UP'), c = u.mem.mitmController;
  for (const k of ['atk', 'def', 'maxHp', 'cost']) near(u.base[k], r.stats[k]);assert.deepEqual(u.def.tags, r.tags);
  const t = deployRegularSummon(b, card, 6, 5), state = c.devices.point;
  for (const k of ['atk', 'def', 'maxHp']) near(t.base[k], r.token.stats[k]);
  advance(b, 1.1);retreatRegularSummon(b, summonUnitId(t));assert.equal(state.mode, 0);assert.ok(t.alive);
  near(state.readyAt - b.time, [20, 17, 15][elite]);near(t.mem.mitmReadyAt - b.time, [21, 18, 16][elite]);
  until(b, () => state.mode === 'warming', [21, 18, 16][elite]);
  advance(b, 1);assert.equal(state.mode, 1);near(t.hp, t.s.maxHp);
});

for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) test(`public Mitm ${dir}: rotated host placement, fixed token art and independent wreckage`, () => {
  const { b } = make(), u = b.deployOperator(ID, 5, 5, dir), c = u.mem.mitmController;
  const row = 5 + (dir === 'UP' ? 1 : dir === 'DOWN' ? -1 : 0), col = 5 + (dir === 'RIGHT' ? 1 : dir === 'LEFT' ? -1 : 0);
  assert.equal(summonPlacementError(b, card, row, col), null);
  const t = deployRegularSummon(b, card, row, col, dir);assert.equal(t.dir, 'RIGHT');
  assert.equal(regularModelKey(t), `operator/${TOKEN}/default/front`);advance(b, 1.1);
  const dp = b.dp;retreatRegularSummon(b, summonUnitId(t));assert.equal(t.alive, true);assert.equal(c.devices.point.mode, 0);near(b.dp, dp);
  const waste = c.devices.all().filter(v => v !== t);assert.ok(waste.length > 0);
  for (const w of waste) {
    assert.equal(w.mem.mitmMode, 2);assert.equal(w.mem.regularFormVisual.clip, 'Waste');assert.equal(w.s.blockCnt, 1);
    assert.equal(w.s.atk, 0);assert.equal(w.s.def, 0);near(w.hp, w.s.maxHp);near(w.s.maxHp, c.record.token.stats.maxHp / 2);
    assert.equal(selectedRegularSummon(b, summonUnitId(w)).unit, w);
  }
  retreatRegularSummon(b, summonUnitId(waste[0]));assert.equal(waste[0].alive, false);
  advance(b, 16.1);assert.equal(c.devices.point.mode, 1);assert.equal(c.devices.stock, 0);
  b.retreatOperator(ID);assert.equal(c.devices.all().length, 0);assert.equal(b.regularSummons.has(card), false);
});

test('public support, viewport gate, controls and redeployment keep fresh owner/device lifetimes', () => {
  const { b, build } = make({ skill: 2, support: true, potential: 6, trust: 200 }), u = b.deployOperator(ID, 5, 5, 'RIGHT'), c = u.mem.mitmController;
  near(u.base.atk, selectedMitmBuild(build).stats.atk);
  b.setViewport('inline');assert.match(summonPlacementError(b, card, 5, 6), /fullscreen/);b.setViewport('fullscreen-workspace');
  assert.match(summonPlacementError(b, card, 9, 9), /range/);
  const t = deployRegularSummon(b, card, 5, 6);until(b, () => u.skill.ready);
  b.addBuff(u, { key: 'qa:stun', flags: { stun: true } });assert.equal(b.activateOperator(ID), false);assert.equal(u.skill.ready, true);
  b.removeBuff(u, 'qa:stun');assert.equal(b.activateOperator(ID), true);b.retreatOperator(ID);
  assert.equal(t.alive, false);assert.equal(c.devices.tokens.size, 0);assert.equal(c.handles.length + c.devices.handles.length, 0);
  until(b, () => b.bench[ID].readyAt <= b.time);b.getPlayer('arkpedia').dp = 99;
  const next = b.deployOperator(ID, 5, 5, 'RIGHT');assert.notEqual(next, u);assert.notEqual(next.mem.mitmController, c);
  assert.equal(next.mem.mitmController.devices.stock, 1);assert.equal(next.mem.mitmController.devices.point, null);
});

test('original 0-1 terrain requires a ranged host and a melee tactical point within its range', () => {
  const build = defaultBuild(data.operators[ID]), b = new StandardBattle(data, { operators: [build] });
  b.autoFinish = false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp = 99;
  assert.throws(() => b.deployOperator(ID, 3, 4, 'RIGHT'), /ranged tile/);
  const u = b.deployOperator(ID, 4, 4, 'RIGHT');assert.equal(u.def.position, 'RANGED');
  assert.match(summonPlacementError(b, card, 4, 5), /melee tile/);
  assert.match(summonPlacementError(b, card, 2, 1), /range/);
  const point = deployRegularSummon(b, card, 3, 5);assert.equal(point.def.position, 'MELEE');
  assert.equal(point.ownerUnit, u);assert.equal(point.dir, 'RIGHT');
});
