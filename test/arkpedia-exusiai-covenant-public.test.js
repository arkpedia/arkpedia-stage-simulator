// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-exusiai-covenant-prefabs.json' with { type: 'json' };
import review from '../data/arkpedia-exusiai-covenant-runtime-review.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, catalogueFor, recordFor } from '../shared/arkpedia/loadout.js';
import { regularSummonCards, selectedRegularSummon, deployRegularSummon, retreatRegularSummon,
  summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { selectedExusiaiCovenantBuild } from '../server/sim/content/arkpedia-exusiai-covenant.js';

const ID = 'char_1041_angel2', ALLY = 'char_289_gyuki', CARD = 'summon:' + ID;
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(b, condition, seconds = 90) {
  const end = b.time + seconds;
  while (!condition() && b.time < end) b.step();
  assert.ok(condition(), `Condition not reached at ${b.time}`); assert.deepEqual(b.errors, []);
}
function make({ skill = 1, rank = 10, elite = 2, potential = 1, trust = 0, support = false } = {}) {
  const d = structuredClone(data);
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(d.operators[ID]), elite, level: d.operators[ID].phases[elite].maxLevel,
    potential, trust, skillId: `skchr_angel2_${skill}`, skillRank: rank };
  const ally = defaultBuild(d.operators[ALLY]);
  const b = new StandardBattle(d, support ? { operators: [ally], support: { ...build, elite: 2, level: 90, potential: 6, trust: 200 } }
    : { operators: [build, ally] });
  b.autoFinish = false; b.recordEvents = true; b.rng = () => .99;
  b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp = 999;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  return { b, build: b.bench[ID].build };
}
function enemy(b) {
  const t = b.spawnEnemy('enemy_1007_slime', { pos: [5, 6] });
  Object.assign(t.base, { maxHp: 1e7, atk: 0, def: 0, res: 0, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = 1e7;
  b.addBuff(t, { key: 'qa:pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return t;
}

test('public approval binds the unchanged native foundation and marker artwork separately', async () => {
  const bytes = await readFile(new URL('../data/arkpedia-exusiai-covenant-prefabs.json', import.meta.url));
  const art = await readFile(new URL('../data/arkpedia-exusiai-covenant-coordinates-art.json', import.meta.url));
  assert.equal(review.sourceFoundationSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(review.coordinateArtworkSha256, createHash('sha256').update(art).digest('hex'));
  assert.deepEqual(review.enabledOperators, [ID]); assert.deepEqual(evidence.enabledOperators, []);
  assert.deepEqual(evidence.heldOperators, [ID]); assert.equal(review.frameParity, false);
  assert.equal(evidence.source.commit, data.sources[evidence.source.repository]);
  assert.deepEqual(data.operators[ID].factionTags, ['lungmen', 'penguin', 'laterano']);
  const catalogue = catalogueFor(data)[ID];
  assert.deepEqual(catalogue.skills.map(s => s.id), [1, 2, 3].map(n => `skchr_angel2_${n}`));
  assert.deepEqual(catalogue.modules, []);
  for (const change of [{ elite: 0, level: 1, skillId: 'skchr_angel2_2', skillRank: 1 },
    { elite: 1, level: 1, skillId: 'skchr_angel2_3', skillRank: 1 }, { module: 'x' }])
    assert.throws(() => recordFor({ ...defaultBuild(data.operators[ID]), ...change }, data));
  for (const facing of ['front', 'back']) {
    const m = data.sd.models[`operator/token_10056_angel2_target/default/${facing}`];
    assert.equal(m.source.facingAlias, 'single-original-model');
    assert.equal(m.animationRoles.attack, null); assert.equal(m.animationRoles.die, 'Die');
  }
});

for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++)
  test(`public Covenant S${skill} rank ${rank}: source build, natural SP, output and withdrawal`, () => {
    const { b, build } = make({ skill, rank }), r = selectedExusiaiCovenantBuild(build);
    const ally = b.deployOperator(ALLY, 5, 6, 'RIGHT');
    const dp = b.dp, cost = b.cost(ID), u = b.deployOperator(ID, 5, 5, 'RIGHT');
    const c = u.mem.exusiaiCovenantController, hits = [];
    near(b.dp, dp - cost); near(u.base.atk, r.stats.atk); near(u.skill.sp, r.source.spData.initSp);
    assert.equal(c.record.index, skill - 1); assert.ok(u.def.tags.includes('laterano'));
    b.on('damaged', ctx => { if (ctx.dmg?.tags?.some(t => t.startsWith('angel2:'))) hits.push(ctx); }); enemy(b);
    if (skill === 1) until(b, () => u.skill.active);
    else { until(b, () => u.skill.ready); assert.equal(b.activateOperator(ID), true); }
    const tag = skill === 1 ? 'angel2:s1-normal' : skill === 2 ? 'angel2:s2' : 'angel2:s3';
    until(b, () => hits.some(h => h.dmg.tags.includes(tag)));
    if (skill === 2) { assert.equal(c.s2.loan.target, ally); assert.ok(ally.findBuff('angel2:s2-shield')); }
    assert.equal(regularSummonCards(b).length, skill === 3 ? 1 : 0);
    assert.ok(u.skill.ammoLeft < u.skill.ammoMax); assert.equal(c.valid(), true);
    b.retreatOperator(ID); assert.equal(c.stopped, true); assert.equal(c.handles.length, 0);
    if (skill === 3) assert.equal(regularSummonCards(b)[0].stock, 0);
    b._finish('victory'); assert.deepEqual(b.errors, []);
  });

for (const elite of [0, 1, 2]) test(`public Covenant E${elite}: selected promotion, potential and trust`, () => {
  const { b, build } = make({ elite, rank: 1, potential: 6, trust: 200 });
  const r = selectedExusiaiCovenantBuild(build), u = b.deployOperator(ID, 5, 5, 'RIGHT');
  for (const k of ['atk', 'def', 'maxHp', 'cost']) near(u.base[k], r.stats[k]);
  near(u.base.res, r.stats.magicResistance);
  // Firepower FM unlocks at E0; its probability increases on the first promotion.
  near(u.mem.exusiaiCovenantController.record.ammoTalent.prob, elite === 0 ? .2 : .25);
  assert.equal(u.mem.exusiaiCovenantController.record.auraTalent.atk > 0, elite === 2); b._finish('victory');
});

for (const skill of [1, 2, 3]) test(`public Covenant S${skill}: native silence permission and control rejection`, () => {
  const { b } = make({ skill }), u = b.deployOperator(ID, 5, 5, 'RIGHT');
  b.addBuff(u, { key: 'qa:silence', flags: { silence: true } });
  assert.equal(u.skill.silenceBlocked, false);
  if (skill === 1) until(b, () => u.skill.active);
  else { until(b, () => u.skill.ready); assert.equal(b.activateOperator(ID), true); }
  advance(b, 2); assert.equal(u.skill.active, true);
  b.addBuff(u, { key: 'qa:stun', flags: { stun: true } });
  const ammo = u.skill.ammoLeft; assert.equal(b.activateOperator(ID), false); near(u.skill.ammoLeft, ammo);
  b.removeBuff(u, 'qa:stun'); assert.equal(b.activateOperator(ID), true);
  if (skill === 1) { assert.ok(u.mem.exusiaiCovenantController.s1.burst); advance(b, 2); }
  assert.equal(u.skill.active, false); b._finish('victory');
});

for (const dir of ['RIGHT', 'DOWN', 'LEFT', 'UP']) test(`public Coordinates ${dir}: real deck, delivery and fresh owner`, () => {
  const { b } = make({ skill: 3 }); advance(b, 5);
  const u = b.deployOperator(ID, 5, 5, 'RIGHT'), old = u.mem.exusiaiCovenantController;
  const card = regularSummonCards(b)[0]; assert.equal(card.key, CARD); assert.equal(card.stock, 1);
  assert.equal(card.cost, 0); assert.equal(card.config.chooseFacing, true);
  assert.equal(summonPlacementError(b, CARD, 5, 6), null);
  const marker = deployRegularSummon(b, CARD, 5, 6, dir), dp = b.dp;
  assert.equal(marker.dir, dir); assert.equal(marker.mem.regularHideHp, true);
  assert.equal(selectedRegularSummon(b, `token:${marker.id}`).unit, marker); assert.equal(regularSummonCards(b)[0].stock, 0);
  const delivered = []; b.on('exusiaiCovenantDelivery', ctx => delivered.push({ unit: ctx.unit, sp: ctx.unit.skill.sp }));
  until(b, () => u.skill.ready); assert.equal(b.activateOperator(ID), true);
  until(b, () => delivered.length === 1); const ally = delivered[0].unit;
  assert.equal(ally.defId, ALLY); assert.equal(ally.dir, dir); assert.equal(ally.tileR, 5); assert.equal(ally.tileC, 6);
  // The delivery adds six SP to the selected ally skill's initial SP.
  near(delivered[0].sp, ally.skill.initSp + 6); near(b.dp, dp); assert.equal(marker.alive, false);
  assert.ok(summonPlacementError(b, CARD, 5, 7));
  b.retreatOperator(ID); assert.equal(regularSummonCards(b)[0].stock, 0);
  advance(b, 75); b.getPlayer('arkpedia').dp = 999;
  const next = b.deployOperator(ID, 5, 5, 'UP');
  assert.notEqual(next.mem.exusiaiCovenantController, old);
  assert.notEqual(regularSummonCards(b)[0].owner, u); assert.equal(regularSummonCards(b)[0].stock, 1);
  const nextMarker = deployRegularSummon(b, CARD, 5, 4, 'RIGHT');
  retreatRegularSummon(b, `token:${nextMarker.id}`);
  assert.equal(regularSummonCards(b)[0].stock, 1); assert.equal(regularSummonCards(b)[0].readyAt, b.time + 70);
  b._finish('victory'); assert.equal(regularSummonCards(b)[0].stock, 0);
});

test('maxed Covenant support and rejected public commands preserve resources', () => {
  const { b, build } = make({ skill: 3, support: true }), dp = b.dp, r = selectedExusiaiCovenantBuild(build);
  b.setViewport('preview'); assert.throws(() => b.deployOperator(ID, 5, 5, 'RIGHT')); near(b.dp, dp);
  b.setViewport('fullscreen-workspace'); assert.throws(() => b.deployOperator(ID, 5, 5, 'BAD')); near(b.dp, dp);
  const u = b.deployOperator(ID, 5, 5, 'RIGHT'); near(u.base.atk, r.stats.atk);
  const sp = u.skill.sp; assert.equal(b.activateOperator(ID), false); near(u.skill.sp, sp); b._finish('victory');
});
