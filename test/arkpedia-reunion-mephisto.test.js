// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle } from './helpers/battleHarness.js';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { reunionMephistoNative, reunionMephistoParams } from '../shared/arkpedia/enemy-reunion-mephisto-features.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';

const id = 'enemy_1507_mephi', rec = records.enemies[id].levels[0], p = reunionMephistoParams(rec);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const dummy = { ...structuredClone(records.enemies.enemy_1007_slime.levels[0]), key: 'mephi-test-dummy', prefabKey: 'mephi-test-dummy' };
dummy.stats = { ...dummy.stats, maxHp: 10000, hpRecoveryPerSec: 10 };

function fixture() {
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 200, units: [],
    defs: { enemies: { [id]: structuredClone(rec), [dummy.key]: dummy } }, setup: installEnemyFeatures });
  const b = h.b; b.start();
  const e = b.spawnEnemy(id, { pos: [5, 5] }); b.addBuff(e, { key: 'hold', persist: true, flags: { noMove: true } });
  const allies = [[3, 3], [3, 4], [3, 6], [3, 7]].map(pos => { const u = b.spawnEnemy(dummy.key, { pos }); b.addBuff(u, { key: 'hold', persist: true, flags: { noMove: true } }); return u; });
  return { ...h, b, e, allies };
}

test('both levels are admitted; the Singer keeps her healaura', () => {
  assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features');
  for (const level of [0, 1]) assert.equal(reunionMephistoNative(records.enemies[id].levels[level], nativeComponents(native, id)), true, level);
  assert.equal(enemySupport(records.enemies.enemy_1514_smephi, clocks.prefabs, native).policy, 'stats-attacks-and-features');
  assert.deepEqual({ maxTargets: p.maxTargets, interval: p.interval, regenMul: p.regenMul }, { maxTargets: 3, interval: 6, regenMul: 2 });
});

test('no cast while nobody is hurt; then each heal goes to the three lowest-HP-ratio allies for ATK, on the 6 s clock', () => {
  const { b, e, run, allies } = fixture();
  run(2); assert.ok(!(e.skillAnimUntil > b.time), 'idle while nobody is hurt');
  for (const u of allies) u.mem.noRegen = true;
  const losses = [5000, 4000, 3000, 1000];
  allies.forEach((u, i) => { u.hp = u.s.maxHp - losses[i]; });
  const before = allies.map(u => u.hp);
  run(p.cast.hit + .05);
  const gained = allies.map((u, i) => u.hp - before[i]);
  // regen (2 x 10 HP/s) runs too; the heal is ATK on the three most hurt, not on the fourth
  for (const i of [0, 1, 2]) assert.ok(gained[i] >= rec.stats.atk - 1e-6 && gained[i] < rec.stats.atk + 40, `${i}: ${gained[i]}`);
  assert.ok(gained[3] < 40, `fourth: ${gained[3]}`);
  const t0 = b.time; let next = null;
  b.on('healed', c => { if (c.source === e && next == null) next = b.time; });
  run(8); assert.ok(next != null && next - t0 > p.interval - p.cast.hit - .3, `next heal ${next - t0}`);
  assert.deepEqual(b.errors, []);
});

test('HealAura doubles every allied enemy HP regeneration, field-wide, while Mephisto lives', () => {
  const { b, e, run, allies } = fixture();
  run(.2); for (const u of allies) assert.equal(u.s.hpRegen, 20, 'doubled');
  b.kill(e); run(.2); for (const u of allies) assert.equal(u.s.hpRegen, 10, 'lifted on death');
  assert.deepEqual(b.errors, []);
});

for (const sid of ['5-10', '5-10_challenge_mode'])
  test(`compiled ${sid}: Mephisto and Faust at their stage stats`, async () => {
    const { readFile } = await import('node:fs/promises');
    const { StandardBattle } = await import('../server/sim/arkpedia.js');
    const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
    const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
    const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
    const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
    const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
    const stage = await loader.load(manifest.stages.find(s => s.id === sid));
    const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
      { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
    const seen = {};
    while (!b.finished && b.time < 900 && !(seen[id] && seen.enemy_1508_faust)) {
      for (const x of b.enemies) if (x.alive) { if ([id, 'enemy_1508_faust'].includes(x.defId)) seen[x.defId] ??= x.s.maxHp; else if (x.defId !== 'trap_007_ballis') b.kill(x); }
      b.step();
    }
    assert.ok(seen[id] >= rec.stats.maxHp); assert.ok(seen.enemy_1508_faust >= records.enemies.enemy_1508_faust.levels[0].stats.maxHp);
    assert.ok(stage.waveProgram.branches.faust_ballis.phases.length >= 1);
    assert.deepEqual(b.errors, []);
  });
