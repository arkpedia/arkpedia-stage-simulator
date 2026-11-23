// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import clocks from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { heraldNative, heraldParams } from '../shared/arkpedia/enemy-herald-features.js';

const ids = ['enemy_1438_dspred', 'enemy_1438_dspred_2'];
const rec = id => records.enemies[id].levels[0];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('both Heralds are admitted only with their pinned devour chain; the Hoarder keeps skill:0', () => {
  for (const id of ids) {
    assert.equal(enemySupport(records.enemies[id], clocks.prefabs, native).policy, 'stats-attacks-and-features', id);
    assert.equal(heraldNative(rec(id), nativeComponents(native, id)), true, id);
  }
  assert.equal(enemySupport(records.enemies.enemy_1436_dsdivi, clocks.prefabs, native).policy, 'stats-attacks-and-features');
  const changed = structuredClone(native);
  changed.templates['dspred_tr_1[kill]'].eventToActions.ON_BUFF_START[0]._buffKeys = ['other_passive'];
  assert.equal(enemySupport(records.enemies[ids[0]], clocks.prefabs, changed).policy, null, 'carapace check');
  const r = rec(ids[0]);
  assert.equal(heraldNative({ ...r, skills: [r.skills[0], { ...r.skills[1], bb: { maxhp: 1, atk: .4 } }] }, nativeComponents(native, ids[0])), false);
});

async function bp5() {
  const { readFile } = await import('node:fs/promises');
  const { StandardBattle } = await import('../server/sim/arkpedia.js');
  const { createStageLibraryLoader } = await import('../shared/arkpedia/stage-library.js');
  const { defaultBuild } = await import('../shared/arkpedia/loadout.js');
  const mvp = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
  const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
  const stage = await loader.load(manifest.stages.find(s => s.id === 'bp-5'));
  const b = new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
    { operators: [{ ...defaultBuild(mvp.operators.char_151_myrtle) }] }, { seed: 1 });
  return { b, stage };
}

test('compiled BP-5: its Excrescent Carapaces carry their original instances and stand on the field', async () => {
  const { b, stage } = await bp5();
  const placed = stage.devices.filter(d => d.key === 'trap_156_dsshell');
  assert.ok(placed.length >= 1 && placed.every(d => Number.isSafeInteger(d.instance?.level) && d.instance.skillLevel === 1));
  b.step();
  assert.equal(b.units.filter(u => u.alive && u.defId === 'trap_156_dsshell').length, placed.length);
  assert.deepEqual(b.errors, []);
});

test('compiled BP-5: a Herald reaching a Carapace eats it after the 2.6 s Skill clip and gains 70% max HP and 40% ATK, once', async () => {
  const { b } = await bp5();
  let herald = null;
  const clear = () => { for (const e of b.enemies) if (e.alive && e.defId !== ids[0]) b.kill(e); };
  while (!b.finished && b.time < 900 && !herald) { clear(); herald = b.enemies.find(e => e.alive && e.defId === ids[0]); b.step(); }
  assert.ok(herald); assert.equal(herald.s.maxHp, 13200); assert.equal(herald.s.atk, 1050);
  const carapace = b.units.find(u => u.alive && u.defId === 'trap_156_dsshell');
  assert.ok(carapace);
  herald.x = carapace.x - .4; herald.y = carapace.y; herald.tileR = carapace.tileR; herald.tileC = Math.round(herald.x);
  b.addBuff(herald, { key: 'test:hold', persist: true, flags: { noMove: true } });
  const p = heraldParams(rec(ids[0]));
  const until = b.time + p.cast.dur + .3; while (!b.finished && b.time < until) { clear(); b.step(); }
  assert.equal(carapace.alive, false, 'eaten');
  near(herald.s.maxHp, 13200 * 1.7); near(herald.s.atk, 1050 * 1.4);
  assert.ok(herald.findBuff('dspred_tr_1[mark]'));
  assert.deepEqual(b.errors, []);
});
