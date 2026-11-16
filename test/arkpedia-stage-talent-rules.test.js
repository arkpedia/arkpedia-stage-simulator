// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import agentStage from '../data/arkpedia-stage-af-6.json' with { type: 'json' };
import spawnStage from '../data/arkpedia-stage-iw-ex-1.json' with { type: 'json' };
import records from '../data/arkpedia-enemy-records.json' with { type: 'json' };
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import { compileStage } from '../tools/arkpedia/build-stage.mjs';
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { applyStageEnemyTalentMultipliers } from '../shared/arkpedia/stage-enemy-talents.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const receiptFor = async id => (await loadStageRuleReceipt(root, id)).receipt;
const compile = (base, rules) => compileStage({ mvp, records, support, tokenData: { tokens: {} }, rules, geometry: base.geometry,
  source: { id: rules.stageId, code: base.code, name: base.name, stage_type: 'activity', battle: base.battle,
    variant: { kind: 'challenge_mode', of_stage_id: rules.parentStageId } } });
const battle = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: [defaultBuild(mvp.operators.char_123_fang)] });

test('AF-6 Challenge doubles the Agent Leader block-debuff duration without changing any normal or global record', async () => {
  const id = 'enemy_1049_eagent_2', before = structuredClone(records.enemies[id]);
  const stage = compile(agentStage, await receiptFor('af-6_challenge_mode')), b = battle(stage);
  const e = b.spawnEnemy(id, { pos: [0, 0] });
  const target = b.spawnDevice('fixture:target', 2, 2, { hp: 100000, blockCnt: 1 }); assert.ok(target);
  b.dealDamage(e, target, { amount: 1, type: 'true', isAttack: true });
  assert.equal(target.findBuff('ab:agentBlock').duration, 20);
  assert.equal(stage.enemies.enemy_1049_eagent?.talents.bb['ReduceBlockCnt.duration'], agentStage.enemies.enemy_1049_eagent?.talents.bb['ReduceBlockCnt.duration']);
  assert.deepEqual(records.enemies[id], before); assert.equal(agentStage.enemies[id].talents.bb['ReduceBlockCnt.duration'], 10);
  assert.deepEqual(b.errors, []);
});

test('IW-EX1 Challenge creates four of the selected parent’s fragments while other death-spawn families retain their counts', async () => {
  const stage = compile(spawnStage, await receiptFor('iw-ex-1_challenge_mode')), b = battle(stage);
  const id = 'enemy_1195_sfyin', parent = b.spawnEnemy(id, { pos: [0, 0] }); b.kill(parent, null);
  const child = stage.enemies[id].talents.bbStr['DeadSpawn.enemy_key'];
  assert.equal(b.enemies.filter(e => e.defId === child).length, 4);
  assert.equal(spawnStage.enemies[id].talents.bb['DeadSpawn.cnt'], 2);
  for (const other of Object.keys(stage.enemies).filter(k => k !== id))
    assert.deepEqual(stage.enemies[other].talents, spawnStage.enemies[other].talents);
  assert.deepEqual(b.errors, []);
});

test('stage talent scalars compose only on explicitly exposed numeric parameters', async () => {
  const rules = await receiptFor('af-6_challenge_mode'), row = rules.runes.find(r => r.key === 'enemy_talent_blackb_mul');
  rules.runes.push(structuredClone(row));
  assert.equal(compile(agentStage, rules).enemies.enemy_1049_eagent_2.talents.bb['ReduceBlockCnt.duration'], 40);
  const record = records.enemies.enemy_1195_sfyin.levels[0];
  for (const values of [{ 'DeadSpawn.enemy_key': 2 }, { 'DeadSpawn.cnt': .1 }, { 'Unknown.attack': 2 },
    { 'DeadSpawn.cnt': 11 }, { 'DeadSpawn.cnt': Infinity }, { 'DeadSpawn.cnt': -2 }])
    assert.throws(() => applyStageEnemyTalentMultipliers(record, values), /Unsupported enemy talent multiplier/);
  const wrong = await receiptFor('af-6_challenge_mode');
  wrong.runes.find(r => r.key === 'enemy_talent_blackb_mul').blackboard[1].key = 'ReduceBlockCnt.block_cnt';
  assert.throws(() => compile(agentStage, wrong), /Unsupported enemy talent multiplier/);
  wrong.runes.find(r => r.key === 'enemy_talent_blackb_mul').blackboard[0].valueStr = 'enemy_unknown';
  assert.throws(() => compile(agentStage, wrong), /Unsupported enemy talent rule target/);
});

test('additive cart damage changes only its declared fixed damage slot and rejects unreviewed mixed arithmetic', async () => {
  const { compileStageRules } = await import('../shared/arkpedia/stage-rules.js');
  const receipt = await receiptFor('ga-ex-5_challenge_mode');
  const rule = compileStageRules({ id: receipt.stageId, variant: { kind: 'challenge_mode', of_stage_id: receipt.parentStageId } }, receipt);
  const record = records.enemies.enemy_1218_bomscr_2.levels[0], key = 'boom.attack@s2mode_boom_atk';
  const result = applyStageEnemyTalentMultipliers(record, {}, rule.enemyTalentAddScoped[record.key]);
  assert.equal(result.talents.bb[key], 900); assert.equal(record.talents.bb[key], 550);
  assert.equal(result.talents.bb['boom.attack@s2mode_boom_atk_totrap'], 7500);
  for (const addition of [{ [key]: -550 }, { [key]: Infinity }, { 'boom.attack@s2mode_ep_fire_damage': 1 }, { Unknown: 1 }])
    assert.throws(() => applyStageEnemyTalentMultipliers(record, {}, addition), /Unsupported enemy talent addition/);
  assert.throws(() => applyStageEnemyTalentMultipliers(record, { [key]: 2 }, { [key]: 350 }), /mixed enemy talent arithmetic/);
});
