// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import review from '../data/arkpedia-necrass-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { catalogueFor, defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { regularTokenIdsFor } from '../shared/arkpedia/summons.js';
import { regularSummonCards } from '../server/sim/content/arkpedia-summons.js';
import { selectedNecrassBuild } from '../server/sim/content/arkpedia-necrass-source.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_450_necras', TOKEN = 'token_10043_necras_skeltn';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function advance(b, s) { for (let n = 0; n < Math.ceil(s / b.dt - 1e-9); n++) b.step(); assert.deepEqual(b.errors, []); }
function until(b, p, seconds = 100) {
  const end = b.time + seconds;
  while (!p() && b.time < end) advance(b, b.dt);
  assert.ok(p(), `Missing condition at ${b.time}`);
}
function make({ skill = 1, rank = 10, elite = 2, level, potential = 1, trust = 0, support = false } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = [];
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(d.operators[ID]), skillId: `skchr_necras_${skill}`, skillRank: rank,
    elite, level: level ?? d.operators[ID].phases[elite].maxLevel, potential, trust };
  const b = new StandardBattle(d, support ? { operators: [defaultBuild(d.operators.char_124_kroos)], support: build }
    : { operators: [build] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.getPlayer('arkpedia').dp = 99; b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const hits = []; b.on('damaged', x => { if (x.source?.defId === ID || x.source?.defId === TOKEN) hits.push(x); });
  const cost = b.cost(ID), before = b.dp, u = b.deployOperator(ID, 5, 5, 'RIGHT'); near(before - b.dp, cost);
  return { b, u, build: b.bench[ID].build, hits, controller: u.mem.necrassController };
}
function enemy(b, { col = 6, hp = 1e7 } = {}) {
  const t = b.spawnEnemy('enemy_1007_slime', { pos: [5, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def: 0, res: 0, moveSpeed: 0 }); t.markDirty(); void t.s; t.hp = hp;
  b.addBuff(t, { key: 'qa:pin', flags: { noMove: true, disarm: true, unblockable: true } }); b._buildEnemyIndex(); return t;
}

test('public review binds source, all original files, automatic preload and exactly three skills', async () => {
  assert.deepEqual(REGULAR_OPERATORS[ID].skillIds, ['skchr_necras_1', 'skchr_necras_2', 'skchr_necras_3']);
  assert.ok(catalogueFor(data)[ID]);
  assert.deepEqual(regularTokenIdsFor([ID]), [TOKEN]);
  for (const [file, key] of [['prefabs', 'sourceFoundationSha256'], ['device-art', 'deviceArtworkSha256']])
    assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-necrass-${file}.json`, import.meta.url))).digest('hex'), review[key]);
  for (const [key, model] of Object.entries(review.originalArtwork)) assert.deepEqual(data.sd.models[key], model);
  assert.equal(review.frameParity, false); assert.equal(review.moduleSupport, false); assert.equal(review.nativeParticleSupport, false);
});

for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
  test(`public S${skill} rank ${rank} installs selected source, charges naturally and cleans up`, () => {
    const f = make({ skill, rank }), { b, u, controller: c } = f;
    b.addBuff(u, { key: 'qa:owner', flags: { disarm: true } }); enemy(b);
    assert.equal(c.record.index, skill - 1); assert.equal(c.record.build.skillRank, rank);
    assert.equal(u.skill.spTotal, u.skill.initSp);
    const before = b.dp, slots = b.deployedSlots();
    const dead = enemy(b, { col: 7, hp: 1 }); b.kill(dead, u);
    until(b, () => c.servants.all().length > 0, 1);
    const original = c.servants.all()[0]; assert.equal(original.deploymentSlotCost, 0);
    near(b.dp, Math.min(99, before + b.time)); assert.equal(b.deployedSlots(), slots);
    assert.equal(regularSummonCards(b).some(card => card.ownerId === ID), false);
    until(b, () => skillHud(u.skill).canActivate);
    assert.ok(b.activateOperator(ID)); assert.equal(u.skill.spTotal, 0);
    until(b, () => !u.skill.active, 30);
    if (skill === 1) {
      assert.equal(original.alive, false); assert.ok(c.servants.all().length > 0);
      assert.ok(f.hits.some(h => h.dmg.tags.includes('necrass:s1-passive')));
    } else assert.ok(f.hits.some(h => h.dmg.tags.includes(skill === 2 ? 'necrass:s2-link' : 'necrass:s3-volley')));
    if (skill === 3) {
      assert.equal(c.servants.dragon, original); assert.equal(original.s.flags.healFree, true);
      assert.ok(original.skill.spTotal > 0 || original.skill.active);
    }
    const servants = c.servants.all(); b.retreatOperator(ID);
    assert.equal(c.stopped, true); assert.deepEqual(c.handles, []);
    assert.ok(servants.every(t => !t.alive)); assert.equal(c.servants.pending.length, 0);
    advance(b, 2); assert.equal(c.servants.all().length, 0);
  });
}

for (const elite of [0, 1, 2]) for (const potential of [1, 6]) test(`public E${elite}/P${potential} keeps owner stats and servant caps distinct`, () => {
  const f = make({ elite, potential, trust: 200, rank: [4, 7, 10][elite], support: potential === 6 });
  const selected = selectedNecrassBuild({ ...f.build });
  assert.deepEqual(recordFor(f.build, data).stats, selected.stats);
  assert.equal(f.u.s.atk, selected.stats.atk); assert.equal(f.u.s.maxHp, selected.stats.maxHp);
  assert.equal(f.controller.servants.t1.max_token_cnt, f.build.elite === 0 ? 2 : 3);
  assert.equal(f.controller.servants.create(5, 6).s.atk, selected.tokenRecords[TOKEN].phase.attributesKeyFrames.at(-1).data.atk);
});

test('public placement and unavailable skills fail without spending DP or slots', () => {
  const { b, u } = make(); b.retreatOperator(ID); const dp = b.dp, slots = b.deployedSlots();
  b.setViewport('preview'); assert.throws(() => b.deployOperator(ID, 5, 6, 'RIGHT'));
  near(b.dp, dp); assert.equal(b.deployedSlots(), slots); assert.equal(b.activateOperator(ID), false);
  assert.equal(u.mem.necrassController.stopped, true);
});

for (const skill of [1, 2, 3]) test(`public S${skill} completes unchanged 0-1 waves and cleans up the factory`, () => {
  const build = { ...defaultBuild(data.operators[ID]), skillId: `skchr_necras_${skill}` };
  const b = new StandardBattle(data, { operators: [build] }); b.setViewport('fullscreen-workspace');
  const tiles = structuredClone(b.grid.tiles), hits = []; b.on('damaged', x => { if (x.source?.defId === ID) hits.push(x); });
  let deployed = false, cast = false, born = 0; b.on('deploy', x => { if (x.unit.defId === TOKEN) born++; });
  for (let n = 0; n < 9001 && !b.finished; n++) {
    if (!deployed && b.dp >= b.cost(ID)) { b.deployOperator(ID, 4, 6, 'DOWN'); deployed = true; }
    const u = b.bench[ID].unit;
    if (!cast && u && skillHud(u.skill).canActivate) cast = b.activateOperator(ID);
    b.step();
  }
  const result = b.result(); assert.equal(result.reason, 'cleared'); assert.equal(result.total, 11);
  const leaks = result.perPlayer.arkpedia.leaked.filter(x => x.counted).length;
  assert.equal(result.killed + leaks, 11); assert.equal(b.life, data.stage.battle.max_life - leaks);
  assert.ok(hits.length > 0); assert.ok(born > 0); assert.ok(cast);
  assert.deepEqual(b.grid.tiles, tiles); assert.deepEqual(b.errors, []);
  const c = b.bench[ID].unit.mem.necrassController; assert.equal(c.stopped, true); assert.equal(c.servants.all().length, 0);
});
