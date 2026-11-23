// SPDX-License-Identifier: GPL-3.0-or-later
// H7-4: Patriot (level 1, a sparse level read over level zero) with the stage's 30 s revive, and a dangling
// frstar_frosts branch whose Ice Crystal aliases name nothing in the level (a native no-op).
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };

const id = 'enemy_1506_patrt';
async function load() {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const entry = manifest.stages.find(s => s.id === 'h7-4'); assert.equal(entry.availability, 'available');
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(entry);
  return { stage, b: new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 }) };
}

test('compiled H7-4: the 30 s revive overrides level 1, which keeps its own Immo[Rage] over level zero', async () => {
  const { stage } = await load();
  const r = stage.enemies[id], level1 = records.enemies[id].levels[1];
  assert.equal(r.talents.bb['reborn.duration'], 30);
  assert.deepEqual(r.skills.map(s => s.prefabKey), ['Immo[Rage]', 'throwspear[Rage]', 'immo_trigger[reborning]']);
  assert.deepEqual(r.skills[0], level1.skills[0], "level 1's own Immo[Rage]");
  assert.equal(r.skills[2].bb.duration, 30);
  assert.equal(stage.waveProgram.branches.frstar_frosts.spawns.length, 0, 'the dangling crystal branch is a no-op');
});

test('compiled H7-4: Patriot stands up from his first knock-out after 30 s, not 60', async () => {
  const { b } = await load();
  let p = null, koAt = null, back = null;
  while (!b.finished && b.time < 900 && back == null) {
    for (const x of b.enemies) if (x.alive && x.defId !== id) b.kill(x);
    const f = b.enemies.find(x => x.alive && x.defId === id);
    if (f && !p) { p = f; b.addBuff(f, { key: 'test:hold', persist: true, flags: { noMove: true } }); }
    if (p && koAt == null && b.time > p.mem.testSeen + 1) { b.dealDamage(null, p, { amount: 1e9, type: 'true' }); koAt = b.time; }
    if (p && p.mem.testSeen == null) p.mem.testSeen = b.time;
    if (koAt != null && p.hp > p.s.maxHp * .99) back = b.time;
    b.step();
  }
  assert.ok(koAt != null && back != null, 'knocked out and back');
  assert.ok(Math.abs(back - koAt - 30) < .3, `revive took ${back - koAt}`);
  assert.deepEqual(b.errors, []);
});
