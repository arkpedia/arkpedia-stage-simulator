// SPDX-License-Identifier: GPL-3.0-or-later
// Talulah, the Fighter and the neutral-mark shooters (shared/arkpedia/enemy-talulah-fighter-features.js,
// server/sim/content/arkpedia-enemy-talulah-fighter.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { talulahFighterNative, talulahFighterParams, patrolCaptainNative, patrolCaptainParams, NEUTRAL_MARK }
  from '../shared/arkpedia/enemy-talulah-fighter-features.js';
import { canTargetEnemy, aggroCmp } from '../server/sim/targeting.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const FIGHTER = 'enemy_3002_ftrtal', SHOOTERS = ['enemy_1107_uoffcr', 'enemy_1107_uoffcr_2', 'enemy_1111_ucommd', 'enemy_1111_ucommd_2'];
const record = id => Object.values(ENEMY_RECORDS.enemies[id].levels)[0];
const battle = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
const until = (b, pred, limit = 600) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };
const fighterOf = b => b.neutralUnits.find(u => u.alive && u.defId === FIGHTER);

test('the Fighter and the four neutral-mark shooters are pinned; changes are refused', () => {
  const f = record(FIGHTER), n = nativeComponents(native, FIGHTER);
  assert.equal(talulahFighterNative(f, n), true);
  assert.equal(talulahFighterNative({ ...f, talents: { ...f.talents, bb: { ...f.talents.bb, 'dead.value': -1 } } }, n), false, 'a changed life cost');
  assert.equal(talulahFighterNative({ ...f, stats: { ...f.stats, rangeRadius: 2 } }, n), false, 'a changed range');
  assert.equal(talulahFighterNative(f, nativeComponents(native, 'enemy_1503_talula')), false, 'the boss tree is not hers');
  const p = talulahFighterParams(f);
  assert.deepEqual([p.radius, p.shot.scale, p.shot.speed, p.shot.anim.dur, p.shot.anim.hit, p.half.ratio, p.half.defPct, p.half.resPct, p.lifeOnDeath],
    [1.5, 1, 10, 2, 1, .5, .5, .5, -2]);
  const breath = p.skills.find(s => s.key === 'DragonFire');
  assert.deepEqual([breath.cooldown, breath.initial, breath.base, breath.add, breath.ramp, breath.duration], [20, 20, 200, 200, 20, 30.5]);
  assert.equal(p.skills.find(s => s.key === 'DragonFire[Half]').cooldown, 10);
  for (const id of SHOOTERS) {
    const r = record(id);
    assert.equal(patrolCaptainNative(r, nativeComponents(native, id)), true, id);
    assert.deepEqual([patrolCaptainParams(r).radius, patrolCaptainParams(r).mark], [1.2, NEUTRAL_MARK]);
  }
  assert.equal(patrolCaptainNative(record(SHOOTERS[0]), nativeComponents(native, SHOOTERS[2])), false, 'another tree');
});

test('in R8-3 the Fighter is a neutral, uncounted, unblockable route actor; she and the Captains fight each other', async () => {
  for (const id of ['r8-3_challenge_mode', 'r8-8', 'r8-8_challenge_mode']) await load(id);
  const b = battle(await load('r8-3'));
  b.life = 999;
  assert.ok(until(b, () => fighterOf(b)));
  const f = fighterOf(b);
  assert.deepEqual([f.side, f.counted, f.profile.holdsBattle, !!f.s.flags.unblockable, f.def.immune.has('sleep'), !!f.findBuff(NEUTRAL_MARK)],
    ['neutral', false, false, true, true, true]);
  assert.equal(canTargetEnemy(b.allyUnits[0] ?? { side: 'ally' }, f, { canHitFly: true }), false, 'operators never select her');
  const hits = [];
  b.on('damaged', c => { if (c.source?.defId === FIGHTER || c.target?.defId === FIGHTER) hits.push({ t: b.time, src: c.source?.defId, tgt: c.target.defId, side: c.target.side, type: c.type, tag: c.dmg?.tags?.[0] }); });
  until(b, () => hits.some(h => h.tag === 'periodic') && hits.some(h => h.tag === 'neutralShot'), 120);
  const out = hits.filter(h => h.src === FIGHTER), inn = hits.filter(h => h.tgt === FIGHTER);
  assert.ok(out.length && out.every(h => h.side === 'enemy'), 'she only hits enemies');
  assert.ok(out.some(h => h.tag === 'talulahFighterShot' && h.type === 'arts'));
  assert.ok(out.some(h => h.tag === 'periodic' && h.type === 'true'), 'Burning Breath');
  assert.ok(inn.length && inn.every(h => h.tag === 'neutralShot' && h.type === 'phys' && /uoffcr|ucommd/.test(h.src)), 'only the neutral-mark shots reach her');
});

test('killing her costs 2 life points; her exit costs none; the battle never waits for her', async () => {
  const stage = await load('r8-3');
  let b = battle(stage);
  b.life = 10;
  until(b, () => fighterOf(b));
  let f = fighterOf(b);
  b.dealDamage(null, f, { amount: 1e7, type: 'true', sourceless: true });
  assert.equal(f.alive, false);
  assert.equal(b.life, 8);

  b = battle(stage); b.life = 10;
  until(b, () => fighterOf(b));
  f = fighterOf(b);
  b.leak(f);
  assert.equal(f.alive, false);
  assert.equal(b.life, 10);

  // Every counted enemy dies on arrival: the battle is won while she may still walk.
  b = battle(stage); b.life = 10;
  b.on('enemySpawn', ({ enemy: e }) => { if (e.counted) b.dealDamage(null, e, { amount: 1e7, type: 'true', sourceless: true }); });
  until(b, () => b.finished, 900);
  assert.equal(b.reason, 'cleared');
  assert.ok(b.life > 0);
});

test('in R8-8 the Crossbowmen and the Targeteers take her: ranged selectors include her, and crossbowmen prefer her at equal taunt', async () => {
  const b = battle(await load('r8-8'));
  b.life = 999;
  const hits = [];
  b.on('damaged', c => { if (c.target?.defId === FIGHTER) hits.push({ src: c.source?.defId ?? null, tag: c.dmg?.tags?.[0] ?? null, type: c.type }); });
  assert.ok(until(b, () => hits.some(h => /uabone/.test(h.src ?? '')) && hits.some(h => h.tag === 'shell'), 200));
  // Equal taunt (0): a Crossbowman with both her and a deployed operator in range picks her.
  const f = fighterOf(b), cb = b.enemies.find(e => e.defId.startsWith('enemy_1109_uabone'));
  assert.ok(f && cb, 'both on the field');
  const op = { alive: true, deployed: true, findBuff: () => null, s: { taunt: 0 }, aggroSeq: 99, deploySeq: 99 };
  assert.deepEqual([op, f].sort((x, y) => aggroCmp(x, y, cb.profile.sameTauntPriority))[0], f, 'equal taunt: the marked Fighter first');
  op.s.taunt = 1;
  assert.deepEqual([op, f].sort((x, y) => aggroCmp(x, y, cb.profile.sameTauntPriority))[0], op, 'higher taunt still wins');
  let atDeath = null;
  b.on('death', ({ unit }) => { if (unit === f) atDeath = b.life; }, { priority: -1000 });
  const before = []; b.on('death', ({ unit }) => { if (unit === f) before.push(b.life); }, { priority: 1000 });
  assert.ok(until(b, () => !f.alive, 400), 'she falls with no operator to protect her');
  assert.equal(before[0] - atDeath, 2, 'her death costs exactly 2');
});
