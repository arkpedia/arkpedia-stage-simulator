// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContentContext, planStage } from '../tools/arkpedia/content-inventory.mjs';
import { compileStageEnemyAlias } from '../tools/arkpedia/stage-enemy-aliases.mjs';
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { readOriginalLevel } from '../tools/arkpedia/original-level.mjs';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import { enemyModelKey } from '../shared/arkpedia/facing.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const c = await loadContentContext(), { receipt } = await loadStageRuleReceipt(c.root, 'bh-6');
const { level } = await readOriginalLevel(c.root, receipt), ref = level.enemyDbRefs.find(r => r.useDb === false);
const id = ref.id, base = ref.overwrittenData.prefabKey.m_value;

test('original Sponsor aliases keep their own complete stats/reward while reusing the reviewed prefab behavior and artwork', () => {
  const before = structuredClone(c.records.enemies[base]), input = structuredClone(ref);
  const { record, decision } = compileStageEnemyAlias(ref, c.records, c.support);
  assert.equal(decision.policy, 'stats-attacks-and-features');
  assert.equal(record.stats.maxHp, 10000); assert.equal(record.stats.res, 40); assert.equal(record.stats.motion, 'FLY');
  assert.equal(record.talents.bb['loot.cnt'], 4); assert.equal(record.talents.bbStr['loot.token_key'], 'trap_019_electric');
  assert.equal(enemyModelKey(id, record), enemyModelKey(base, before.levels[0]));
  assert.deepEqual(c.records.enemies[base], before); assert.deepEqual(ref, input); assert.equal(c.records.enemies[id], undefined);
  const data = { enemies: { [id]: record }, stage: { enemyAliases: { [id]: base }, geometry: { waves: [{ spawns: [{ enemy_id: id }] }] } } };
  assert.doesNotThrow(() => assertRegularEnemies(data));
  for (const change of [r => r.abilities.pop(), r => r.talents.bb['loot.cnt'] = -1, r => r.talents.bb.unknown = 1,
    r => r.talents.bbStr['loot.token_key'] = 'char_123_fang', r => r.stats.motion = 'WALK', r => r.assetPrefabKey = 'enemy_other']) {
    const changed = structuredClone(data); change(changed.enemies[id]); assert.throws(() => assertRegularEnemies(changed), /Unsupported stage-local/);
  }
});

test('a supply alias cannot hide a new skill, malformed reward, duplicate definition, or different motion', () => {
  for (const change of [d => d.skills = [{ prefabKey: 'new' }], d => d.talentBlackboard.pop(),
    d => d.talentBlackboard.push(d.talentBlackboard[0]), d => d.talentBlackboard[1].value = -3,
    d => d.talentBlackboard[1].key = 'unknown', d => d.motion = { m_defined: true, m_value: 'WALK' }]) {
    const changed = structuredClone(ref); change(changed.overwrittenData);
    assert.throws(() => compileStageEnemyAlias(changed, c.records, c.support));
  }
});

test('BH-6 variants use the same alias delivery once; the challenge adds 40 RES to every enemy without changing the source', async () => {
  const normal = await planStage(c, 'bh-6'), challenge = await planStage(c, 'bh-6_challenge_mode');
  assert.deepEqual(normal.blockers, []); assert.deepEqual(challenge.blockers, []);
  for (const [key, record] of Object.entries(normal.stage.enemies)) {
    assert.equal(challenge.stage.enemies[key].stats.res, record.stats.res + 40);
    assert.equal(challenge.stage.enemies[key].stats.maxHp, record.stats.maxHp * 1.1);
  }
  for (const plan of [normal, challenge]) {
    const b = new StandardBattle({ ...c.mvp, stage: plan.stage, enemies: { ...c.mvp.enemies, ...plan.stage.enemies } }, { operators: [defaultBuild(c.mvp.operators.char_123_fang)] });
    b.setViewport('fullscreen-workspace'); b.autoFinish = false; b.life = 1e6;
    const e = b.spawnEnemy(id, { pos: [2, 3] }); assert.equal(e.counted, false); assert.equal(e.isFlying, true);
    b.kill(e); for (let i = 0; i < 35; i++) b.step();
    assert.equal(b.mvpStageTokens.get('trap_019_electric'), 4); assert.equal(b.killed, 0); assert.deepEqual(b.errors, []);
  }
});

test('the original 60-second Cheering Drone alias extends the shared buff duration without stacking modifiers or copying assets', async () => {
  const { receipt } = await loadStageRuleReceipt(c.root, 'isw-df_level_obt_roguelike_ro3_level_rogue3_b-4');
  const { level } = await readOriginalLevel(c.root, receipt), ref = level.enemyDbRefs.find(r => r.id === 'enemy_1106_byokai_b');
  const { record } = compileStageEnemyAlias(ref, c.records, c.support);
  assert.equal(record.talents.bb['buff.duration'], 60);
  assert.equal(c.records.enemies.enemy_1106_byokai.levels[0].talents.bb['buff.duration'], 20);
  const { makeBattle, chessRec } = await import('./helpers/battleHarness.js');
  const { installEnemyFeatures } = await import('../server/sim/content/arkpedia-enemy-features.js');
  const guard = chessRec({ id: 'alias-target', stats: { maxHp: 100000, atk: 0, def: 200 }, skill: null });
  const h = makeBattle({ content: 'none', autoFinish: false, timeLimit: 180,
    defs: { chess: { [guard.chessId]: guard }, enemies: { [ref.id]: record } }, units: [{ chessId: guard.chessId, row: 9, col: 6 }],
    setup: b => installEnemyFeatures(b) });
  const b = h.b; b.start(); const target = b.allyUnits[0];
  const kill = () => b.kill(b.spawnEnemy(ref.id, { pos: [9, 8] }));
  kill(); const buff = target.findBuff('ab:cheeringDrone'); assert.equal(buff.timeLeft, 60); assert.equal(target.s.def, 300); assert.equal(target.s.aspd, 200);
  h.run(10); const remaining = buff.timeLeft; kill();
  assert.equal(target.findBuff('ab:cheeringDrone'), buff); assert.equal(buff.timeLeft, remaining + 60);
  assert.equal(target.s.def, 300); assert.equal(target.s.aspd, 200); assert.equal(b.killed, 0);
  h.run(110.1); assert.equal(target.findBuff('ab:cheeringDrone'), null); assert.deepEqual(b.errors, []);
  for (const change of [d => d.talentBlackboard[0].value = 600, d => d.attributes.spRecoveryPerSec.m_value = 10,
    d => d.spData.maxSp = 1, d => d.attributes.silenceImmune.m_value = false]) {
    const changed = structuredClone(ref); change(changed.overwrittenData);
    assert.throws(() => compileStageEnemyAlias(changed, c.records, c.support));
  }
});
