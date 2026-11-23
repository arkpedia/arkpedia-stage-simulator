// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { applyStageEnemyBlackboard } from '../shared/arkpedia/stage-enemy-talents.js';
import { blackSnakeNative, blackSnakeParams } from '../shared/arkpedia/enemy-black-snake-features.js';
import { flameDefinition, flameNativeReviewed } from '../shared/arkpedia/stage-flames.js';
import { StageFlames } from '../server/sim/content/arkpedia-stage-flames.js';
import { StageBranchScheduler } from '../server/sim/content/arkpedia-stage-branches.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };

const id = 'enemy_1515_bsnake', entry = ENEMY_RECORDS.enemies[id];
const PREFAB = 'dyn/battle/prefabs/enemies/enemy_1515_bsnake.prefab';
const H8_4_HINT = '(5,2)|(3,4)|(1,4)|(4,6)|(1,8)_(2,2)|(6,4)|(4,6)|(5,8)|(1,9)_(2,2)|(5,4)|(1,4)|(1,8)|(1,9)_(5,2)|(6,4)|(3,4)|(4,6)|(5,8)_(5,2)|(2,2)|(6,4)|(3,4)|(1,4)_(2,2)|(3,4)|(1,4)|(1,8)|(1,9)_(5,2)|(6,4)|(5,4)|(4,6)|(5,8)';
const hinted = (r, location = H8_4_HINT, interval = 27) => applyStageEnemyBlackboard(r, { level: r.level, skills: null, spData: null,
  blackboard: [{ key: 'hint.location', value: 0, valueStr: location }, { key: 'hint.interval', value: interval, valueStr: null }] });
const withComponent = (pick, edit) => { const n = structuredClone(native); for (const row of n.prefabs[PREFAB]) { const d = JSON.parse(row.originalJson); if (pick(d)) { edit(d); row.originalJson = JSON.stringify(d); } } return nativeComponents(n, id); };

test('both levels are admitted from the pinned native tree; hint parameters are presentation only', () => {
  assert.ok(enemySupport(entry, clocks.prefabs, native).policy);
  const n = nativeComponents(native, id);
  for (const r of Object.values(entry.levels)) { assert.equal(blackSnakeNative(r, n), true); assert.equal(blackSnakeNative(hinted(r), n), true, `hinted level ${r.level}`); }
  const r0 = entry.levels[0];
  assert.equal(blackSnakeNative({ ...r0, talents: { ...r0.talents, bb: { ...r0.talents.bb, 'protect.bsnake_t[protect].damage_resistance': .3 } } }, n), false);
  assert.equal(blackSnakeNative(r0, withComponent(d => d._maxRespawnCnt === 2, d => { d._maxRespawnCnt = 3; })), false, 'three lives');
  assert.equal(blackSnakeNative(r0, withComponent(d => d._buffKey === 'dragon_fire' && d._maxNum === 2 && d._buffKeyExcluded === 1, d => { d._maxNum = 3; })), false, 'Ignite count');
  for (const bad of ['(5,2)|(3,4', 'x', '(5,2)_(1,x)']) assert.throws(() => hinted(r0, bad), /Unsupported injected enemy parameter/);
  assert.throws(() => hinted(r0, H8_4_HINT, 0), /Unsupported injected enemy parameter/);
});

test('parameters: Burning Breath 50 -> 230 over 30 s for 30.5 s; Ignite 19 s x2; Detonate 35 s on x-5; Inferno 10 volleys in 28 s', () => {
  const p = blackSnakeParams(entry.levels[1]);
  assert.deepEqual(p.attack.breath, { duration: 30.5, base: 50, add: 180, ramp: 30 });
  assert.deepEqual([p.ignite.cooldown, p.ignite.initial, p.ignite.count], [19, 19, 2]);
  assert.deepEqual([p.explode.cooldown, p.explode.initial, p.explode.scale], [35, 35, 1]);
  assert.deepEqual(p.explode.tiles.map(x => x.join()).sort(), ['-1,0', '0,-1', '0,0', '0,1', '1,0']);
  assert.equal(p.protect.resistance, .5);
  assert.deepEqual(p.revive, { dur: 5, hpPct: .5, atkPct: .5, down: 5 });
  assert.deepEqual(p.inferno, { duration: 28, interval: 2, volleys: 10, invincible: 15, scale: 1, speed: 2.5, radius: .25, lifetime: 60, jitter: .1 });
  assert.deepEqual([p.flame.cooldown, p.flame.initial, p.flame.branch], [50, 75, 'bsnake_flame']);
});

