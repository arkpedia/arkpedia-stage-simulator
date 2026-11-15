// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileStageWaves, resolveStageWaveRoutes } from '../tools/arkpedia/stage-waves.mjs';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { resolveStageRandomWaves } from '../server/sim/content/arkpedia-stage-random.js';
import { stageWaveSpawns } from '../server/sim/content/arkpedia-stage-waves.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const enemy = 'enemy_1007_slime';
const action = options => ({ actionType: 'SPAWN', key: enemy, count: 1, preDelay: 0, interval: 1,
  managedByScheduler: true, blockFragment: false, dontBlockWave: false, randomType: 'ALWAYS', refreshType: 'ALWAYS', ...options });
const fragment = (actions, preDelay = 0) => ({ preDelay, actions });
const wave = (fragments, options = {}) => ({ preDelay: 0, postDelay: 0, maxTimeWaitingForNextWave: -1, fragments, ...options });
function fixture(waves) {
  const data = structuredClone(mvp), geometry = data.stage.geometry;
  geometry.waves = waves.map((w, wi) => {
    let clock = w.preDelay; const spawns = [];
    for (const [fi, f] of w.fragments.entries()) {
      clock += f.preDelay; let duration = 0;
      for (const a of f.actions) {
        duration = Math.max(duration, a.preDelay + (a.count - 1) * a.interval);
        if ([0, 'SPAWN'].includes(a.actionType)) spawns.push({ enemy_id: a.key, route: 1, fragment: fi,
          time: clock + a.preDelay, count: a.count, ...(a.randomSpawnGroupKey ? { random: { group: a.randomSpawnGroupKey, weight: a.weight } } : {}), ...(a.count > 1 ? { interval: a.interval } : {}) });
      }
      clock += duration;
    }
    return { index: wi, pre_delay: w.preDelay, post_delay: w.postDelay,
      duration: clock + w.postDelay, max_wait_for_next_wave: w.maxTimeWaitingForNextWave === -1 ? null : w.maxTimeWaitingForNextWave, spawns };
  });
  data.stage.waveProgram = compileStageWaves({ waves }, geometry);
  return data;
}
function battle(waves) {
  const b = new StandardBattle(fixture(waves), { operators: [defaultBuild(mvp.operators.char_123_fang)] }), events = [];
  b.on('enemySpawn', ({ enemy }) => {
    enemy.base.moveSpeed = 0; enemy.markDirty();
    b.addBuff(enemy, { key: 'test:hold', flags: { noMove: true, disarm: true } });
    events.push({ time: b.time, enemy });
  });
  const until = time => { while (!b.finished && b.time < time - 1e-9) b.step(); };
  return { b, events, until };
}
const at = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1 / 30 + 1e-7, `${actual} ≈ ${expected}`);

