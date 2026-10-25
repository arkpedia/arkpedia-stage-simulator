// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { canTargetEnemy } from '../server/sim/targeting.js';
import { STRUCTURE_STOP_RADIUS, MINER_BODY_RADIUS } from '../server/sim/content/chapter16-structures.js';
import { STAGE_DEVICES } from '../shared/arkpedia/stage-devices.js';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import stage from '../data/arkpedia-stage-16-2.json' with { type: 'json' };
const proof = JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-ch16-device-source.json', import.meta.url)));
const records = JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-enemy-records.canonical.json', import.meta.url))).enemies;
const device = (kind, row, col) => ({ kind: 'device', row, col,
  name: kind === 'rock' ? 'Rock Wall' : 'Heavily Polluted Facility',
  key: kind === 'rock' ? 'trap_272_nomstn' : 'trap_271_fowstn' });
function fixture(devices) {
  const b = new StandardBattle({ ...structuredClone(mvp),
    stage: { ...structuredClone(stage), geometry: { ...structuredClone(stage.geometry), waves: [] }, devices },
    enemies: { ...structuredClone(stage.enemies), enemy_10120_uaghst: records.enemy_10120_uaghst.levels[0],
      enemy_10203_mumag: records.enemy_10203_mumag.levels[0] } },
  { operators: [defaultBuild(Object.values(mvp.operators).find(o => o.position === 'MELEE'))] });
  b.life = 1000;
  const run = seconds => {
    for (let i = 0; i < Math.ceil(seconds / b.dt); i++) b.step();
    assert.deepEqual(b.errors, [], 'battle hooks and AI must run without swallowed errors');
  };
  const spawn = (key, x, y) => {
    const e = b.spawnEnemy(key, { pos: [Math.round(y), Math.round(x)] });
    e.x = x; e.y = y; e.base.moveSpeed = 0; e.markDirty();
    e.route = { legs: [{ t: 'wait', time: 1e9 }], legIdx: 0 };
    return e;
  };
  return { b, run, spawn, structures: b.enemies.filter(e => e.mem.ch16Structure) };
}
const graph = key => {
  const rows = Object.entries(proof.prefabs).find(([name]) => name.includes(key))[1];
  return new Map(rows.map(r => [r.pathId, { type: r.componentType, ...JSON.parse(r.originalJson) }]));
};

test('structure stats, damage scale and contact circles match original prefabs and canonical tables', () => {
  for (const [key, name] of [['trap_271_fowstn', 'Heavily Polluted Facility'], ['trap_272_nomstn', 'Rock Wall']]) {
    const record = proof.characters[key], spec = STAGE_DEVICES[name].unit;
    const stats = record.phases[0].attributesKeyFrames[0].data;
    assert.equal(spec.hp, stats.maxHp); assert.equal(spec.def, stats.def); assert.equal(spec.res, stats.magicResistance);
    const talent = record.talents.flatMap(t => t.candidates).find(t => t.prefabKey === 'McreepDamageScale');
    assert.equal(talent.blackboard.find(b => b.key === 'damage_scale').value, 5);
    const objects = graph(key);
    const stop = [...objects.values()].find(o => o.m_Name === 'StopMcreep' && o.type === 'GameObject');
    const components = stop.m_Component.map(c => objects.get(c.component.m_PathID));
    const circle = components.find(c => c.type === 'CircleCollider2D');
    assert.ok(Math.abs(circle.m_Radius - STRUCTURE_STOP_RADIUS) < 1e-7);
    assert.equal(circle.m_IsTrigger, true);
    const aura = components.find(c => c._targetValidator);
    assert.equal(aura._removeBuffWhenTargetLeave, 1); assert.equal(aura._removeBuffWhenAbilityDetached, 1);
    assert.deepEqual(objects.get(aura._targetValidator.m_PathID)._buffs, ['enemy_mcreep_self_mark']);
  }
  const miner = Object.values(proof.enemyPrefabs).find(rows => rows.some(r => r.originalJson.includes('enemy_3010_mcreep')));
  assert.ok(miner.some(r => r.componentType === 'CircleCollider2D'
    && Math.abs(JSON.parse(r.originalJson).m_Radius - MINER_BODY_RADIUS) < 1e-7));
});

test('contact stops miners using collider overlap, preserves overlapping owners and releases on source death', () => {
  const { b, run, spawn, structures } = fixture([device('rock', 4, 4), device('rock', 4, 5)]);
  const m = spawn('enemy_3010_mcreep', 4.5, 4), edge = spawn('enemy_3010_mcreep', 3.11, 4);
  const outside = spawn('enemy_3010_mcreep', 3.09, 4);
  run(.05);
  assert.ok(m.s.flags.noMove && edge.s.flags.noMove);
  assert.equal(!!outside.s.flags.noMove, false);
  edge.x = 3.09; run(.05); assert.equal(!!edge.s.flags.noMove, false, 'leaving the contact field releases the miner');
  edge.x = 3.11; run(.05); assert.ok(edge.s.flags.noMove);
  b.kill(structures[0], null); assert.ok(m.s.flags.noMove);
  assert.equal(!!edge.s.flags.noMove, false);
  b.kill(structures[1], null); assert.equal(!!m.s.flags.noMove, false);
  assert.equal(b.grid.obstacle[4 * b.grid.cols + 4], 0);
});

