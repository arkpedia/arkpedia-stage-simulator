// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-magallan-prefabs.json' with { type: 'json' };
import review from '../data/arkpedia-magallan-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { catalogueFor, defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { regularTokenIdsFor } from '../shared/arkpedia/summons.js';
import { regularSummonCards, selectedRegularSummon, deployRegularSummon,
  retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { selectedMagallanBuild, MAGALLAN_ID as ID } from '../server/sim/content/arkpedia-magallan.js';

const CARD = 'summon:' + ID;
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(b, condition, seconds = 65) {
  const end = b.time + seconds;
  while (!condition() && b.time < end) b.step();
  assert.ok(condition(), `Condition missing at ${b.time}`); assert.deepEqual(b.errors, []);
}
function make({ skill = 1, rank = 10, elite = 2, level = data.operators[ID].phases[elite].maxLevel,
  potential = 1, trust = 0, support = false } = {}) {
  const d = structuredClone(data);
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(d.operators[ID]), elite, level, potential, trust,
    skillId: `skchr_mgllan_${skill}`, skillRank: rank };
  const b = new StandardBattle(d, support ? { operators: [defaultBuild(d.operators.char_289_gyuki)], support: { ...build, elite: 2, level: 90, potential: 6, trust: 200 } }
    : { operators: [build] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.getPlayer('arkpedia').dp = 99;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  return { b, build: b.bench[ID].build };
}
function enemy(b, row, col) {
  const t = b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: 1e7, atk: 0, def: 0, res: 0, moveSpeed: 1 });
  t.markDirty(); void t.s; t.hp = 1e7;
  b.addBuff(t, { key: 'qa:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return t;
}

test('public Magallan approval binds the unchanged source and artwork, and loads all original drones', async () => {
  for (const [name, key] of [['prefabs', 'sourceFoundationSha256'], ['drone-art', 'droneArtworkSha256']]) {
    const bytes = await readFile(new URL(`../data/arkpedia-magallan-${name}.json`, import.meta.url));
    assert.equal(review[key], createHash('sha256').update(bytes).digest('hex'));
  }
  assert.deepEqual(review.enabledOperators, [ID]); assert.deepEqual(evidence.enabledOperators, []);
  assert.deepEqual(evidence.heldOperators, [ID]); assert.equal(review.frameParity, false);
  assert.equal(evidence.source.commit, data.sources[evidence.source.repository]);
  const catalogue = catalogueFor(data)[ID];
  assert.deepEqual(catalogue.skills.map(s => s.id), [1, 2, 3].map(n => `skchr_mgllan_${n}`));
  assert.deepEqual(catalogue.modules, []);
  assert.deepEqual(regularTokenIdsFor([ID]), [1, 2, 3].map(n => `token_10005_mgllan_drone${n}`));
  for (const change of [{ elite: 0, level: 1, skillId: 'skchr_mgllan_2', skillRank: 1 },
    { elite: 1, level: 1, skillId: 'skchr_mgllan_3', skillRank: 1 }, { module: 'mod-x' }])
    assert.throws(() => recordFor({ ...defaultBuild(data.operators[ID]), ...change }, data));
  for (let n = 1; n <= 3; n++) for (const facing of ['front', 'back']) {
    const id = `token_10005_mgllan_drone${n}`, m = data.sd.models[`operator/${id}/default/${facing}`];
    assert.equal(m.source.facingAlias, 'single-original-model');
    assert.equal(m.animationRoles.die, 'Idle'); assert.equal(m.animationRoles.attack, n === 1 ? null : 'Attack');
    assert.equal(m.skeleton.sha256, evidence.officialTokenSkeletonBindings[id].sha256);
    assert.equal(m.premultipliedAlpha, true); assert.ok(data.tokens[id].avatar);
  }
});

for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++)
  test(`public Magallan S${skill} rank ${rank}: source SP, drone effects, natural recycle and cleanup`, () => {
    const { b, build } = make({ skill, rank }), r = selectedMagallanBuild(build);
    const dp = b.dp, cost = b.cost(ID), u = b.deployOperator(ID, 5, 5, 'RIGHT');
    const c = u.mem.magallanController, ownerTarget = enemy(b, 5, 6), target = enemy(b, 12, skill === 2 ? 10 : 11);
    const hits = []; b.on('damaged', h => { if (h.source === u || h.source?.ownerUnit === u) hits.push(h); });
    near(b.dp, dp - cost); near(u.base.atk, r.stats.atk); near(u.skill.sp, r.source.spData.initSp);
    assert.equal(c.record.index, skill - 1); assert.equal(regularSummonCards(b).length, 1);
    assert.equal(c.record.token.arkpedia.elite, build.elite);
    assert.equal(c.record.token.arkpedia.level, build.level);
    const card = regularSummonCards(b)[0]; assert.equal(card.key, CARD); assert.equal(card.stock, 5);
    const token = deployRegularSummon(b, CARD, 12, 10, 'RIGHT');
    assert.equal(token.defId, `token_10005_mgllan_drone${skill}`);
    assert.equal(token.ownerUnit, u); assert.equal(token.deploymentSlotCost, 1);
    assert.equal(token.s.flags.healFree, true); assert.equal(token.s.flags.stealth, true);
    near(token.base.atk, r.token.stats.atk); near(b.dp, dp - cost - r.token.stats.cost);
    assert.equal(selectedRegularSummon(b, `token:${token.id}`).unit, token);
    until(b, () => hits.some(h => h.source === u));
    if (skill === 1) { until(b, () => target.s.moveSpeed < target.base.moveSpeed); assert.equal(token.s.flags.disarm, true); }
    else until(b, () => hits.some(h => h.source === token));
    until(b, () => u.skill.ready);
    const stock = c.deck.stock, ordinaryAtk = token.s.atk, ordinaryAspd = token.s.aspd;
    assert.equal(b.activateOperator(ID), true); assert.equal(u.skill.active, true);
    if (skill === 1) until(b, () => target.s.flags.bind);
    if (skill === 2) {
      near(token.s.aspd - ordinaryAspd, r.bb.attack_speed);
      until(b, () => hits.some(h => h.dmg.tags.includes('mgllan:drone2:active')));
    }
    if (skill === 3) {
      near(token.s.atk - ordinaryAtk, token.base.atk * r.bb.atk);
      until(b, () => hits.some(h => h.dmg.tags.includes('mgllan:drone3:active')));
    }
    const afterPayment = b.dp;
    until(b, () => !u.skill.active);
    assert.equal(token.alive, false); assert.equal(c.deck.stock, stock + 1);
    near(b.dp, afterPayment); assert.ok(c.deck.readyAt > b.time);
    assert.equal(ownerTarget.alive, true);
    b.retreatOperator(ID); assert.equal(c.stopped, true); assert.equal(c.handles.length, 0);
    assert.equal(regularSummonCards(b)[0].stock, 0); b._finish('victory');
  });

for (const elite of [0, 1, 2]) test(`public Magallan E${elite} interpolates build stats without passing trust/potential to drones`, () => {
  const { b, build } = make({ elite, rank: 1, level: 25, potential: 6, trust: 200 });
  const r = selectedMagallanBuild(build), u = b.deployOperator(ID, 5, 5, 'LEFT');
  for (const k of ['atk', 'def', 'maxHp', 'cost']) near(u.base[k], r.stats[k]);
  near(u.base.res, r.stats.magicResistance);
  const card = regularSummonCards(b)[0]; assert.equal(card.stock, [3, 4, 5][elite]);
  const token = deployRegularSummon(b, CARD, 12, 10);
  near(token.base.atk, r.token.stats.atk); near(token.base.maxHp, r.token.stats.maxHp);
  assert.equal(token.s.flags.stealth ?? false, elite > 0);
  b._finish('victory'); assert.equal(token.alive, false); assert.equal(card.deck.stock, 0);
});

for (const skill of [1, 2, 3]) test(`public Magallan S${skill} respects native silence permission and blocks casts while stunned`, () => {
  const { b } = make({ skill }), u = b.deployOperator(ID, 5, 5, 'RIGHT');
  b.addBuff(u, { key: 'qa:silence', flags: { silence: true } });
  until(b, () => u.skill.ready); assert.equal(u.skill.silenceBlocked, false);
  b.addBuff(u, { key: 'qa:stun', flags: { stun: true } });
  const sp = u.skill.sp; assert.equal(b.activateOperator(ID), false); near(u.skill.sp, sp);
  b.removeBuff(u, 'qa:stun'); assert.equal(b.activateOperator(ID), true);
  advance(b, 1); assert.equal(u.skill.active, true);
  assert.equal(b.activateOperator(ID), false); assert.equal(u.skill.active, true);
  until(b, () => !u.skill.active);
  b._finish('victory');
});

for (const skill of [1, 2, 3]) test(`public Magallan S${skill} validates terrain and maintains stock on rejected deployment`, () => {
  const { b } = make({ skill }), u = b.deployOperator(ID, 5, 5, 'RIGHT');
  const c = u.mem.magallanController, stock = c.deck.stock, dp = b.dp;
  const tile = b.grid.tile(12, 10);
  tile.build = skill === 1 ? 'NONE' : skill === 2 ? 'RANGED' : 'MELEE';
  assert.ok(summonPlacementError(b, CARD, 12, 10));
  assert.throws(() => deployRegularSummon(b, CARD, 12, 10)); near(b.dp, dp); assert.equal(c.deck.stock, stock);
  tile.build = skill === 3 ? 'RANGED' : 'MELEE';
  assert.equal(summonPlacementError(b, CARD, 12, 10), null);
  const token = deployRegularSummon(b, CARD, 12, 10, 'UP');
  assert.equal(token.dir, skill === 3 ? 'UP' : 'RIGHT');
  assert.equal(regularSummonCards(b)[0].config.chooseFacing, skill === 3);
  assert.ok(summonPlacementError(b, CARD, 12, 11));
  retreatRegularSummon(b, `token:${token.id}`);
  assert.equal(c.deck.stock, stock - 1);
  near(b.dp, dp - c.deck.record.stats.cost + Math.floor(c.deck.record.stats.cost * .5));
  b._finish('victory');
});

test('public Magallan maxed support and fresh redeployment have independent controllers and original back art', () => {
  const { b, build } = make({ skill: 3, support: true }), r = selectedMagallanBuild(build), dp = b.dp;
  b.setViewport('preview'); assert.throws(() => b.deployOperator(ID, 5, 5, 'RIGHT')); near(b.dp, dp);
  b.setViewport('fullscreen-workspace'); assert.throws(() => b.deployOperator(ID, 5, 5, 'BAD')); near(b.dp, dp);
  const u = b.deployOperator(ID, 5, 5, 'UP'), old = u.mem.magallanController;
  near(u.base.atk, r.stats.atk); assert.equal(u.mem.regularVisualDirection, 'UP');
  const token = deployRegularSummon(b, CARD, 12, 10, 'LEFT');
  b.retreatOperator(ID); assert.equal(token.alive, false); assert.equal(old.stopped, true);
  advance(b, 75); b.getPlayer('arkpedia').dp = 999;
  const next = b.deployOperator(ID, 5, 5, 'RIGHT');
  assert.notEqual(next.mem.magallanController, old); assert.equal(old.handles.length, 0);
  assert.equal(regularSummonCards(b)[0].stock, 5); assert.equal(regularSummonCards(b)[0].owner, next);
  b._finish('victory'); assert.equal(next.mem.magallanController.stopped, true);
});

for (const [dir, dr, dc] of [['RIGHT', 0, 1], ['UP', 1, 0], ['LEFT', 0, -1], ['DOWN', -1, 0]])
  test(`public combat drone ${dir} attacks the original rotated range, without hitting the rear tile`, () => {
    const { b } = make({ skill: 3 }); b.deployOperator(ID, 5, 5, 'RIGHT');
    const token = deployRegularSummon(b, CARD, 12, 10, dir);
    const front = enemy(b, 12 + 2 * dr, 10 + 2 * dc);
    const rear = enemy(b, 12 - 2 * dr, 10 - 2 * dc);
    const hits = []; b.on('damaged', h => { if (h.source === token) hits.push(h.target); });
    until(b, () => hits.includes(front)); assert.ok(!hits.includes(rear));
    b._finish('victory');
  });