test('legacy viewer timing includes both wave delays exactly once', () => {
  const data = fixture([wave([fragment([action({ preDelay: 2 })])], { preDelay: 3, postDelay: 4 }),
    wave([fragment([action({ preDelay: 1 })])], { preDelay: 2 })]);
  delete data.stage.waveProgram;
  assert.deepEqual(stageAdapter(data.stage).spawns.map(s => s.time), [5, 12]);
});
test('wave programs wait for the field to clear and apply the next opening delay once', () => {
  const { b, events, until } = battle([wave([fragment([action({ preDelay: 2, count: 2, interval: 3 })], 1)], { postDelay: 2 }),
    wave([fragment([action({ preDelay: 1 })])], { preDelay: 4 })]);
  assert.equal(b.total, 3);
  until(10); assert.equal(events.length, 2); at(events[0].time, 3); at(events[1].time, 6);
  for (const { enemy } of events) b.kill(enemy);
  until(16); assert.equal(events.length, 2, 'closing delay starts after clearance');
  until(17.1); assert.equal(events.length, 3); at(events[2].time, 17);
  b.kill(events[2].enemy); until(18); assert.equal(b.reason, 'cleared'); assert.equal(b.killed, 3);
  assert.deepEqual(b.errors, []);
});
test('blockFragment waits for spawn action completion, not the spawned enemy lifetime', () => {
  const { b, events, until } = battle([wave([fragment([action({ blockFragment: true })]), fragment([action()], 2)])]);
  until(2.1); assert.equal(events.length, 2); at(events[1].time, 2);
  assert.ok(events[0].enemy.alive); assert.equal(b.finished, false);
});
test('nonblocking fragment enemies remain alive while later fragments start, and finite wave waits expire', () => {
  const { b, events, until } = battle([wave([fragment([action()]), fragment([action()], 2)], { maxTimeWaitingForNextWave: 5 }),
    wave([fragment([action()])], { preDelay: 1 })]);
  until(8.1); assert.equal(events.length, 3); at(events[1].time, 2); at(events[2].time, 8);
  assert.ok(events.every(e => e.enemy.alive)); assert.equal(b.total, 3);
});
test('timed-out wave members do not block later wave clearance or restart its closing delay', () => {
  const { b, events, until } = battle([wave([fragment([action()])], { maxTimeWaitingForNextWave: 2, postDelay: 3 }),
    wave([fragment([action()])], { postDelay: 1 }), wave([fragment([action()])])]);
  until(4); assert.equal(events.length, 1);
  until(5.1); assert.equal(events.length, 2); at(events[1].time, 5);
  b.kill(events[1].enemy); const clearedAt = b.time;
  until(clearedAt + 1.1); assert.equal(events.length, 3); at(events[2].time, clearedAt + 1);
  assert.ok(events[0].enemy.alive); assert.equal(b.finished, false);
});
test('each emitted unit retains its own wave and fragment origins across scheduler transitions', () => {
  const { b, events, until } = battle([wave([fragment([action({ dontBlockWave: true, preDelay: 2 })], 3)], { preDelay: 1 }),
    wave([fragment([action()], 4)], { preDelay: 2 })]);
  until(13); assert.equal(events.length, 2);
  assert.deepEqual(events[0].enemy.routeClock, { wave: 0, fragment: 4 });
  assert.deepEqual(events[1].enemy.routeClock, { wave: 6, fragment: 12 });
  assert.equal(b.stageWaveScheduler.wave, 1);
  assert.ok(Object.isFrozen(events[0].enemy.routeClock));
});
test('zero maximum wait uses the explicit immediate-timeout model', () => {
  const { events, until } = battle([wave([fragment([action()])], { maxTimeWaitingForNextWave: 0, postDelay: 2 }),
    wave([fragment([action()])])]);
  until(2.1); assert.equal(events.length, 2); at(events[1].time, 2);
});
test('the final wave cannot time out its clearance wait', () => {
  const { b, events, until } = battle([wave([fragment([action()])], { maxTimeWaitingForNextWave: 1, postDelay: 2 })]);
  until(4); assert.equal(b.stageWaveScheduler.done, false);
  b.kill(events[0].enemy); until(5); assert.equal(b.finished, false);
  until(6.1); assert.equal(b.reason, 'cleared');
});
test('dontBlockWave skips only the wave gate, while enemy totals and battle completion still count the enemy', () => {
  const { b, events, until } = battle([wave([fragment([action({ dontBlockWave: true })])]), wave([fragment([action()])])]);
  until(0.1); assert.equal(events.length, 2); at(events[0].time, 0); at(events[1].time, 0);
  b.kill(events[1].enemy); until(1); assert.equal(b.finished, false); assert.equal(b.total, 2);
  b.kill(events[0].enemy); until(2); assert.equal(b.reason, 'cleared');
});
test('empty waves and zero-delay fragments neither finish early nor duplicate spawns', () => {
  const { b, events, until } = battle([wave([]), wave([fragment([], 90), fragment([action()])], { preDelay: 3 })]);
  until(2); assert.equal(b.finished, false); assert.equal(events.length, 0);
  until(4); assert.equal(events.length, 1); at(events[0].time, 3); assert.deepEqual(b.errors, []);
});
test('timeout reports unreleased future spawns as unspawned, not killed or leaked', () => {
  const { b, events, until } = battle([wave([fragment([action()])]), wave([fragment([action({ count: 2 })])])]);
  b.timeLimit = 2; until(3);
  assert.equal(events.length, 1); assert.equal(b.reason, 'timeout'); assert.equal(b.unspawned.length, 2);
  assert.equal(b.total, 1); assert.equal(b.killed, 0);
});
test('unharmful action flags preserve combat and lifetime while excluding LP loss and planned totals', () => {
  const { b, events, until } = battle([wave([fragment([action({ isUnharmfulAndAlwaysCountAsKilled: true, blockFragment: true }), action()])])]);
  until(0.1); assert.equal(events.length, 2); assert.equal(b.total, 1);
  const harmless = events[0].enemy, ordinary = events[1].enemy;
  assert.equal(harmless.counted, false); assert.equal(harmless.lpr, 0); assert.equal(harmless.profile.holdsBattle, undefined);
  assert.equal(harmless.profile.noAttack, ordinary.profile.noAttack, 'counting flags do not suppress attacks');
  b.kill(ordinary); until(.2); assert.equal(b.finished, false, 'a live unharmful actor still holds the wave and battle');
  const life = b.life; b.leak(harmless);
  assert.equal(b.life, life); assert.equal(b.leakedCount, 0);
  assert.equal(b._pp('arkpedia').perfect, true);
  b.kill(ordinary); until(1); assert.equal(b.reason, 'cleared'); assert.equal(b.killed, 1);
});
test('pending enemy revival/summon timers hold a clear-gated wave until the timer resolves', () => {
  const { b, events, until } = battle([wave([fragment([action()])]), wave([fragment([action()])])]);
  until(1); b.after(3, () => {}, { holdsBattle: true }); b.kill(events[0].enemy);
  until(3); assert.equal(events.length, 1);
  until(4.1); assert.equal(events.length, 2); at(events[1].time, 4);
});
test('managed delayed summons survive source death and transfer the wave gate to their child', () => {
  const { b, events, until } = battle([wave([fragment([action()])]), wave([fragment([action()])])]);
  until(1); const parent = events[0].enemy, scheduler = b.stageWaveScheduler;
  const clock = parent.routeClock; let child;
  scheduler.scheduleSummon(parent, 2, () => child = b.spawnEnemy(enemy, { routeIndex: 1, countInTotal: false }));
  b.kill(parent); b.offOwner(parent); until(2.9); assert.equal(events.length, 1);
  until(3.1); assert.equal(events.length, 2); assert.equal(child.alive, true);
  assert.deepEqual(scheduler.membership(child), { wave: 0, dontBlockWave: false });
  assert.equal(child.counted, false); assert.equal(b.total, 2); assert.equal(b.killed, 1);
  assert.equal(parent.routeClock, clock, 'scheduler registration does not rewrite route origins');
  until(4); assert.equal(events.length, 2); b.kill(child); until(4.1);
  assert.equal(events.length, 3); assert.equal(b.killed, 1, 'child death adds no planned-count credit');
  b.kill(events[2].enemy); until(5); assert.equal(b.reason, 'cleared'); assert.deepEqual(b.errors, []);
});
test('summon timers and children from a timed-out wave do not block later waves', () => {
  const { b, events, until } = battle([wave([fragment([action()])], { maxTimeWaitingForNextWave: 1 }),
    wave([fragment([action()])]), wave([fragment([action()])]), wave([fragment([action()])])]);
  until(.1); let child;
  b.stageWaveScheduler.scheduleSummon(events[0].enemy, 3, () => child = b.spawnEnemy(enemy, { routeIndex: 1, countInTotal: false }));
  until(1.1); assert.equal(events.length, 2); b.kill(events[1].enemy); until(1.2);
  assert.equal(events.length, 3, 'old timer does not hold second wave');
  until(3.2); assert.equal(events.length, 4); assert.ok(child.alive);
  b.kill(events[2].enemy); until(3.3); assert.equal(events.length, 5, 'old child does not hold third wave');
  assert.equal(b.stageWaveScheduler.membership(child).wave, 0);
  assert.deepEqual(b.errors, []);
});
test('nonblocking managed summons still hold final victory and can be cancelled before emission', () => {
  const { b, events, until } = battle([wave([fragment([action()])]), wave([fragment([action()])])]);
  until(.1); let child;
  const scheduler = b.stageWaveScheduler, parent = events[0].enemy;
  scheduler.scheduleSummon(parent, 2, () => child = b.spawnEnemy(enemy, { routeIndex: 1, countInTotal: false }), { dontBlockWave: true });
  const cancelled = scheduler.scheduleSummon(parent, 100, () => assert.fail('cancelled timer must not emit'));
  cancelled.cancel(); b.kill(parent); until(.2); assert.equal(events.length, 2);
  b.kill(events[1].enemy); until(1); assert.equal(b.finished, false);
  until(2.2); assert.equal(events.length, 3); assert.equal(b.finished, false);
  assert.equal(scheduler.blocksWave(child), false); assert.equal(child.profile.holdsBattle, undefined);
  b.kill(child); until(3); assert.equal(b.reason, 'cleared'); assert.deepEqual(b.errors, []);
});
test('compiler refuses drift, scheduled devices, random choices and malformed action flags', () => {
  const level = { waves: [wave([fragment([action()])])] }, data = fixture(level.waves);
  const bad = structuredClone(data.stage.geometry); bad.waves[0].spawns[0].time = 1;
  assert.throws(() => compileStageWaves(level, bad), /spawn mismatch/);
  for (const change of [{ actionType: 'ACTIVATE_PREDEFINED' }, { randomSpawnGroupKey: 'choice' },
    { managedByScheduler: false }]) {
    const changed = structuredClone(level); Object.assign(changed.waves[0].fragments[0].actions[0], change);
    assert.throws(() => compileStageWaves(changed, data.stage.geometry), /Unsupported/);
  }
  const numeric = structuredClone(level); numeric.waves[0].fragments[0].actions[0].actionType = 0;
  assert.deepEqual(compileStageWaves(numeric, data.stage.geometry), data.stage.waveProgram);
  const malformed = structuredClone(level); malformed.waves[0].fragments[0].actions[0].dontBlockWave = 'yes';
  assert.throws(() => compileStageWaves(malformed, data.stage.geometry), /Invalid original action flag/);
});