test('miner attacks a target-free Rock Wall and its received damage scales after mitigation', () => {
  const { b, run, spawn, structures: [rock] } = fixture([device('rock', 4, 4)]);
  const m = spawn('enemy_3010_mcreep', 3.2, 4);
  assert.equal(canTargetEnemy({ tileR: 4, tileC: 3 }, rock), false);
  const hp = rock.hp;
  run(.5);
  assert.equal(rock.hp, hp - 1000, '(500 ATK - 300 DEF) × 5, through the normal attack clock');
  const before = rock.hp;
  b.dealDamage(m, rock, { amount: 100, type: 'true', canDodge: false });
  assert.equal(rock.hp, before - 500);
  const last = rock.hp;
  b.dealDamage(null, rock, { amount: 100, type: 'true', sourceless: true });
  assert.equal(rock.hp, last - 100, 'source-free damage is not credited to a miner');
});

test('facility shadow blocks deployment, grants timed invisibility, and clears when blocked or outside the field', () => {
  const { b, run, spawn, structures: [facility] } = fixture([device('facility', 4, 4)]);
  for (const status of ['stun', 'cold', 'freeze', 'silence', 'levitate', 'sleep'])
    assert.equal(b.applyStatus(facility, status, { duration: 1 }), false, `native facility immunity: ${status}`);
  const e = spawn('enemy_10203_mumag', 5, 4);
  assert.equal(!!e.s.flags.stealth, false);
  run(.25); assert.equal(!!e.s.flags.stealth, false, 'the trigger waits for its first native interval');
  run(.1); assert.ok(e.s.flags.stealth);
  const fake = { kind: 'op', homeR: 4, homeC: 5 };
  assert.equal(b._deploy(fake), false, 'backend deployment is refused before touching unit state');
  b.stage.tokens = [{ unitId: 'trap_001_crate', count: 1, cost: 0, hp: 8000, block: 0 }];
  b.mvpStageTokens.set('trap_001_crate', 1);
  assert.throws(() => b.deployToken('trap_001_crate', 4, 5), /pollution/);
  assert.equal(b.mvpStageTokens.get('trap_001_crate'), 1);
  b.chapter16.suppressShadow(4, 5, .1);
  b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const op = b.deployOperator(Object.keys(b.bench)[0], 4, 5, 'LEFT');
  run(.35);
  assert.equal(e.blockedBy, op, 'the deployed operator actually blocks the enemy');
  assert.equal(b.chapter16.isShadow(4, 5), true, 'the escape has expired while the enemy is blocked');
  assert.equal(!!e.s.flags.stealth, false);
  b.retreat(op); run(.35); assert.ok(e.s.flags.stealth);
  b.kill(facility, null); run(.35);
  assert.equal(b.chapter16.isShadow(4, 5), false);
  assert.equal(!!e.s.flags.stealth, false);
});

test('real miner escape restores deployment and visibility until its native expiry', () => {
  const { b, run, spawn } = fixture([device('facility', 4, 4)]);
  const e = spawn('enemy_10203_mumag', 5, 4);
  run(.35); assert.ok(e.s.flags.stealth);
  b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const id = Object.keys(b.bench)[0];
  assert.match(b._placementError(id, 4, 5), /pollution/);
  const m = spawn('enemy_3010_mcreep', 5, 4);
  run(.65);
  assert.equal(b.chapter16.isShadow(4, 5), false);
  assert.equal(!!e.s.flags.stealth, false);
  assert.equal(b._placementError(id, 4, 5), null);
  b.applyStatus(m, 'fear', { duration: 5 });
  run(3.4);
  assert.ok(b.chapter16.isShadow(4, 5));
  assert.ok(e.s.flags.stealth);
  assert.match(b._placementError(id, 4, 5), /pollution/);
});

test('native shadow trigger uses a delayed 0.3-second clock and removes invisibility when blocked', () => {
  const rows = Object.values(proof.globalPrefabs)[0];
  const controller = rows.map(r => JSON.parse(r.originalJson)).find(o => o._buffs);
  assert.ok(Math.abs(controller._buffs[0].triggerInterval - .3) < 1e-7);
  assert.equal(controller._buffs[0].waitFirstTriggerInterval, 1);
  assert.equal(controller._options.targetSide, 2);
  const actions = JSON.parse(JSON.parse(proof.templates['mainline16_enemy_target_free[trigger]'].originalJson)
    .eventToActions._items[0].value.SerializedState);
  assert.ok(actions[0]._conditionNode.$type.endsWith('CheckBlocked'));
  assert.equal(actions[0]._succeedNodes[0]._buffKey, 'mainline16_enemy_target_free[core]');
  const shadow = actions[0]._failNodes[0];
  assert.ok(shadow._conditionNode.$type.endsWith('Main16CheckTargetInShadowStateTile'));
  const create = shadow._succeedNodes.find(a => a._buff);
  assert.deepEqual(create._buff.attributes.abnormalFlags, ['INVISIBLE']);
});
