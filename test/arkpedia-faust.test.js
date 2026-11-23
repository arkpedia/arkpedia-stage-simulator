// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { faustNative, faustParams } from '../shared/arkpedia/enemy-faust-features.js';

const id = 'enemy_1508_faust';

test('Faust is admitted at both levels with the shared kit; Rusthammer keeps its Arts bolt', () => {
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features');
  for (const level of [0, 1]) assert.equal(faustNative(records.enemies[id].levels[level], nativeComponents(native, id)), true, level);
  assert.equal(enemySupport(records.enemies.enemy_2006_flsnip, clocks.prefabs, native).policy, 'stats-attacks-and-features');
  const p0 = faustParams(records.enemies[id].levels[0]), p1 = faustParams(records.enemies[id].levels[1]);
  assert.deepEqual([p0.criticalType, p0.scale, p0.summon.branch, p0.summon.cooldown, p0.summon.initial], ['phys', 2, 'faust_ballis', 30, 15]);
  assert.deepEqual([p1.scale, p1.summon.cooldown, p1.summon.initial, p1.invincible], [2.5, 45, 1, 120]);
  const shot = structuredClone(native);
  for (const row of shot.projectiles.projectile_faust_s1) row.originalJson = row.originalJson.replace('"_speed":10.0', '"_speed":5.0');
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, shot).policy, null, 'another bolt speed');
});

async function battle(stageId) {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const entry = manifest.stages.find(s => s.id === stageId); assert.equal(entry.availability, 'available');
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(entry);
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  return { b, stage };
}
const ballistae = b => b.units.filter(u => u.alive && u.defId === 'trap_007_ballis');
// Keep Faust alive and on the field: clear every other enemy, freeze his walk so he never leaks.
function run(b, until, onStep = () => {}) {
  while (!b.finished && b.time < until) {
    for (const e of b.enemies) if (e.alive && e.defId !== id && e.defId !== 'trap_007_ballis') b.kill(e);
    const f = b.enemies.find(e => e.alive && e.defId === id);
    if (f && !f.findBuff('test:hold')) b.addBuff(f, { key: 'test:hold', persist: true, flags: { noMove: true } });
    onStep(f); b.step();
  }
}

test('compiled 6-7: invincible for the overridden 60 s; one SummonBallis at 90 s raises the five hidden Turrets, once', async () => {
  const { b, stage } = await battle('6-7');
  const hidden = stage.devices.filter(d => d.key === 'trap_007_ballis');
  assert.equal(hidden.length, 5); assert.ok(hidden.every(d => d.hidden && d.branchActivated));
  let faust = null, spawnedAt = null, invincibleUntil = null;
  run(b, 400, f => { if (f && !faust) { faust = f; spawnedAt = b.time; } if (f?.s.flags.invulnerable) invincibleUntil = b.time; if (faust && b.time > spawnedAt + 150) b.finished = true; });
  assert.ok(faust, 'Faust spawns'); assert.ok(invincibleUntil - spawnedAt < 60.2 && invincibleUntil - spawnedAt > 59.8, `${invincibleUntil - spawnedAt}`);
  assert.equal(ballistae(b).length, 5, 'five Turrets after the single cast');
  assert.deepEqual(b.errors, []);
});

test('compiled h5-4: level-1 Faust advances faust_ballis one phase per 45 s cast, and stops casting once it is spent', async () => {
  const { b, stage } = await battle('h5-4');
  const phases = stage.waveProgram.branches.faust_ballis.phases, total = phases.flat().length;
  let faust = null, spawnedAt = null, inCast = false; const counts = [], casts = [];
  const end = () => spawnedAt + 45 * phases.length + 60;
  run(b, 2000, f => {
    if (f && !faust) { faust = f; spawnedAt = b.time; }
    if (!faust) return;
    counts.push([b.time - spawnedAt, ballistae(b).length]);
    const casting = f?.mem.regularFormVisual?.clip === 'Skill_2';
    if (casting && !inCast) casts.push(b.time - spawnedAt); inCast = casting;
    if (b.time > end()) b.finished = true;
  });
  assert.ok(faust);
  const at = t => counts.filter(([dt]) => dt <= t).at(-1)?.[1] ?? 0;
  assert.equal(at(1.5), 0, 'not before the first cast event'); // initial 1 s + 0.9 s event
  assert.equal(at(3), phases[0].length);
  assert.equal(at(45.5), phases[0].length, 'second phase waits for the 45 s cooldown');
  assert.equal(at(48), phases[0].length + phases[1].length);
  assert.equal(counts.at(-1)[1], total, 'every phase raised');
  assert.equal(casts.length, phases.length, `one cast per phase, none once spent: ${casts.map(t => t.toFixed(1))}`);
  assert.deepEqual(b.errors, []);
});