test('hidden-group original route IDs resolve independently of deduplicated viewer route IDs', () => {
  const viewRoute = { motion: 'walk', start: { row: 1, col: 2 }, end: { row: 1, col: 0 }, checkpoints: [], waits: [] };
  const original = { motionMode: 'WALK', startPosition: { row: 2, col: 2 }, endPosition: { row: 2, col: 0 }, checkpoints: [] };
  const level = { routes: [original], waves: [wave([fragment([action({ routeIndex: 0, hiddenGroup: 'raid' })])])] };
  const geometry = { rows: 3, cols: 3, routes: [viewRoute], waves: [{ pre_delay: 0, post_delay: 0, duration: 0,
    max_wait_for_next_wave: null, spawns: [{ source: 'wave', enemy_id: enemy, count: 1, time: 0, fragment: 0, route: 0 }] }] };
  const resolved = resolveStageWaveRoutes(level, geometry);
  assert.equal(geometry.routes.length, 1); assert.equal(geometry.waves[0].spawns[0].route, 0);
  assert.equal(resolved.waves[0].spawns[0].route, 1);
  assert.deepEqual(resolved.routes[1].start, original.startPosition);
  assert.deepEqual(resolved.spawnTiles[0], { key: 'tile_start', row: 2, col: 2, routes: [1] });
  const program = compileStageWaves(level, resolved, { hiddenGroups: { raid: true } });
  assert.equal(program.waves[0].fragments[0].spawns[0].routeIndex, 1);
  const shared = { ...geometry, routes: [viewRoute, resolved.routes[1]] };
  assert.equal(resolveStageWaveRoutes(level, shared).routes.length, 2, 'equal route geometry is reused');
});


