// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-ling-prefabs.json' with { type: 'json' };
import review from '../data/arkpedia-ling-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { catalogueFor, defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { regularTokenIdsFor } from '../shared/arkpedia/summons.js';
import { regularSummonCards, selectedRegularSummon, deployRegularSummon,
  retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { selectedLingBuild, LING_ID as ID } from '../server/sim/content/arkpedia-ling.js';

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
    skillId: `skchr_ling_${skill}`, skillRank: rank };
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

test('public Ling source/art approval loads all skills and original dragons, with modules still held', async () => {
  for (const [file, key] of [['prefabs', 'sourceFoundationSha256'], ['dragon-art', 'dragonArtworkSha256']]) {
    const bytes = await readFile(new URL(`../data/arkpedia-ling-${file}.json`, import.meta.url));
    assert.equal(review[key], createHash('sha256').update(bytes).digest('hex'));
  }
  assert.deepEqual(review.enabledOperators, [ID]); assert.deepEqual(evidence.enabledOperators, []);
  assert.deepEqual(evidence.heldOperators, [ID]); assert.equal(review.frameParity, false);
  assert.equal(evidence.source.commit, data.sources[evidence.source.repository]);
  assert.deepEqual(catalogueFor(data)[ID].skills.map(s => s.id), [1, 2, 3].map(n => `skchr_ling_${n}`));
  assert.deepEqual(catalogueFor(data)[ID].modules, []);
  assert.deepEqual(regularTokenIdsFor([ID]), [1, 2, 3].map(n => `token_10020_ling_soul${n}`));
  for (const change of [{ elite: 0, level: 1, skillId: 'skchr_ling_2', skillRank: 1 },
    { elite: 1, level: 1, skillId: 'skchr_ling_3', skillRank: 1 }, { module: 'mod-x' }])
    assert.throws(() => recordFor({ ...defaultBuild(data.operators[ID]), ...change }, data));
  for (let n = 1; n <= 3; n++) for (const facing of ['front', 'back']) {
    const id = `token_10020_ling_soul${n}`, m = data.sd.models[`operator/${id}/default/${facing}`];
    assert.equal(m.source.facingAlias, 'single-original-model');
    assert.equal(m.animationRoles.die, 'Die'); assert.equal(m.animationRoles.attack, 'Attack');
    assert.equal(m.skeleton.sha256, evidence.officialTokenSkeletonBindings[id].sha256);
    assert.equal(m.premultipliedAlpha, true); assert.ok(data.tokens[id].avatar);
    if (n === 3) assert.ok(m.animations.Attack_02 && m.animations.Idle_02 && m.animations.Die_02);
  }
});