/** The Black Snake at row 3, col 6 (held still); operators (huge HP, no attack) at the given tiles; a 7x10 map. */
function fixture(tiles, { rec = entry.levels[1], branches = null, armed = false } = {}) {
  const op = chessRec({ id: 'bsnake_target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 0 } });
  const h = makeBattle({ content: 'generic', autoFinish: false, timeLimit: 1000, defs: { chess: { [op.chessId]: op }, enemies: { [id]: rec } },
    units: tiles.map((_, i) => ({ chessId: op.chessId, row: 10, col: 2 + i, dir: 'RIGHT' })), setup: b => installEnemyFeatures(b) });
  const b = h.b; b.start(); b.regularMapSize = { rows: 7, cols: 10 };
  const ops = h.allies(); ops.forEach((u, i) => { u.y = tiles[i][0]; u.x = tiles[i][1]; });
  const releases = []; b.stageWaveScheduler = { releaseCurrentWave: (...args) => { releases.push(args); return true; } };
  const activated = []; b.activateStagePredefined = key => activated.push(key);
  if (branches) b.stageBranches = new StageBranchScheduler(b, branches, {});
  const e = b.spawnEnemy(id, { pos: [3, 6], route: 0 }); e.y = 3; e.x = 6;
  // Held still; disarmed unless the test is about his attack, so attacks do not mix into skill observations.
  b.addBuff(e, { key: 'hold', persist: true, flags: { noMove: true, ...(armed ? {} : { disarm: true }) } });
  const ab = e.mem.ab.list.find(a => a.bsnake);
  const hits = []; b.on('damaged', c => { if (c.dmg?.tags?.some(t => t.startsWith('bsnake'))) hits.push({ target: c.target, amount: c.dmg.amount, type: c.dmg.type, tag: c.dmg.tags.find(t => t.startsWith('bsnake')), t: b.time }); });
  const run = s => { const until = b.time + s; while (b.time < until - 1e-9) { const t = b.time; b.step(); if (!(b.time > t)) throw Error(`battle time stuck at ${t} (finished: ${b.finished})`); } };
  return { ...h, b, e, ops, ab, hits, releases, activated, run, p: blackSnakeParams(rec) };
}
const burning = u => u.buffs.find(x => x.key === 'dragon_fire');

test('attacks: True damage and Burning Breath; a re-application refreshes the duration and keeps the ramp', () => {
  const { b, e, ops: [op], ab, hits, p } = fixture([[3, 7]], { armed: true });
  e.mem.ab.list.find(a => a.attack)?.attack({ targets: [op] }, b, e, ab);
  assert.deepEqual(hits.map(x => [x.target, x.amount, x.type]), [[op, e.s.atk, 'true']]);
  const burn = burning(op); assert.ok(burn); assert.equal(burn.source, e);
  for (let i = 0; i < 100; i++) b.step();
  const left = burn.timeLeft;
  e.mem.ab.list.find(a => a.attack).attack({ targets: [op] }, b, e, ab);
  assert.equal(burning(op), burn, 'the same burn'); assert.ok(burn.timeLeft > left, 'refreshed');
  assert.ok(Math.abs(burn.timeLeft - p.attack.breath.duration) < 1e-6);
});

test('Protect: damage from a carrier of his own Burning Breath is halved; other sources are not', () => {
  const { b, e, ops: [op, other] } = fixture([[3, 7], [3, 8]]);
  const hp0 = e.hp; b.dealDamage(op, e, { amount: 1000, type: 'true', applyWay: 'none', tags: ['probe'] }); const full = hp0 - e.hp;
  b.addBuff(op, { key: 'dragon_fire', source: e, duration: 10 });
  const hp1 = e.hp; b.dealDamage(op, e, { amount: 1000, type: 'true', applyWay: 'none', tags: ['probe'] });
  assert.equal(hp1 - e.hp, full * .5);
  b.addBuff(other, { key: 'dragon_fire', source: op, duration: 10 });
  const hp2 = e.hp; b.dealDamage(other, e, { amount: 1000, type: 'true', applyWay: 'none', tags: ['probe'] });
  assert.equal(hp2 - e.hp, full, 'a burn from another source does not count');
});

test('Ignite marks at most two operators without Burning Breath, at the Skill_1 release after 19 s', () => {
  const { b, e, ops, run, p } = fixture([[1, 1], [2, 2], [5, 5]]);
  b.addBuff(ops[0], { key: 'dragon_fire', source: e, duration: 100 });
  run(p.ignite.initial + p.ignite.anim[0].hit - .05);
  assert.equal(ops.filter(burning).length, 1);
  run(.1);
  assert.equal(ops.filter(burning).length, 3, 'the two unburnt operators');
});

test('Detonate: each carrier takes 100% Arts and loses its burn; its tile and the four around it are hit and re-ignited', () => {
  // Carriers at (3,3) and (5,8); a neighbour of the first at (3,4), a diagonal (4,4) untouched, a bystander far away.
  const { b, e, ops, hits, run, p, ab } = fixture([[3, 3], [3, 4], [4, 4], [5, 8], [0, 0]]);
  const [c1, n1, diag, c2, far] = ops;
  for (const u of [c1, c2]) b.addBuff(u, { key: 'dragon_fire', source: e, duration: 100 });
  ab.left.ignite = 1e9; ab.left.explode = 0;
  run(p.explode.anim[0].hit + .05);
  const by = tag => hits.filter(x => x.tag === tag).map(x => x.target);
  assert.deepEqual(by('bsnakeDetonate'), [c1, c2]);
  assert.deepEqual(by('bsnakeSplash'), [n1]);
  assert.ok(!burning(c1) && !burning(c2), 'carriers lose their burn');
  assert.ok(burning(n1) && !burning(diag) && !burning(far));
  assert.ok(hits.filter(x => x.tag !== 'bsnakeAttack').every(x => x.type === 'arts' && x.amount === e.s.atk));
});

test('first knock-out: wave released and tracked; 5 s revive; +50% max HP and ATK at full HP; the Inferno; then the second form', () => {
  const { b, e, ops, hits, releases, run, p, ab } = fixture([[0, 2], [2, 5], [6, 8]]);
  const maxHp = e.s.maxHp, atk = e.s.atk;
  b.dealDamage(null, e, { amount: e.hp, type: 'true', sourceless: true });
  assert.equal(e.alive, true); assert.equal(ab.form, 'reviving');
  assert.deepEqual(releases.map(([, o]) => o), [{ trackSourceAtNextWave: true }]);
  run(p.revive.dur + .02);
  assert.equal(ab.form, 'inferno'); assert.equal(e.s.maxHp, maxHp * 1.5); assert.equal(e.s.atk, atk * 1.5); assert.equal(e.hp, e.s.maxHp);
  // Invincible and inert through the Inferno: ten volleys, first at 2 s, one fireball per row from the left border.
  const t0 = b.time; const hp = e.hp; b.dealDamage(null, e, { amount: 1e6, type: 'true', sourceless: true }); assert.equal(e.hp, hp);
  run(p.inferno.duration - .05);
  const inferno = hits.filter(x => x.tag === 'bsnakeInferno');
  // Each volley hits the first operator in every row that has one (three rows here); none before 2 s.
  assert.equal(inferno.length, 30);
  assert.ok(inferno.every(x => x.type === 'arts' && x.amount === e.s.atk && x.t - t0 > p.inferno.interval - 1e-9));
  assert.deepEqual(new Set(inferno.map(x => x.target)), new Set(ops));
  assert.equal(ab.form, 'inferno');
  run(.1);
  assert.equal(ab.form, 'second'); assert.ok(e.buffs.some(x => x.key === 'reborn_up[invincible]'));
  assert.deepEqual([ab.left.flame > 74, ab.left.ignite > 18, ab.left.explode > 34], [true, true, true], 'skills from their initial cooldowns');
  assert.deepEqual(b.errors, []);
});

test('second form: SummonFlame advances the looping bsnake_flame branch every 50 s (first at 75 s)', () => {
  const phases = [['#1', '#2'], ['#3']];
  const { b, e, activated, run, p, ab } = fixture([[0, 0]], { branches: { bsnake_flame: { spawns: [], phases } } });
  ab.form = 'second'; ab.left = { flame: p.flame.initial, ignite: 1e9, explode: 1e9 };
  run(p.flame.initial + p.flame.anim.hit + .05); assert.deepEqual(activated, ['#1', '#2']);
  run(p.flame.cooldown); assert.deepEqual(activated, ['#1', '#2', '#3']);
  run(p.flame.cooldown); assert.deepEqual(activated, ['#1', '#2', '#3', '#1', '#2'], 'the branch loops');
  assert.deepEqual(b.errors, []); assert.equal(e.alive, true);
});

test('second knock-out: wave released without tracking; 5 s down; the final Inferno; then he dies', () => {
  const { b, e, releases, run, p, ab } = fixture([[3, 1]]);
  ab.form = 'second';
  let died = false; b.on('death', c => { if (c.unit === e) died = true; });
  b.dealDamage(null, e, { amount: e.hp, type: 'true', sourceless: true });
  assert.equal(e.alive, true); assert.equal(ab.form, 'down');
  assert.deepEqual(releases.map(([, o]) => o), [undefined]);
  run(p.revive.down + .02); assert.equal(ab.form, 'final');
  run(p.inferno.duration - .05); assert.equal(e.alive, true);
  run(.1); assert.equal(e.alive, false); assert.equal(died, true);
});

test('Energy Aggregate: pinned native and skill levels (1000 / 1500 Arts)', () => {
  assert.equal(flameNativeReviewed(), true);
  assert.deepEqual([1, 2].map(skillLevel => flameDefinition({ level: 1, skillLevel }).damage), [1000, 1500]);
  for (const bad of [{ level: 2, skillLevel: 1 }, { level: 1, skillLevel: 3 }, null]) assert.throws(() => flameDefinition(bad), /Energy Aggregate/);
});

test('Energy Aggregate: appears on its alias, fires four fireballs after 25 s and withdraws; destroyed first, it never fires', () => {
  const op = chessRec({ id: 'flame_target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 0 } });
  // The harness rect is rows 9-12, cols 0-10: the Aggregate at (10,5), one operator in each direction.
  const h = makeBattle({ content: 'generic', autoFinish: false, timeLimit: 1000, defs: { chess: { [op.chessId]: op } },
    units: [0, 1, 2, 3].map(i => ({ chessId: op.chessId, row: 11, col: 2 + i, dir: 'RIGHT' })) });
  const b = h.b; b.start(); b.regularMapSize = { rows: 13, cols: 11 };
  const ops = h.allies(); [[9, 5], [10, 9], [12, 5], [10, 1]].forEach(([r, c], i) => { ops[i].y = r; ops[i].x = c; });
  const device = alias => ({ key: 'trap_021_flame', kind: 'device', name: 'Energy Aggregate', row: 10, col: 5, hidden: true, alias, branchActivated: true, instance: { level: 1, skillLevel: 2 } });
  const flames = new StageFlames(b, [device('trap_021_flame#1')]);
  assert.equal(flames.activate('other'), false);
  assert.equal(flames.activate('trap_021_flame#1'), true);
  const body = flames.hidden.get('trap_021_flame#1').unit;
  assert.ok(body); assert.equal(body.side, 'enemy'); assert.equal(body.s.maxHp, 6000);
  assert.equal(flames.activate('trap_021_flame#1'), true); assert.equal(flames.hidden.get('trap_021_flame#1').unit, body, 'no second body');
  const hits = []; b.on('damaged', c => { if (c.dmg?.tags?.includes('stage:flame')) hits.push([c.target, c.dmg.amount, c.dmg.type]); });
  const run = s => { const until = b.time + s; while (b.time < until - 1e-9) { const t = b.time; b.step(); if (!(b.time > t)) throw Error('battle time stuck'); } };
  run(24.9); assert.equal(hits.length, 0); assert.equal(body.alive, true);
  run(4);
  assert.deepEqual(new Set(hits.map(x => x[0])), new Set(ops)); assert.ok(hits.every(x => x[1] === 1500 && x[2] === 'arts'));
  assert.ok(ops.every(u => u.buffs.some(x => x.key === 'dragon_fire')));
  assert.equal(body.alive, false, 'withdrawn');
  // The branch brings the alias back: a new body; killed early it never fires.
  flames.activate('trap_021_flame#1');
  const second = flames.hidden.get('trap_021_flame#1').unit; assert.ok(second?.alive && second !== body);
  const before = hits.length; b.kill(second); run(30); assert.equal(hits.length, before);
  assert.deepEqual(b.errors, []);
});

// Literal per-stage expectations, observed in the compiled stage.
for (const [stageId, level, maxHp, flameDamage] of [['h8-4', 1, 60000, 1500], ['jt8-3', 0, 50000, 1000]])
  test(`compiled ${stageId}: level ${level} (${maxHp} HP), ten hidden Energy Aggregates at ${flameDamage}, the seven-phase branch`, async () => {
    const { StandardBattle } = await import('../server/sim/arkpedia.js');
    const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
    const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
    const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
    const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
    const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
    const found = manifest.stages.find(s => s.id === stageId);
    assert.equal(found.availability, 'available');
    const stage = await loader.load(found);
    assert.equal(stage.enemies[id].level, level); assert.equal(stage.enemies[id].stats.maxHp, maxHp);
    const flames = stage.devices.filter(d => d.key === 'trap_021_flame');
    assert.equal(flames.length, 10); assert.ok(flames.every(d => d.hidden && d.branchActivated && flameDefinition(d.instance).damage === flameDamage));
    const branch = stage.waveProgram.branches.bsnake_flame;
    assert.equal(branch.phases.length, 7); assert.ok(branch.phases.every(ph => ph.length === 5));
    // hint.location mirrors the branch: phase k's tiles are hint group k.
    const tile = alias => { const d = flames.find(x => x.alias === alias); return `(${d.row},${d.col})`; };
    const hint = stage.enemies[id].talents.bbStr['hint.location'].split('_').map(g => g.split('|').sort().join('|'));
    assert.deepEqual(branch.phases.map(ph => ph.map(tile).sort().join('|')), hint);
    const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } }, { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
    for (let i = 0; i < 200; i++) b.step();
    assert.deepEqual(b.errors, []);
  });