test('plain random groups choose one whole action before counts and clocks expand', () => {
  const data = fixture([wave([fragment([
    action({ count: 3, interval: 2, randomSpawnGroupKey: 'g', weight: 1 }),
    action({ count: 5, preDelay: 40, randomSpawnGroupKey: 'g', weight: 0 }),
  ]), fragment([action()], 2)])]);
  const original = structuredClone(data.stage.waveProgram);
  const resolved = resolveStageRandomWaves(original, 7);
  assert.equal(resolved.waves[0].fragments[0].spawns.length, 1);
  assert.equal(resolved.waves[0].fragments[0].duration, 4);
  assert.equal(resolved.randomChoices.length, 1);
  assert.throws(() => stageWaveSpawns(original), /Resolve stage random/);
  const b = new StandardBattle(data, { operators: [defaultBuild(mvp.operators.char_123_fang)] }, { seed: 7 });
  const spawned = [];
  b.on('enemySpawn', ({ enemy }) => { spawned.push(b.time); b.addBuff(enemy, { key: 'hold', flags: { noMove: true, disarm: true } }); });
  while (b.time < 7 && !b.finished) b.step();
  assert.equal(b.total, 4); assert.equal(spawned.length, 4);
  [0, 2, 4, 6].forEach((t, i) => at(spawned[i], t));
  assert.deepEqual(data.stage.waveProgram, original, 'cached stage is never changed by a run');
  assert.deepEqual(resolveStageRandomWaves(original, 7), resolved, 'restart seed replays choices');
  for (const e of [...b.enemies]) if (e.alive) b.kill(e);
  b.step(); assert.equal(b.reason, 'cleared'); assert.equal(b.killed, 4);
});
test('same group names in separate fragments are independent and seeds cover both alternatives', () => {
  const data = fixture([wave([fragment([action({ randomSpawnGroupKey: 'g', weight: 1 }), action({ randomSpawnGroupKey: 'g', weight: 1 })]),
    fragment([action({ randomSpawnGroupKey: 'g', weight: 1 }), action({ randomSpawnGroupKey: 'g', weight: 1 })])])]);
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const p = resolveStageRandomWaves(data.stage.waveProgram, seed);
    assert.equal(p.randomChoices.length, 2);
    seen.add(p.randomChoices.map(c => c.action).join(','));
  }
  assert.deepEqual([...seen].sort(), ['0,0', '0,1', '1,0', '1,1']);
});
test('random source drift, packs, hidden combinations, zero totals and refresh policies stay refused', () => {
  const a = action({ randomSpawnGroupKey: 'g', weight: 1 }), waves = [wave([fragment([a])])], data = fixture(waves);
  for (const mutation of [{ randomSpawnGroupPackKey: 'pack' }, { hiddenGroup: 'raid' }, { refreshType: 'PER_DAY' },
    { weight: 0 }, { weight: -1 }, { weight: 1.5 }, { actionType: 'PLAY_BGM' }]) {
    const changed = structuredClone(waves); Object.assign(changed[0].fragments[0].actions[0], mutation);
    assert.throws(() => compileStageWaves({ waves: changed }, data.stage.geometry));
  }
  const changed = structuredClone(data.stage.geometry); changed.waves[0].spawns[0].random.weight = 2;
  assert.throws(() => compileStageWaves({ waves }, changed), /spawn mismatch/);
});
test('terminal minus-one post delay means no closing wait and still waits for clearance', () => {
  const { b, events, until } = battle([wave([fragment([action()])], { postDelay: -1 })]);
  until(1); assert.equal(b.finished, false); b.kill(events[0].enemy); b.step();
  assert.equal(b.reason, 'cleared'); assert.equal(b.stageWaveScheduler.program.waves[0].postDelay, 0);
  assert.throws(() => fixture([wave([], { postDelay: -1 }), wave([])]), /Invalid original wave delay/);
});