for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++)
  test(`public Ling S${skill} rank ${rank}: natural SP, source damage, stock lifecycle and clean removal`, () => {
    const { b, build } = make({ skill, rank }), r = selectedLingBuild(build);
    const dp = b.dp, cost = b.cost(ID), u = b.deployOperator(ID, 5, 5, 'RIGHT'), c = u.mem.lingController;
    const ownerTarget = enemy(b, 5, 6), target = enemy(b, 12, 11), hits = [];
    b.on('damaged', h => { if (h.source === u || h.source?.ownerUnit === u) hits.push(h); });
    near(b.dp, dp - cost); near(u.base.atk, r.stats.atk); near(u.skill.sp, r.source.spData.initSp);
    assert.equal(c.record.index, skill - 1); assert.equal(regularSummonCards(b).length, 1);
    const card = regularSummonCards(b)[0]; assert.equal(card.key, CARD);
    assert.equal(card.stock, r.token.stats.maxDeckStackCnt);
    const token = deployRegularSummon(b, CARD, 12, 10, 'RIGHT');
    assert.equal(token.defId, `token_10020_ling_soul${skill}`); assert.equal(token.ownerUnit, u);
    assert.equal(token.deploymentSlotCost, 1); assert.equal(token.s.flags.healFree, true);
    near(token.base.atk, r.token.stats.atk); near(b.dp, dp - cost - r.token.stats.cost);
    assert.equal(selectedRegularSummon(b, `token:${token.id}`).unit, token);
    assert.equal(c.record.token.arkpedia.level, build.level);
    until(b, () => hits.some(h => h.source === token));
    until(b, () => u.skill.ready);
    const stock = c.deck.stock, ordinaryAtk = token.s.atk, ordinaryAspd = token.s.aspd;
    assert.equal(b.activateOperator(ID), true);
    assert.equal(c.deck.stock, stock + (skill === 1 ? 1 : 0));
    if (skill === 2) {
      until(b, () => hits.some(h => h.dmg.tags.includes('ling:s2')));
      const castHit = hits.find(h => h.source === token && h.dmg.tags.includes('ling:s2'));
      assert.ok(castHit); near(castHit.amount, token.s.atk * r.bb.atk_scale);
      assert.equal(target.s.flags.bind, true);
    } else {
      near(token.s.atk, ordinaryAtk * (1 + r.bb.atk));
      if (skill === 1) near(token.s.aspd, ordinaryAspd + r.bb.attack_speed);
      else until(b, () => hits.some(h => h.dmg.tags.includes('ling:s3:aura')));
    }
    const afterPayment = b.dp;
    until(b, () => !u.skill.active);
    assert.equal(token.alive, true); assert.equal(c.deck.stock, stock + (skill === 1 || skill === 3 ? 1 : 0));
    near(b.dp, afterPayment); near(token.s.atk, ordinaryAtk); assert.equal(ownerTarget.alive, true);
    b.retreatOperator(ID); assert.equal(token.alive, false); assert.equal(c.stopped, true);
    assert.equal(c.handles.length, 0); assert.equal(c.skills.tokens.size, 0);
    assert.equal(regularSummonCards(b)[0].stock, 0); b._finish('victory');
  });

for (const elite of [0, 1, 2]) test(`public Ling E${elite} stock/build interpolation keeps trust and potential off dragons`, () => {
  const { b, build } = make({ elite, rank: 1, level: 25, potential: 6, trust: 200 });
  const r = selectedLingBuild(build), u = b.deployOperator(ID, 5, 5, 'UP');
  const token = deployRegularSummon(b, CARD, 12, 10, 'LEFT');
  near(u.base.atk, r.stats.atk); near(token.base.atk, r.token.stats.atk);
  assert.equal(regularSummonCards(b)[0].stock, [3, 4, 5][elite] - 1);
  assert.equal(u.mem.regularVisualDirection, 'UP');
  b._finish('victory');
});

for (const skill of [1, 2, 3]) test(`public Ling S${skill} permits silence, rejects stun, terrain, cooldown and insufficient DP`, () => {
  const { b } = make({ skill }), u = b.deployOperator(ID, 5, 5, 'RIGHT'), c = u.mem.lingController;
  const stock = c.deck.stock, dp = b.dp, tile = b.grid.tile(12, 10);
  tile.build = skill === 2 ? 'MELEE' : 'RANGED';
  assert.throws(() => deployRegularSummon(b, CARD, 12, 10)); assert.equal(c.deck.stock, stock); near(b.dp, dp);
  tile.build = skill === 2 ? 'RANGED' : 'MELEE'; b.getPlayer('arkpedia').dp = 0;
  assert.throws(() => deployRegularSummon(b, CARD, 12, 10), /DP/); assert.equal(c.deck.stock, stock);
  b.getPlayer('arkpedia').dp = dp;
  const t = deployRegularSummon(b, CARD, 12, 10, 'LEFT'); assert.equal(t.dir, 'LEFT');
  assert.throws(() => deployRegularSummon(b, CARD, 12, 12), /redeploying/);
  b.addBuff(u, { key: 'qa:silence', flags: { silence: true } }); until(b, () => u.skill.ready);
  assert.equal(u.skill.silenceBlocked, false);
  b.addBuff(u, { key: 'qa:stun', flags: { stun: true } });
  const sp = u.skill.sp; assert.equal(b.activateOperator(ID), false); near(u.skill.sp, sp);
  b.removeBuff(u, 'qa:stun'); assert.equal(b.activateOperator(ID), true); assert.equal(b.activateOperator(ID), false);
  b._finish('victory');
});

