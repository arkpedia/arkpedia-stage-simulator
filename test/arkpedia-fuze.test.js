// SPDX-License-Identifier: GPL-3.0-or-later
// Public selected builds, original stage geometry and deployment transactions.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-fuze-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { FUZE_ID, fuzeClusterGeometry } from '../server/sim/content/arkpedia-fuze.js';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
const flat = rows => Object.fromEntries(rows.map(v => [v.key, v.value]));
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make({ skill = 1, rank = 10, elite = 2, level, potential = 1, trust = 0, deploy = true } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const op = d.operators[FUZE_ID], build = { ...defaultBuild(op), elite,
    level: level ?? op.phases[elite].maxLevel, potential, trust,
    skillId: `skchr_fuze_${skill}`, skillRank: rank };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const placement = (() => {
    for (let r = 0; r < b.regularMapSize.rows; r++) for (let c = 0; c < b.regularMapSize.cols; c++)
      for (const dir of ['RIGHT', 'UP', 'LEFT', 'DOWN'])
        if (!b.placementError(FUZE_ID, r, c) && fuzeClusterGeometry(b, { tileR: r, tileC: c, dir }))
          return { r, c, dir };
    assert.fail('Original 0-1 map has no Cluster Charge placement');
  })();
  const u = deploy ? b.deployOperator(FUZE_ID, placement.r, placement.c, placement.dir) : null;
  return { b, u, build, placement, controller: u?.mem.fuzeController };
}
function enemy(f, destination) {
  const e = f.b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.x = destination.x; e.y = destination.y;
  Object.assign(e.base, { maxHp: 1e7, atk: 0, def: 0, res: 0, moveSpeed: 0 });
  e.markDirty(); e.hp = 1e7;
  f.b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  f.b._buildEnemyIndex(); return e;
}

test('public Fuze retains both skills at every rank, entrance gate and original facing art', () => {
  for (const facing of ['front', 'back']) assert.ok(data.sd.models[`operator/${FUZE_ID}/default/${facing}`]);
  for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), s = evidence.tables.skills[f.build.skillId].levels[rank - 1];
    assert.deepEqual(f.u.def.skill.bb, flat(s.blackboard));
    near(f.u.skill.spCost, s.spData.spCost); near(f.u.skill.spTotal, s.spData.initSp);
    assert.equal(f.u.skill.manual, true); assert.equal(f.u.skill.noSkill, false);
    assert.equal(f.u.skill.kind, skill === 1 ? 'ammo' : 'toggle');
    f.u.skill.setSpTotal(f.u.skill.spCost);
    assert.equal(f.b.activateOperator(FUZE_ID), false);
    advance(f.b, 1.1); assert.equal(f.b.activateOperator(FUZE_ID), true);
    if (skill === 1) assert.equal(f.u.skill.ammoLeft, 100);
    else assert.equal(f.u.skill.remainingUses, 2);
  }
});

test('public promotion, trust, potential and low level stats stay source-fed without duplicate talent modifiers', () => {
  const c = evidence.tables.character;
  for (const elite of [0, 1, 2]) for (const potential of [1, 3, 5, 6]) for (const trust of [0, 100, 200]) {
    const f = make({ elite, rank: [4, 7, 10][elite], potential, trust });
    const s = c.phases[elite].attributesKeyFrames.at(-1).data;
    near(f.u.s.atk, s.atk + (trust ? 40 : 0)); near(f.u.s.def, s.def + (trust ? 40 : 0));
    near(f.u.s.maxHp, s.maxHp); near(f.u.s.aspd, s.attackSpeed);
    near(f.u.s.blockCnt, s.blockCnt);
    near(f.b.bench[FUZE_ID].lastCost, s.cost - [2, 4, 6].filter(p => potential >= p).length);
    near(f.u.base.respawnTime, s.respawnTime - (potential >= 3 ? 10 : 0));
    assert.equal(f.u.def.raw.arkpedia.critical, undefined);
    near(f.controller.record.talent?.blackboard[0].value ?? 0,
      elite ? (elite === 1 ? .17 : .27) + (potential >= 5 ? .03 : 0) : 0);
  }
  const f = make({ elite: 1, level: 1, rank: 7, skill: 2 });
  near(f.u.s.atk, c.phases[1].attributesKeyFrames[0].data.atk);
  for (const build of [{ ...f.build, elite: 0, skillRank: 4 }, { ...f.build, skillRank: 10 },
    { ...f.build, level: 81 }, { ...f.build, module: { id: 'unreviewed', stage: 3 } }])
    assert.throws(() => recordFor(build, data));
});

