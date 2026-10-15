// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import review from '../data/arkpedia-mon3tr-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { catalogueFor, defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { regularTokenIdsFor, summonCardId, summonUnitId } from '../shared/arkpedia/summons.js';
import { regularSummonCards, summonPlacementError, deployRegularSummon, retreatRegularSummon } from '../server/sim/content/arkpedia-summons.js';
import { selectedMon3trBuild } from '../server/sim/content/arkpedia-mon3tr-source.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_4179_monstr', TOKEN = 'token_10050_monstr_prosts', CARD = summonCardId(ID);
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) { for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step(); assert.deepEqual(b.errors, []); }
function until(b, predicate, seconds = 140) {
  const end = b.time + seconds;
  while (!predicate() && b.time < end) advance(b, b.dt);
  assert.ok(predicate(), `Condition missing at ${b.time}`);
}
function make({ skill = 1, rank = 10, elite = 2, potential = 1, trust = 0, support = false } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(d.operators[ID]), skillId: `skchr_monstr_${skill}`, skillRank: rank, elite,
    level: d.operators[ID].phases[elite].maxLevel, potential, trust };
  const b = new StandardBattle(d, support ? { operators: [defaultBuild(d.operators.char_124_kroos)], support: build } : { operators: [build] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 99;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const before = b.dp, cost = b.cost(ID), u = b.deployOperator(ID, 5, 5, 'RIGHT'); near(before - b.dp, cost);
  const hits = [], heals = []; b.on('damaged', ctx => { if (ctx.source === u) hits.push(ctx); });
  b.on('calculatedHeal', ctx => { if (ctx.source === u) heals.push(ctx); });
  return { b, u, c: u.mem.mon3trHealing, build: b.bench[ID].build, hits, heals };
}
function enemy(b) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [5, 7] });
  Object.assign(e.base, { maxHp: 1e9, atk: 0, def: 0, res: 0, moveSpeed: 0 }); e.markDirty(); e.hp = e.s.maxHp;
  b.addBuff(e, { key: 'qa:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
test('public Mon3tr binds all three source skills and four immutable owner/token model records', async () => {
  assert.deepEqual(REGULAR_OPERATORS[ID].skillIds, [1, 2, 3].map(n => `skchr_monstr_${n}`));
  assert.ok(catalogueFor(data)[ID]); assert.deepEqual(regularTokenIdsFor([ID]), [TOKEN]); assert.ok(data.tokens[TOKEN]);
  for (const [name, key] of [['prefabs', 'sourceFoundationSha256'], ['device-art', 'deviceArtworkSha256']])
    assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-mon3tr-${name}.json`, import.meta.url))).digest('hex'), review[key]);
  for (const [key, model] of Object.entries(review.originalArtwork)) assert.deepEqual(data.sd.models[key], model);
  assert.equal(data.sd.models[`operator/${TOKEN}/default/front`].animationRoles.attack, null);
  for (const flag of ['frameParity', 'moduleSupport', 'nativeParticleSupport', 'nativePixelParity']) assert.equal(review[flag], false);
});
for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++)
  test(`public S${skill} rank ${rank} uses selected source mechanics, natural SP and the common Reconstruction card`, () => {
    const { b, u, c, heals, hits } = make({ skill, rank });
    assert.equal(c.record.index, skill - 1); assert.equal(c.record.build.skillRank, rank);
    near(u.skill.spTotal, u.skill.initSp); const slots = b.deployedSlots(), dp = b.dp;
    const card = regularSummonCards(b).find(x => x.key === CARD); assert.equal(card.cost, 3); assert.equal(card.config.chooseFacing, false);
    const point = deployRegularSummon(b, CARD, 5, 6); near(b.dp, dp - 3); assert.equal(point.defId, TOKEN);
    assert.equal(point.deploymentSlotCost, 0); assert.equal(b.deployedSlots(), slots);
    if (skill === 1) {
      until(b, () => u.skill.activations > 0 && heals.some(h => h.amount > u.s.atk));
      assert.ok(heals.some(h => h.amount > u.s.atk));
    } else {
      until(b, () => skillHud(u.skill).canActivate); assert.equal(b.activateOperator(ID), true);
      if (skill === 2) {
        until(b, () => heals.some(h => h.opts.mon3trTag === 's2-extra'), 8);
        assert.ok(c.ownerSkills.active()); assert.equal(point.alive, true);
      } else {
        enemy(b); until(b, () => hits.some(h => h.dmg.tags.includes('mon3tr:s3')), 8);
        assert.equal(point.alive, false); assert.equal(u.tileC, 6); assert.equal(c.ownerSkills.state.marker.tileC, 5);
        assert.ok(heals.some(h => h.opts.mon3trTag === 's3'));
        until(b, () => !c.ownerSkills.state, 30); assert.equal(u.tileC, 5);
      }
    }
    b.retreatOperator(ID); assert.equal(c.stopped, true); assert.equal(c.deck.stopped, true);
    assert.equal(regularSummonCards(b).length, 0); advance(b, 2); assert.equal(b.deployedSlots(), 0);
  });
for (const elite of [0, 1, 2]) for (const potential of [1, 6])
  test(`public E${elite}/P${potential} preserves source stats, trust, talents and support selection`, () => {
    const f = make({ elite, potential, trust: 200, rank: [4, 7, 10][elite], support: potential === 6 });
    const r = selectedMon3trBuild(f.build); assert.deepEqual(recordFor(f.build, data).stats, r.stats);
    near(f.u.s.atk, r.stats.atk); near(f.u.s.maxHp, r.stats.maxHp);
    assert.deepEqual(f.c.record.talentBb, r.talentBb); assert.deepEqual(f.u.def.tags, r.tags);
  });
test('common card keeps fullscreen, DP, source cooldown, refund and owner redeployment boundaries', () => {
  const { b, u, c } = make(); b.setViewport('inline'); const before = b.dp;
  assert.match(summonPlacementError(b, CARD, 5, 6), /fullscreen/); assert.throws(() => deployRegularSummon(b, CARD, 5, 6)); near(b.dp, before);
  b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 2; assert.match(summonPlacementError(b, CARD, 5, 6), /DP/);
  b.getPlayer('arkpedia').dp = 99; const t = deployRegularSummon(b, CARD, 5, 6); near(b.dp, 96);
  retreatRegularSummon(b, summonUnitId(t)); near(b.dp, 97); assert.ok(c.deck.readyAt > b.time);
  b.retreatOperator(ID); assert.equal(c.stopped, true); assert.equal(regularSummonCards(b).length, 0);
  until(b, () => b.bench[ID].readyAt <= b.time, 100); b.getPlayer('arkpedia').dp = 99;
  const next = b.deployOperator(ID, 5, 5, 'RIGHT'); assert.notEqual(next, u); assert.notEqual(next.mem.mon3trHealing, c);
  assert.equal(regularSummonCards(b).length, 1); assert.equal(next.mem.mon3trHealing.deck.stock, 1);
});
for (const skill of [1, 2, 3]) test(`public S${skill} keeps unchanged stage 0-1 terrain, waves, natural DP and end cleanup`, () => {
  const build = { ...defaultBuild(data.operators[ID]), skillId: `skchr_monstr_${skill}` };
  const b = new StandardBattle(data, { operators: [build] }); b.setViewport('fullscreen-workspace');
  const tiles = structuredClone(b.grid.tiles); let deployed = false;
  for (let i = 0; i < 9001 && !b.finished; i++) {
    if (!deployed && b.dp >= b.cost(ID)) { b.deployOperator(ID, 4, 6, 'DOWN'); deployed = true; }
    const u = b.bench[ID].unit;
    if (u?.alive) {
      const card = regularSummonCards(b).find(c => c.key === CARD);
      if (card?.available && !summonPlacementError(b, CARD, 3, 7)) deployRegularSummon(b, CARD, 3, 7);
      if (skill > 1 && skillHud(u.skill).canActivate) b.activateOperator(ID);
    }
    b.step();
  }
  const result = b.result(); assert.equal(result.reason, 'cleared'); assert.equal(result.total, 11);
  const leaks = result.perPlayer.arkpedia.leaked.filter(x => x.counted).length;
  assert.equal(result.killed + leaks, 11); assert.equal(b.life, data.stage.battle.max_life - leaks);
  assert.deepEqual(b.grid.tiles, tiles); assert.deepEqual(b.errors, []);
  const c = b.bench[ID].unit.mem.mon3trHealing; assert.equal(c.stopped, true); assert.equal(c.deck.point, null);
});
