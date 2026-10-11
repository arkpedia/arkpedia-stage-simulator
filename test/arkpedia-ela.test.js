// SPDX-License-Identifier: GPL-3.0-or-later
// Public builds and deployment transactions, beyond private controller fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-ela-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { summonRecordFor, summonCardId, regularTokenIdsFor } from '../shared/arkpedia/summons.js';
import { deployRegularSummon, regularSummonCards, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { ELA_ID, ELA_MINE, ELA_INFLUENCE } from '../server/sim/content/arkpedia-ela-mines.js';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
const flat = rows => Object.fromEntries(rows.map(p => [p.key, p.value]));
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function make({ skill = 1, rank = 10, elite = 2, level, potential = 1, trust = 0 } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const op = d.operators[ELA_ID], build = { ...defaultBuild(op), elite,
    level: level ?? op.phases[elite].maxLevel, potential, trust,
    skillId: `skchr_ela_${skill}`, skillRank: rank };
  const b = new StandardBattle(d, { operators: [build] }); b.autoFinish = false;
  b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const u = b.deployOperator(ELA_ID, 1, 4, 'RIGHT'); assert.ok(u);
  return { b, u, build, controller: u.mem.elaController, deck: u.mem.elaController.deck };
}
function enemy(f, { x = 5, y = 1 } = {}) {
  const e = f.b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] }); e.x = x; e.y = y;
  Object.assign(e.base, { maxHp: 1e7, atk: 500, def: 0, res: 0, moveSpeed: 0 });
  e.markDirty(); e.hp = 1e7;
  f.b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  f.b._buildEnemyIndex(); return e;
}
function freeGround(f) {
  for (let r = 0; r < f.b.regularMapSize.rows; r++) for (let c = 0; c < f.b.regularMapSize.cols; c++)
    if (!summonPlacementError(f.b, summonCardId(ELA_ID), r, c)) return [r, c];
  assert.fail('No free ground tile');
}

test('public Ela retains all thirty ranks, independent mine source and original base art', () => {
  assert.deepEqual(regularTokenIdsFor([ELA_ID]), [ELA_MINE]);
  for (const id of [ELA_ID, ELA_MINE]) for (const facing of ['front', 'back'])
    assert.ok(data.sd.models[`operator/${id}/default/${facing}`]);
  for (let skill = 1; skill <= 3; skill++) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), selected = evidence.tables.skills[f.build.skillId].levels[rank - 1];
    assert.deepEqual(f.u.def.skill.bb, flat(selected.blackboard));
    near(f.u.skill.spCost, selected.spData.spCost); near(f.u.skill.spTotal, selected.spData.initSp);
    assert.equal(f.u.skill.manual, skill !== 1); assert.equal(f.u.skill.kind, ['instant', 'duration', 'ammo'][skill - 1]);
    assert.equal(f.b.activateOperator(ELA_ID), false); // Entrance gate/initial SP.
    const r = summonRecordFor(ELA_ID, f.build, data.tokens);
    assert.deepEqual(r.skill.bb, f.deck.record.skill.bb); assert.deepEqual(r.stats, f.deck.record.stats);
    assert.deepEqual(r.arkpedia, f.deck.record.arkpedia); // Required by mine selection/details.
    const card = regularSummonCards(f.b).find(c => c.ownerId === ELA_ID);
    assert.equal(card.stock, 3); assert.equal(card.cost, 5); assert.equal(card.deployed, 0);
    assert.equal(card.record.id, ELA_MINE); assert.equal(card.config.chooseFacing, false);
  }
});

test('public owner stat bonuses never transfer to mines or duplicate conditional Bullseye', () => {
  for (const elite of [0, 1, 2]) for (const potential of [1, 3, 5, 6]) for (const trust of [0, 100, 200]) {
    const f = make({ elite, skill: elite + 1, rank: [4, 7, 10][elite], potential, trust });
    const stats = evidence.tables.character.phases[elite].attributesKeyFrames.at(-1).data;
    near(f.u.s.atk, stats.atk + (trust ? evidence.tables.character.favorKeyFrames.at(-1).data.atk : 0)
      + (potential >= 4 ? 27 : 0));
    near(f.u.s.def, stats.def); assert.equal(f.u.def.raw.arkpedia.critical, undefined);
    assert.equal(f.deck.state.stock, elite + 1 + Number(potential >= 3));
    assert.equal(f.deck.record.stats.atk, 100); assert.equal(f.deck.record.stats.maxHp, 1000);
    assert.equal(f.controller.critical?.atk_scale ?? 1, elite === 2 ? potential >= 5 ? 1.6 : 1.5 : 1);
  }
  const low = make({ elite: 1, level: 1, skill: 2, rank: 7 });
  near(low.u.s.atk, evidence.tables.character.phases[1].attributesKeyFrames[0].data.atk);
  for (const build of [{ ...low.build, skillId: 'skchr_ela_3' }, { ...low.build, skillRank: 10 },
    { ...low.build, level: 81 }, { ...low.build, module: { id: 'unreviewed', stage: 3 } }])
    assert.throws(() => recordFor(build, data));
});

