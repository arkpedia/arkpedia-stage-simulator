// SPDX-License-Identifier: GPL-3.0-or-later
// Public selected builds, source art, deployment and complete skill paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-narant-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { NARANT_ID } from '../server/sim/content/arkpedia-narant-projectiles.js';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
const until = (f, predicate, seconds = 6) => {
  const limit = f.b.time + seconds;
  while (!predicate() && f.b.time < limit) advance(f.b, f.b.dt);
  assert.ok(predicate());
};
function make({ skill = 1, rank = 10, elite = 2, level, potential = 1, trust = 0, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const op = d.operators[NARANT_ID], build = { ...defaultBuild(op), elite,
    level: level ?? op.phases[elite].maxLevel, potential, trust,
    skillId: `skchr_narant_${skill}`, skillRank: rank };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const deploy = () => { b.addDp('arkpedia', 99); return b.deployOperator(NARANT_ID, 1, 4, dir); };
  const u = deploy(); assert.ok(u);
  const hits = [], attacks = [];
  b.on('damaged', ctx => hits.push({ ...ctx, time: b.time }));
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  return { b, u, build, deploy, hits, attacks, controller: u.mem.narantController };
}
function enemy(f, { x = 5, y = 1, fly = false } = {}) {
  const e = f.b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] }); e.x = x; e.y = y;
  Object.assign(e.base, { maxHp: 1e7, atk: 1000, def: 0, res: 0, moveSpeed: 0 });
  if (fly) e.motion = 'FLY'; e.markDirty(); void e.s; e.hp = 1e7;
  f.b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } }); f.b._buildEnemyIndex(); return e;
}
const ready = f => advance(f.b, 1.1);
const cast = f => {
  f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.b.activateOperator(NARANT_ID), true);
};

test('public catalogue retains pinned ordinary source data, all source skills and both original models', () => {
  const op = data.operators[NARANT_ID], c = evidence.tables.character;
  assert.equal(op.name, 'Narantuya'); assert.equal(op.skills.length, 3);
  assert.equal(op.subProfessionId, 'loopshooter');
  for (const [elite, p] of op.phases.entries()) {
    assert.deepEqual(p.attributesKeyFrames, c.phases[elite].attributesKeyFrames);
    assert.deepEqual(p.rangeGrid, evidence.tables.ranges[c.phases[elite].rangeId].grids.map(p => [p.row, p.col]));
  }
  for (const s of op.skills) assert.deepEqual(s.levels, evidence.tables.skills[s.id].levels);
  for (const face of ['front', 'back']) {
    const m = data.sd.models[`operator/${NARANT_ID}/default/${face}`];
    assert.ok(m.animationRoles.idle); assert.ok(m.animationRoles.attack);
    assert.equal(typeof m.premultipliedAlpha, 'boolean'); assert.equal(Object.keys(m.animationRoles.skills).length, 3);
  }
});

test('all thirty public ranks use source SP, durations, original clips and their complete combat path', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), s = evidence.tables.skills[`skchr_narant_${skill}`].levels[rank - 1];
    assert.deepEqual(f.u.def.skill.bb, Object.fromEntries(s.blackboard.map(p => [p.key, p.value])));
    near(f.u.skill.spCost, s.spData.spCost); near(f.u.skill.spTotal, s.spData.initSp);
    assert.equal(f.u.skill.duration, s.duration); assert.equal(f.u.skill.manual, true);
    assert.equal(f.u.skill.kind, skill === 1 ? 'instant' : 'duration');
    assert.equal(f.b.activateOperator(NARANT_ID), false); ready(f); cast(f);
    const e = enemy(f); until(f, () => f.attacks.length === 1);
    assert.equal(f.controller.links.flight.mode, skill); assert.equal(f.u.stats.attacks, 1);
    assert.equal(f.u.mem.regularFormVisual.clip, skill === 1 ? 'Skill_1' : `Skill_${skill}_Loop`);
    advance(f.b, .7); assert.ok(f.hits.some(h => h.target === e && h.dmg.tags.includes(`narant:s${skill}`)));
    if (skill === 2) assert.ok(f.hits.some(h => h.dmg.tags.includes('narant:s2-return')));
    if (skill === 3) assert.ok(f.hits.some(h => h.dmg.tags.includes('narant:s3-return')));
    assert.equal(skillHud(f.u.skill).canCancel, false);
    if (skill !== 1) near(f.u.skill.spTotal, 0);
  }
});