test('random activation selects one alias or an empty choice before scheduling and timing', () => {
  const actions = [action({ actionType: 'ACTIVATE_PREDEFINED', key: '', preDelay: 90, randomSpawnGroupKey: 'reward', weight: 1 }),
    action({ actionType: 'ACTIVATE_PREDEFINED', key: 'chest', preDelay: 3, randomSpawnGroupKey: 'reward', weight: 0 })];
  const level = { waves: [wave([fragment(actions, 30)])] };
  const geometry = { waves: [{ pre_delay: 0, post_delay: 0, duration: 120, max_wait_for_next_wave: null, spawns: [] }] };
  const program = compileStageWaves(level, geometry, {}, null, ['chest']);
  assert.throws(() => stageWaveSpawns(program), /Resolve stage random/);
  const empty = resolveStageRandomWaves(program, 1), f = empty.waves[0].fragments[0];
  assert.equal(f.empty, true); assert.equal(f.duration, 0); assert.equal(f.activations, undefined);
  assert.equal(empty.randomChoices[0].kind, 'emptyChoices');
  const changed = structuredClone(level);
  changed.waves[0].fragments[0].actions[0].weight = 0; changed.waves[0].fragments[0].actions[1].weight = 1;
  const chosen = resolveStageRandomWaves(compileStageWaves(changed, geometry, {}, null, ['chest']), 1).waves[0].fragments[0];
  assert.equal(chosen.activations[0].key, 'chest'); assert.equal(chosen.duration, 3); assert.equal(chosen.empty, undefined);
  assert.throws(() => compileStageWaves(level, geometry), /Unsupported scheduled predefined target/);
  assert.throws(() => compileStageWaves(level, geometry, {}, null, ['chest', 'chest']), /Ambiguous/);
});
test('one weighted group can choose between a spawn and an activation without emitting both', () => {
  const spawn = action({ randomSpawnGroupKey: 'g', weight: 1, count: 3 });
  const activate = action({ actionType: 'ACTIVATE_PREDEFINED', key: 'chest', randomSpawnGroupKey: 'g', weight: 1 });
  const level = { waves: [wave([fragment([spawn, activate])])] };
  const geometry = fixture([wave([fragment([spawn])])]).stage.geometry;
  const program = compileStageWaves(level, geometry, {}, null, ['chest']), kinds = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const f = resolveStageRandomWaves(program, seed).waves[0].fragments[0];
    assert.equal(f.spawns.length + (f.activations?.length ?? 0), 1);
    kinds.add(f.spawns.length ? 'enemy' : 'device');
  }
  assert.deepEqual([...kinds].sort(), ['device', 'enemy']);
});