for (const [dir, dr, dc] of [['RIGHT', 0, 1], ['UP', 1, 0], ['LEFT', 0, -1], ['DOWN', -1, 0]])
  for (const reverse of [false, true]) test(`public Ling S3 ${dir} fusion ${reverse ? 'incoming' : 'outgoing'} keeps two slots and higher death art`, () => {
    const { b } = make({ skill: 3 }); const u = b.deployOperator(ID, 5, 5, 'RIGHT');
    const first = deployRegularSummon(b, CARD, 12, 10, dir); advance(b, 20);
    const second = deployRegularSummon(b, CARD, 12 + dr, 10 + dc, reverse ? { RIGHT: 'LEFT', LEFT: 'RIGHT', UP: 'DOWN', DOWN: 'UP' }[dir] : dir);
    until(b, () => !first.alive || !second.alive, 1);
    const higher = first.alive ? first : second, gone = first.alive ? second : first;
    assert.equal(higher, reverse ? first : second);
    assert.equal(higher.deploymentSlotCost, 2); assert.equal(gone.deploymentSlotCost, 0);
    assert.equal(b.deployedSlots(), 3); assert.equal(u.mem.lingController.deck.own().length, 1);
    assert.equal(higher.mem.regularFormVisual.clip, 'Idle_02'); assert.equal(higher.mem.regularFormVisual.die, 'Die_02');
    near(higher.s.blockCnt, 4); near(higher.hp, higher.s.maxHp);
    const dp = b.dp, slots = b.deployedSlots(); retreatRegularSummon(b, `token:${higher.id}`);
    assert.equal(b.deployedSlots(), slots - 2); near(b.dp, dp + Math.floor(u.mem.lingController.deck.record.stats.cost * .5));
    assert.equal(higher.mem.regularDeathVisual.clip, 'Die_02'); assert.equal(higher.mem.regularDeathVisual.duration, 1);
    b._finish('victory');
  });

test('public Ling S2 retrieves low-HP dragons at the native delay without retrieving exactly half HP', () => {
  const { b } = make({ skill: 2 }), u = b.deployOperator(ID, 5, 5, 'RIGHT');
  const low = deployRegularSummon(b, CARD, 12, 10); advance(b, 10);
  const half = deployRegularSummon(b, CARD, 12, 12); low.hp *= .49; half.hp *= .5;
  until(b, () => u.skill.ready); const stock = u.mem.lingController.deck.stock, dp = b.dp;
  assert.equal(b.activateOperator(ID), true); advance(b, 1.2); assert.equal(low.alive, true);
  until(b, () => !u.skill.active, .1);
  assert.equal(low.alive, false); assert.equal(half.alive, true);
  assert.equal(u.mem.lingController.deck.stock, stock + 1); near(b.dp, dp); b._finish('victory');
});

test('public maxed Ling support redeploys with a fresh deck and removes higher dragons on owner departure', () => {
  const { b, build } = make({ skill: 3, support: true });
  b.setViewport('preview'); assert.throws(() => b.deployOperator(ID, 5, 5, 'RIGHT'));
  b.setViewport('fullscreen-workspace'); const u = b.deployOperator(ID, 5, 5, 'RIGHT'), old = u.mem.lingController;
  near(u.base.atk, selectedLingBuild(build).stats.atk);
  const t = deployRegularSummon(b, CARD, 12, 10); advance(b, 20); deployRegularSummon(b, CARD, 12, 11, 'LEFT'); advance(b, .3);
  assert.equal(t.deploymentSlotCost, 2); b.retreatOperator(ID);
  assert.equal(t.alive, false); assert.equal(t.mem.regularDeathVisual.die, 'Die_02'); assert.equal(old.stopped, true);
  advance(b, 75); b.getPlayer('arkpedia').dp = 999;
  const next = b.deployOperator(ID, 5, 5, 'RIGHT');
  assert.notEqual(next.mem.lingController, old); assert.equal(regularSummonCards(b)[0].stock, 5);
  assert.equal(regularSummonCards(b)[0].owner, next); b._finish('victory');
});