test('public promotions, level, trust and potentials preserve source stats without premature theft', () => {
  for (const elite of [0, 1, 2]) for (const potential of [1, 3, 5, 6]) for (const trust of [0, 100, 200]) {
    const f = make({ elite, skill: elite + 1, rank: [4, 7, 10][elite], potential, trust });
    const source = evidence.tables.character.phases[elite].attributesKeyFrames.at(-1).data;
    const trustAtk = trust ? evidence.tables.character.favorKeyFrames.at(-1).data.atk : 0;
    // Source potential 4 adds 27 ATK. Neither conditional theft nor aura hit-rate
    // is allowed to become a generic permanent ATK/DEF or combined Dodge buff.
    near(f.u.s.atk, source.atk + trustAtk + (potential >= 4 ? 27 : 0));
    near(f.u.s.def, source.def); assert.deepEqual(f.controller.talents.gains, { atk: 0, def: 0 });
    assert.equal(!!f.controller.talents.steal, elite > 0); assert.equal(!!f.controller.talents.evade, elite === 2);
    if (elite === 2) near(f.u.s.dodgePhys, potential >= 3 ? .38 : .35);
    else near(f.u.s.dodgePhys, 0);
  }
  const low = make({ elite: 1, level: 1, skill: 2, rank: 7 });
  near(low.u.s.atk, evidence.tables.character.phases[1].attributesKeyFrames[0].data.atk);
  for (const build of [
    { ...low.build, skillId: 'skchr_narant_3' }, { ...low.build, elite: 0, skillRank: 7 },
    { ...low.build, skillRank: 10 }, { ...low.build, level: 81 },
    { ...low.build, module: { id: 'unreviewed', stage: 3 } },
  ]) assert.throws(() => recordFor(build, data));
});

test('public S1 manual commands switch both directions while the gauge charges the next command', () => {
  const f = make(); ready(f); cast(f);
  assert.equal(f.controller.mode, 1); assert.equal(f.u.skill.active, false);
  assert.equal(f.u.rangeGrid.length, f.controller.baseRange.length - 3);
  assert.match(skillHud(f.u.skill).text, /0 \/ 5 SP/);
  advance(f.b, 5.1); assert.equal(skillHud(f.u.skill).canActivate, true);
  assert.equal(f.b.activateOperator(NARANT_ID), true); assert.equal(f.controller.mode, 0);
  assert.deepEqual(f.u.rangeGrid, f.controller.baseRange);
});

test('actual withdrawal/redeployment owns a fresh controller, SP, source entrance and zero talent accumulation', () => {
  const f = make({ skill: 2 }); ready(f); enemy(f);
  until(f, () => f.hits.length === 1); const old = f.controller;
  assert.ok(old.talents.gains.atk > 0); f.b.retreatOperator(NARANT_ID);
  assert.equal(old.stopped, true); advance(f.b, 81);
  const u = f.deploy(), fresh = u.mem.narantController;
  assert.notEqual(fresh, old); assert.equal(fresh.phase.kind, 'entrance');
  assert.deepEqual(fresh.talents.gains, { atk: 0, def: 0 }); near(u.skill.spTotal, u.def.skill.initSp);
  assert.equal(u.mem.regularFormVisual.clip, 'Start'); assert.equal(f.b.activateOperator(NARANT_ID), false);
  advance(f.b, 1.1); assert.equal(fresh.stopped, false);
});

test('portrait/planner mode cannot accept public deployment or skill commands', () => {
  const f = make({ skill: 3 }); ready(f); f.u.skill.setSpTotal(f.u.skill.spCost);
  f.b.setViewport('planner'); assert.equal(f.b.activateOperator(NARANT_ID), false);
  assert.equal(f.u.skill.activations, 0);
});
