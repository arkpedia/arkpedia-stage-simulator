// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import review from '../data/arkpedia-closur-runtime-review.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { selectedClosurBuild } from '../server/sim/content/arkpedia-closur-source.js';
import { regularSummonCards, selectedRegularSummon, deployRegularSummon, retreatRegularSummon,
  summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { summonUnitId } from '../shared/arkpedia/summons.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { near, advance, until } from './helpers/mon3tr-fixture.js';
const source = process.env.ARKPEDIA_CLOSUR_REVIEW_DATA
  ? JSON.parse(readFileSync(process.env.ARKPEDIA_CLOSUR_REVIEW_DATA)) : data;
const ID = 'char_4228_closur', TOKEN = 'token_10066_closur_ourbase', CARD = `summon:${ID}`;
function make({ skill = 1, rank = 10, elite = 2, potential = 1, trust = 0, support = false, defer = false } = {}) {
  const d = structuredClone(source); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(d.operators[ID]), skillId: `skchr_closur_${skill}`, skillRank: rank,
    elite, level: d.operators[ID].phases[elite].maxLevel, potential, trust };
  const b = new StandardBattle(d, support ? { operators: [defaultBuild(d.operators.char_122_beagle)], support: build }
    : { operators: [build, defaultBuild(d.operators.char_122_beagle)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 99;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const f = { b, build: b.bench[ID].build };
  if (!defer) { f.u = b.deployOperator(ID, 3, 3, 'RIGHT'); f.prepared = f.u.mem.closur; b.getPlayer('arkpedia').dp = 0; }
  return f;
}
test('Closure public source and cards preserve all three exact skill selections and original command-center portrait', () => {
  assert.deepEqual(review.enabledOperators, [ID]);
  for (const flag of ['frameParity', 'moduleSupport', 'nativePixelParity', 'nativeParticleSupport']) assert.equal(review[flag], false);
  const hash = path => createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex');
  assert.equal(hash('data/arkpedia-native-operators/' + ID + '.json'), review.sourceFoundationSha256);
  assert.equal(hash('data/arkpedia-closur-device-art.json'), review.deviceArtworkSha256);
  assert.equal(hash(review.verification.browser.script), review.verification.browser.scriptSha256);
  assert.equal(hash(review.verification.browser.driver), review.verification.browser.driverSha256);
  for (const [key, model] of Object.entries(review.originalArtwork)) assert.deepEqual(source.sd.models[key], model);
  const op = source.operators[ID]; assert.equal(op.name, 'Closure'); assert.equal(op.sourceName, '可露希尔');
  assert.equal(op.sourceChannel, 'cn'); assert.deepEqual(op.skills.map(s => s.id), [1, 2, 3].map(n => `skchr_closur_${n}`));
  assert.deepEqual(op.skills.map(s => s.assetIcon), ['skill-icons/Closure - Recursion Tactic.webp',
    'skill-icons/Closure - Algorithm Expansion.webp', 'skill-icons/Closure - Q.E.D..webp']);
  assert.equal(source.tokens[TOKEN].name, 'Command Center');
  assert.match(source.tokens[TOKEN].avatar, /token_10066_closur_ourbase/);
  assert.equal(source.sd.models[`operator/${TOKEN}/default/front`].premultipliedAlpha, true);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 3, 6]) test(`carried E${elite}/P${potential} installs the floor before deployment without discounting Closure's own cost`, () => {
  const f = make({ elite, potential, rank: [4, 7, 10][elite], trust: 200, support: potential === 6, defer: true });
  const r = selectedClosurBuild(f.build); near(f.b.dpMinimumFor(), f.build.elite < 2 ? 0 : f.build.potential < 3 ? -3 : -4);
  assert.deepEqual(recordFor(f.build, source).stats, r.stats); near(f.b.cost(ID), r.stats.cost);
  assert.equal(regularSummonCards(f.b).length, 0);
  const before = f.b.dp, u = f.b.deployOperator(ID, 3, 3, 'RIGHT'); near(before - f.b.dp, r.stats.cost);
  const ally = f.b.deployOperator('char_122_beagle', 3, 2, 'RIGHT'); near(ally.s.atk, ally.base.atk * (f.build.elite === 2 ? 1.04 : 1));
  assert.ok(u.mem.closur); assert.equal(regularSummonCards(f.b).length, 1);
});
for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) test(`public S${skill}/rank ${rank} naturally charges and grants exactly its source DP`, () => {
  const f = make({ skill, rank }), { b, u, prepared: p } = f;
  near(u.skill.spTotal, p.record.source.spData.initSp);
  if (skill === 1) until(f, () => u.skill.active, 100);
  else { until(f, () => skillHud(u.skill).canActivate, 100); assert.equal(b.activateOperator(ID), true); }
  until(f, () => !u.skill.active, 35);
  const bb = p.record.bb;
  near(b.dp, skill === 1 ? bb.cost : skill === 2 ? bb.cost + bb.cost_period * bb['closur_s_2[add_cost_period].cost']
    : bb.cost_period * bb['closur_s_3[add_cost_period].cost']);
  assert.equal(b.allyUnits.filter(a => a.kind === 'token').length, 0); assert.deepEqual(b.errors, []);
});
test('command-center card delegates range/fullscreen/occupied checks and ignores direction with no DP or deployment-slot cost', () => {
  const f = make({ skill: 3 }), { b, prepared: p } = f;
  const card = regularSummonCards(b)[0]; assert.equal(card.key, CARD); assert.equal(card.available, true);
  assert.equal(card.config.chooseFacing, false); assert.equal(card.config.fixedRotation, true); assert.equal(card.cost, 0);
  b.setViewport('preview'); assert.match(summonPlacementError(b, CARD, 3, 4), /fullscreen/); b.setViewport('fullscreen-workspace');
  assert.match(summonPlacementError(b, CARD, 3, 3), /occupied/); assert.match(summonPlacementError(b, CARD, 0, 0), /attack range/);
  b.unitLimit = 1; b.getPlayer('arkpedia').dp = -3;
  const t = deployRegularSummon(b, CARD, 3, 4, 'UP'); assert.equal(t.dir, 'RIGHT'); near(b.dp, -3); assert.equal(b.deployedSlots(), 1);
  assert.equal(t.defId, TOKEN); assert.equal(selectedRegularSummon(b, summonUnitId(t)).unit, t);
  assert.equal(regularSummonCards(b)[0].deployed, 1); assert.equal(regularSummonCards(b)[0].available, false);
  assert.throws(() => deployRegularSummon(b, CARD, 3, 5), /already deployed/);
  until(f, () => p.point.active(), 1); near(t.hp, t.s.maxHp); assert.deepEqual(b.errors, []);
});
test('public command-center withdrawal keeps the point, blocks duplicate cards and restores at native OnStart after recharge', () => {
  const f = make({ skill: 2 }), { b, prepared: p } = f, t = deployRegularSummon(b, CARD, 3, 4);
  until(f, () => p.point.active(), 1); const dp = b.dp, seq = t.deploySeq;
  retreatRegularSummon(b, summonUnitId(t)); assert.equal(p.point.point.mode, 'recharge'); near(t.hp, 1); near(b.dp, dp);
  assert.equal(t.alive, true); assert.equal(regularSummonCards(b)[0].stock, 0); assert.equal(regularSummonCards(b)[0].deployed, 1);
  assert.throws(() => retreatRegularSummon(b, summonUnitId(t)), /already recovering/);
  advance(b, 14.9); assert.equal(p.point.point.mode, 'recharge');
  until(f, () => p.point.point.mode === 'born', 1); near(t.hp, 1);
  until(f, () => p.point.active(), 1); near(t.hp, t.s.maxHp); assert.equal(t.deploySeq, seq); assert.equal(b.deployedSlots(), 1);
});
test('public owner removal cleans card and point; redeployment owns a fresh independent deck', () => {
  const f = make({ skill: 3 }), { b, u, prepared: p } = f, t = deployRegularSummon(b, CARD, 3, 4);
  until(f, () => p.point.active(), 1); b.retreatOperator(ID);
  assert.equal(p.controller.stopped, true); assert.equal(t.alive, false); assert.equal(regularSummonCards(b).length, 0);
  assert.equal(selectedRegularSummon(b, summonUnitId(t)), null); assert.equal(b.deployedSlots(), 0);
  until(f, () => b.bench[ID].readyAt <= b.time, 80); b.getPlayer('arkpedia').dp = 99;
  const next = b.deployOperator(ID, 3, 3, 'RIGHT'); assert.notEqual(next, u); assert.notEqual(next.mem.closurDeck, u.mem.closurDeck);
  assert.equal(regularSummonCards(b)[0].owner, next); p.controller.stop(); assert.equal(regularSummonCards(b)[0].owner, next);
  assert.ok(deployRegularSummon(b, CARD, 3, 4)); assert.deepEqual(b.errors, []);
});
for (const skill of [1, 2, 3]) test(`public S${skill} completes original 0-1 waves with natural DP, terrain, counters and command-center cleanup`, () => {
  const build = { ...defaultBuild(source.operators[ID]), skillId: `skchr_closur_${skill}` };
  const b = new StandardBattle(source, { operators: [build] }); b.setViewport('fullscreen-workspace');
  const tiles = structuredClone(b.grid.tiles); let deployed = false, point = null;
  for (let n = 0; n < 9001 && !b.finished; n++) {
    if (!deployed && b.dp >= b.cost(ID)) { b.deployOperator(ID, 4, 6, 'DOWN'); deployed = true; }
    const u = b.bench[ID].unit;
    if (u?.alive) {
      if (!point && !summonPlacementError(b, CARD, 3, 6)) point = deployRegularSummon(b, CARD, 3, 6);
      if (skillHud(u.skill).canActivate) b.activateOperator(ID);
    }
    b.step();
  }
  const result = b.result(); assert.equal(result.reason, 'cleared'); assert.equal(result.total, 11); assert.ok(point);
  const leaked = result.perPlayer.arkpedia.leaked.filter(x => x.counted).length;
  assert.equal(result.killed + leaked, 11); assert.equal(b.life, source.stage.battle.max_life - leaked);
  assert.deepEqual(b.grid.tiles, tiles); assert.deepEqual(b.errors, []); assert.equal(regularSummonCards(b).length, 0);
  assert.equal(b.bench[ID].unit.mem.closur.controller.stopped, true); assert.equal(point.alive, false);
});
test('carried public Closure permits an exact-floor operator payment before she is deployed', () => {
  const f = make({ defer: true }), { b } = f, id = 'char_122_beagle';
  b.getPlayer('arkpedia').dp = b.cost(id) - 3;
  const u = b.deployOperator(id, 3, 2, 'RIGHT'); assert.ok(u); near(b.dp, -3);
  assert.equal(b.bench[ID].unit, null); assert.match(b.placementError(ID, 3, 3), /DP/);
  assert.equal(regularSummonCards(b).length, 0); assert.deepEqual(b.errors, []);
});
test('selected public Closure S3 rejects injected enemy abilities for squad and support before starting the battle', () => {
  for (const support of [false, true]) {
    const d = structuredClone(source); d.enemies.enemy_1007_slime.skills = [{ prefabKey: 'unreviewed', cooldown: 1 }];
    const build = { ...defaultBuild(d.operators[ID]), skillId: 'skchr_closur_3' };
    assert.throws(() => new StandardBattle(d, support
      ? { operators: [defaultBuild(d.operators.char_122_beagle)], support: build } : { operators: [build] }),
    /needs native clock review for enemy abilities/);
  }
});
