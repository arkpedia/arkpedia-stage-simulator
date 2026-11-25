// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const SQUAD = ['char_151_myrtle', 'char_123_fang', 'char_240_wyvern', 'char_122_beagle', 'char_124_kroos', 'char_120_hibisc', 'char_208_melan'];
const battle = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: SQUAD.map(k => defaultBuild(mvp.operators[k])) }, { seed: 1 });

test('cbuff_max_cost: the DP cap starts at max_cost and may rise only to max_cost_ceil', async () => {
  const receipt = (await loadStageRuleReceipt(root, 'tr-22')).receipt;
  const source = { id: receipt.stageId, battle: { ...mvp.stage.battle } };
  const compiled = compileStageRules(source, receipt);
  assert.deepEqual([compiled.battle.max_dp, compiled.battle.max_dp_ceil], [20, 99]);
  for (const change of [r => r.blackboard[0].value = 100, r => r.blackboard[1].value = 1.5, r => r.blackboard.pop(),
    r => r.blackboard.push({ key: 'scale', value: 1, valueStr: null })]) {
    const bad = structuredClone(receipt); change(bad.runes.find(r => r.key === 'cbuff_max_cost'));
    assert.throws(() => compileStageRules(source, bad), /Unsupported|Invalid/);
  }
});

test('the published chapter-12 stages are available with the sight environment and their DP ceiling', async () => {
  // First slice (Pathfinder Spy, Norport Civilian), then the Sentry Spies and the Pathfinder Spy _2.
  const ids = ['12-2', '12-2_adverse_environment', '12-6', '12-8', '12-8_adverse_environment', '12-17', '12-17_adverse_environment', 'tr-22', 'tr-23',
    '12-3', '12-3_adverse_environment', '12-4', '12-4_adverse_environment', '12-6_adverse_environment', '12-7', '12-10', '12-10_adverse_environment',
    '12-12', '12-12_adverse_environment', '12-13', '12-14', '12-14_adverse_environment', '12-18', '12-18_adverse_environment',
    // Armed Spies and the elite civilian.
    '12-5', '12-5_adverse_environment', '12-7_adverse_environment', '12-9', '12-9_adverse_environment', '12-13_adverse_environment',
    '12-15', '12-15_adverse_environment', '12-19', '12-19_adverse_environment', 'h12-2_adverse_environment',
    // Eblana and the 12-16 'Damazti Cluster'.
    '12-16'];
  for (const id of ids) {
    const stage = await load(id);
    assert.deepEqual(stage.environment?.filter(e => e.kind === 'mainline12_sightManager'), [{ kind: 'mainline12_sightManager', interval: .5 }], id);
    // Every level's cbuff_max_cost is 20 / 99, except 12-5 and 12-18 adverse (15 / 99).
    assert.deepEqual([stage.battle.max_dp, stage.battle.max_dp_ceil], [['12-5_adverse_environment', '12-18_adverse_environment'].includes(id) ? 15 : 20, 99], id);
  }
  const b = battle(await load('tr-22'));
  assert.equal(typeof b.stageSight?.inSight, 'function');
  assert.deepEqual([b.flags.dpMax, b.flags.dpMaxCeil], [20, 99]);
  // 12-20, its adverse variant and H12-1 adverse (the 'Damazti Cluster'): test/arkpedia-damazti.test.js.
});

test('12-16: Eblana makes disguised units switch, and she and the Damazti Clusters walk out before wave 1', async () => {
  const b = battle(await load('12-16'));
  b.life = 999;
  const tag = e => e.defId.replace(/^enemy_\d+_/, '');
  const reveals = [], gone = new Map(), clusters = [];
  let eblana = null, wave1 = null;
  b.on('enemySpawn', ev => {
    const e = ev.enemy ?? ev;
    if (tag(e) === 'wdncr') eblana = e;
    if (tag(e) === 'wdslms') clusters.push(e);
    if (wave1 == null && /duskls|wdgyht|wdpjd|wdexg/.test(e.defId)) wave1 = b.time;
  });
  const leaks = [];
  b.on('enemyLeak', ({ enemy }) => leaks.push([tag(enemy), b.life]));
  b.on('identityRevealed', ev => reveals.push([+b.time.toFixed(1), tag(ev.enemy), eblana?.mem.ab.list.find(x => x.eblana)?.cast?.clip ?? null]));
  while (!b.finished && b.time < 300) {
    b.step();
    for (const e of [eblana, ...clusters]) if (e && !e.alive && !gone.has(e)) gone.set(e, b.time);
    if (eblana?.alive) {
      // Always INVINCIBLE and BLOCK_FREE; she never attacks an operator.
      assert.equal(eblana.s.flags.invulnerable && eblana.s.flags.unblockable, true);
      assert.equal(eblana.profile.noAttack, true);
    }
    for (const c of clusters) if (c.alive && c.mem.ab.list.find(x => x.norportIdentity)?.state === 'revealed')
      assert.deepEqual([!!c.s.flags.invulnerable, !!c.s.flags.unblockable, c.profile.noAttack, !!c.blockedBy], [true, true, true, false]);
  }
  // Her Attack_b reveals one disguised spy in range at its OnAttack (0.5 s); her database attackSpeed 0 under the
  // ASPD floor of 20 gives 2.5 x 100 / 20 = 12.5 s between attacks. She spawns at 3 s.
  const byAttack = reveals.filter(r => r[2] === 'Attack_b');
  assert.deepEqual(byAttack.slice(0, 3).map(r => r[0]), [3.5, 16, 28.5]);
  // detectAll: initCooldown 92 s, then Skill_b_3's OnAttack at 9.2 s reveals every disguised unit on the map at once.
  const byAll = reveals.filter(r => r[2] === 'Skill_b_3');
  assert.deepEqual([...new Set(byAll.map(r => r[0]))], [104.2]);
  assert.deepEqual(byAll.filter(r => r[1] === 'wdslms').length, 3);
  assert.equal(reveals.some(r => r[1] === 'wdfmr' && r[2] != null), false, 'civilians are never her targets');
  // All four walk out (life cost 0) and wave 1 spawns afterwards.
  assert.equal(gone.size, 4);
  assert.ok(wave1 > Math.max(...gone.values()), `wave 1 at ${wave1}`);
  const bosses = leaks.filter(l => ['wdncr', 'wdslms'].includes(l[0]));
  assert.equal(bosses.length, 4, 'all four reach the exit');
  for (const e of [eblana, ...clusters]) assert.equal(e.lpr ?? e.def.lpr, 0);
});

test('placed enemy-side objects hold neither a kill-all wave nor the battle (12-8 wave 0, TR-18)', async () => {
  const stage = await load('12-8'), b = battle(stage);
  b.setViewport('fullscreen-workspace'); b.life = 999;
  b.step();
  const placed = b.enemies.filter(e => e.alive && e.mem.stageUnitDevice);
  assert.ok(placed.length >= 5, 'the Reserves are on the field');
  for (const e of placed) assert.equal(e.profile.holdsBattle, false);
  const tr18 = battle(await load('tr-18'));
  tr18.setViewport('fullscreen-workspace'); tr18.life = 999;
  while (!tr18.finished && tr18.time < 300) tr18.step();
  assert.equal(tr18.finished, true, `TR-18 ends (was stalled behind its placed objects) at ${tr18.time}`);
  assert.equal(tr18.reason, 'cleared');
});