test('public mine placement charges exactly once, shares fullscreen/occupancy gates and consumes no slot', () => {
  const f = make({ skill: 2 }), key = summonCardId(ELA_ID), [r, c] = freeGround(f);
  f.b.setViewport('preview'); assert.throws(() => deployRegularSummon(f.b, key, r, c), /fullscreen/);
  f.b.setViewport('fullscreen-workspace');
  const slots = f.b.deployedSlots(), dp = f.b.dp, stock = f.deck.state.stock;
  const t = deployRegularSummon(f.b, key, r, c, 'LEFT');
  assert.equal(t.dir, 'RIGHT'); assert.equal(t.kind, 'device'); assert.equal(f.b.deployedSlots(), slots);
  near(f.b.dp, dp - 5); assert.equal(f.deck.state.stock, stock - 1);
  near(f.deck.state.readyAt, f.b.time + 5); assert.equal(t.defId, ELA_MINE);
  assert.ok(t.s.flags.invulnerable && t.s.flags.untargetable && t.s.flags.healFree);
  assert.throws(() => deployRegularSummon(f.b, key, r, c), /redeploying|occupied/);
  advance(f.b, 5.1); assert.throws(() => deployRegularSummon(f.b, key, r, c), /occupied/);
  const [r2, c2] = freeGround(f), e = enemy(f, { x: c2, y: r2 });
  assert.throws(() => deployRegularSummon(f.b, key, r2, c2), /ground enemy/);
  assert.equal(t.stats.attacks, 0); assert.equal(e.findBuff(ELA_INFLUENCE), null);
});

test('public S1 automatically replenishes mines, stops at full stock and resumes after a paid placement', () => {
  const f = make({ skill: 1 }); advance(f.b, 1.1);
  f.u.skill.setSpTotal(f.u.skill.spCost); advance(f.b, .1);
  assert.equal(f.deck.state.stock, 4); assert.ok(f.u.s.flags.noSp);
  const sp = f.u.skill.spTotal; advance(f.b, 2); near(f.u.skill.spTotal, sp);
  const [r, c] = freeGround(f); deployRegularSummon(f.b, summonCardId(ELA_ID), r, c);
  assert.equal(f.deck.state.stock, 3); assert.equal(!!f.u.s.flags.noSp, false);
  advance(f.b, 1); assert.ok(f.u.skill.spTotal > sp);
});

test('public manual skill controls use attack SP, timed S2, and cancellable forty-round S3', () => {
  for (const skill of [2, 3]) {
    const f = make({ skill }), e = enemy(f); advance(f.b, 1.1);
    f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(skillHud(f.u.skill).canActivate, true);
    assert.equal(f.b.activateOperator(ELA_ID), true); advance(f.b, 2);
    assert.ok(e.hp < 1e7); assert.ok(f.u.stats.attacks > 0);
    if (skill === 2) { assert.equal(skillHud(f.u.skill).canCancel, false); near(f.u.s.def, f.u.base.def * 4); }
    else {
      assert.equal(f.u.skill.ammoMax, 40); assert.equal(f.u.skill.ammoLeft, 40 - f.u.stats.attacks);
      assert.equal(skillHud(f.u.skill).canCancel, true);
      assert.equal(f.b.activateOperator(ELA_ID), true); assert.equal(f.u.skill.active, false);
      assert.equal(f.deck.state.stock, 4);
    }
  }
});

test('public retreat clears mines, emits one old-position burst and gives a fresh redeployment its own inventory', () => {
  const f = make({ skill: 3 }), key = summonCardId(ELA_ID), [r, c] = freeGround(f);
  const t = deployRegularSummon(f.b, key, r, c), e = enemy(f); f.b.retreatOperator(ELA_ID);
  assert.equal(t.alive, false); assert.equal(f.deck.closed, true);
  assert.equal(e.findBuff(ELA_INFLUENCE), null); advance(f.b, .2);
  assert.equal(e.findBuff(ELA_INFLUENCE).source, f.u); assert.equal(e.hp, 1e7);
  f.b.bench[ELA_ID].readyAt = f.b.time; f.b.addDp('arkpedia', 99);
  const fresh = f.b.deployOperator(ELA_ID, 1, 4, 'RIGHT'); assert.notEqual(fresh, f.u);
  const card = regularSummonCards(f.b).find(c => c.ownerId === ELA_ID);
  assert.equal(card.owner, fresh); assert.equal(card.stock, 3); assert.equal(card.deployed, 0);
  assert.equal(f.deck.recharge(2), false); assert.equal(fresh.stats.attacks, 0);
});