test('empty-key weighted spawn candidates never become enemies or require an executable route', () => {
  const actions = [action({ key: '', routeIndex: 999, randomSpawnGroupKey: 'g', weight: 1, preDelay: 80 }),
    action({ randomSpawnGroupKey: 'g', weight: 0, preDelay: 3 })];
  const data = fixture([wave([fragment(actions, 10)])]);
  const resolved = resolveStageRandomWaves(data.stage.waveProgram, 1);
  assert.equal(resolved.waves[0].fragments[0].empty, true);
  assert.deepEqual(stageWaveSpawns(resolved), []);
  assert.equal(resolved.waves[0].fragments[0].duration, 0);
  const bad = structuredClone(data.stage.geometry); bad.waves[0].spawns[0].count = 4;
  assert.throws(() => compileStageWaves({ waves: [wave([fragment(actions, 10)])] }, bad), /empty spawn mismatch/);
});

test('native wave release keeps living bodies and carries its source into next-wave clearance', () => {
  const {b,events,until}=battle([wave([fragment([action({count:2,interval:0})])],{postDelay:2}),
    wave([fragment([action()])],{preDelay:3}),wave([fragment([action()])])]);
  until(.1);const [source,other]=events.map(x=>x.enemy),clock=source.routeClock;
  assert.equal(b.stageWaveScheduler.releaseCurrentWave(source,{trackSourceAtNextWave:true}),true);
  assert.equal(b.killed,0);assert.equal(b.total,4);assert.ok(other.alive&&source.alive);
  until(5.2);assert.equal(events.length,3);assert.equal(source.routeClock,clock);
  assert.deepEqual(b.stageWaveScheduler.membership(source),{wave:1,dontBlockWave:false});
  b.kill(events[2].enemy);until(7);assert.equal(events.length,3,'transferred boss holds the new wave');
  b.kill(source);until(7.2);assert.equal(events.length,4);
  b.kill(events[3].enemy);until(8);assert.equal(b.finished,false,'released bodies still hold final victory');
  b.kill(other);until(8.2);assert.equal(b.reason,'cleared');assert.equal(b.killed,4);assert.deepEqual(b.errors,[]);
});

test('wave release does not skip pending spawns and later emissions still block their wave',()=>{
  const {b,events,until}=battle([wave([fragment([action(),action({preDelay:3})]),fragment([action()],2)]),
    wave([fragment([action()])])]);
  until(.1);b.stageWaveScheduler.releaseCurrentWave(events[0].enemy);
  until(3.1);assert.equal(events.length,2);assert.equal(b.stageWaveScheduler.blocksWave(events[1].enemy),true);
  until(6);assert.equal(events.length,3);assert.equal(b.stageWaveScheduler.wave,0);
  b.kill(events[1].enemy);b.kill(events[2].enemy);until(6.2);assert.equal(events.length,4);
  assert.ok(events[0].enemy.alive);assert.equal(b.total,4);assert.deepEqual(b.errors,[]);
});

test('last-wave release never invents a wave or grants kill credit',()=>{
  const {b,events,until}=battle([wave([fragment([action()])],{postDelay:1})]);
  until(.1);const source=events[0].enemy;
  assert.throws(()=>b.stageWaveScheduler.releaseCurrentWave(null,{trackSourceAtNextWave:true}),/source/);
  b.stageWaveScheduler.releaseCurrentWave(source,{trackSourceAtNextWave:true});
  until(2);assert.equal(b.stageWaveScheduler.done,true);assert.equal(b.finished,false);assert.equal(b.killed,0);
  assert.equal(b.stageWaveScheduler.releaseCurrentWave(source),false);
  b.kill(source);until(2.2);assert.equal(b.reason,'cleared');assert.equal(b.killed,1);
});