test('public deployment preserves fullscreen, facing, occupied-tile, cost and slot transactions', () => {
  const f = make({ deploy: false }), { r, c, dir } = f.placement;
  const dp = f.b.dp, slots = f.b.deployedSlots();
  f.b.setViewport('preview'); assert.throws(() => f.b.deployOperator(FUZE_ID, r, c, dir), /fullscreen/);
  f.b.setViewport('fullscreen-workspace'); assert.throws(() => f.b.deployOperator(FUZE_ID, r, c, 'invalid'), /facing/);
  near(f.b.dp, dp); assert.equal(f.b.deployedSlots(), slots);
  const cost = f.b.cost(FUZE_ID), u = f.b.deployOperator(FUZE_ID, r, c, dir);
  near(f.b.dp, dp - cost); assert.equal(f.b.deployedSlots(), slots + 1);
  assert.equal(u.mem.fuzeController.u, u); assert.equal(u.dir, dir);
  assert.throws(() => f.b.deployOperator(FUZE_ID, r, c, dir), /unavailable/);
  near(f.b.dp, dp - cost); assert.equal(f.b.deployedSlots(), slots + 1);
});

test('public S1 produces accepted multi-target output, spends one round and restores ordinary stats on manual finish', () => {
  const f = make(), center = fuzeClusterGeometry(f.b, f.u).center;
  // Blocked enemies remain valid even where the original front tile is high ground.
  const victims = Array.from({ length: 4 }, () => enemy(f, center));
  for (const e of victims) e.blockedBy = f.u;
  advance(f.b, 1.1); const atk = f.u.s.atk;
  f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.b.activateOperator(FUZE_ID), true);
  const hits = []; f.b.on('damaged', ctx => { if (ctx.source === f.u) hits.push(ctx); });
  advance(f.b, .6); assert.equal(hits.length, 3); assert.equal(f.u.skill.ammoLeft, 99);
  for (const h of hits) near(h.amount, atk * 1.3);
  assert.equal(skillHud(f.u.skill).canCancel, true);
  assert.equal(f.b.activateOperator(FUZE_ID), true);
  near(f.u.s.atk, atk); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1_End');
  assert.ok(f.u.s.flags.noSp); advance(f.b, 1.5); assert.equal(!!f.u.s.flags.noSp, false);
});

test('public S2 original-map geometry gives five delayed outputs, three uses and exhaustion feedback', () => {
  const f = make({ skill: 2 }), geometry = fuzeClusterGeometry(f.b, f.u);
  assert.ok(geometry); const e = enemy(f, geometry.center);
  advance(f.b, 1.1);
  const births = [], stops = [];
  f.b.on('fuzeGrenadeBirth', ctx => births.push(ctx)); f.b.on('fuzeGrenadeStop', ctx => stops.push(ctx));
  for (let use = 1; use <= 3; use++) {
    f.u.skill.setSpTotal(f.u.skill.spCost); const hp = e.hp;
    assert.equal(f.b.activateOperator(FUZE_ID), true); assert.equal(f.u.skill.remainingUses, 3 - use);
    assert.equal(skillHud(f.u.skill).canCancel, false);
    advance(f.b, 5.5);
    assert.equal(births.length, use * 5); assert.equal(stops.length, use * 5);
    const overlapping = geometry.destinations.filter(p => Math.hypot(p.x - e.x, p.y - e.y) <= 1.2).length;
    assert.ok(overlapping > 0); near(hp - e.hp, f.u.s.atk * 4.8 * overlapping);
  }
  f.u.skill.setSpTotal(f.u.skill.spCost);
  assert.equal(f.u.skill.ready, false); assert.equal(f.b.activateOperator(FUZE_ID), false);
  assert.equal(skillHud(f.u.skill).text, 'No skill uses remaining');
  assert.equal(f.controller.born.size, 0);
});

test('public illegal S2 facing preserves full SP and uses; retreat resets only the redeployed controller', () => {
  const f = make({ skill: 2 }); advance(f.b, 1.1);
  const original = f.u.dir;
  f.u.dir = ['RIGHT', 'UP', 'LEFT', 'DOWN'].find(dir => !fuzeClusterGeometry(f.b, { ...f.u, dir }));
  assert.ok(f.u.dir); f.u.skill.setSpTotal(f.u.skill.spCost);
  assert.equal(f.b.activateOperator(FUZE_ID), false); assert.equal(f.controller.uses, 0);
  near(f.u.skill.spTotal, f.u.skill.spCost); assert.equal(skillHud(f.u.skill).canActivate, false);
  f.u.dir = original; assert.equal(f.b.activateOperator(FUZE_ID), true);
  advance(f.b, 1.8); assert.equal(f.controller.born.size, 2);
  const old = f.controller; f.b.retreatOperator(FUZE_ID); assert.equal(f.u.deployed, false);
  assert.equal(old.stopped, true); advance(f.b, 5);
  assert.equal(old.born.size, 0); assert.equal(old.finishHook, null);
  const entry = f.b.bench[FUZE_ID]; advance(f.b, entry.readyAt - f.b.time + .1); f.b.addDp('arkpedia', 99);
  const u = f.b.deployOperator(FUZE_ID, f.placement.r, f.placement.c, original);
  assert.notEqual(u.mem.fuzeController, old); assert.equal(u.mem.fuzeController.uses, 0);
  assert.equal(u.skill.remainingUses, 3); assert.equal(old.uses, 1);
});
