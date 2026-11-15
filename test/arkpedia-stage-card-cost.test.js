// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { summonUnitId } from '../shared/arkpedia/summons.js';
import { PROFESSION_BITS, stageCardMultiplier } from '../shared/arkpedia/stage-card-rules.js';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { stageCardBaseCost, stageSummonCost } from '../server/sim/content/arkpedia-stage-card-cost.js';
import { regularSummonCards, deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
const rule = (professionMask = 1023, buildableMask = 3, scale = 3) => ({ allyCards: [{ attribute: 'cost', professionMask, buildableMask, scale }] });
function fixture(ids, rules = rule()) {
  const d = { ...data, stage: structuredClone(data.stage) };
  d.stage.rules = rules; d.stage.geometry.waves.forEach(w => w.spawns = []); d.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(d, { operators: ids.map(id => defaultBuild(d.operators[id])) });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99); return b;
}
test('original named and combined profession masks compile without broadening the scope', async () => {
  for (const [id, professionMask, buildableMask, scale] of [
    ['0-7_challenge_mode', 1, 3, 3], ['2-5_challenge_mode', 3, 3, 2],
    ['bw-2_challenge_mode', 68, 3, 2], ['0-11_challenge_mode', 1023, 1, 3], ['gt-hx-3_challenge_mode', 256, 3, 3],
  ]) {
    const { receipt } = await loadStageRuleReceipt(process.cwd(), id);
    const compiled = compileStageRules({ id: receipt.stageId, variant: { kind: 'challenge_mode', of_stage_id: receipt.parentStageId } }, receipt);
    assert.deepEqual(compiled.allyCards, rule(professionMask, buildableMask, scale).allyCards);
    for (const [profession, bit] of Object.entries(PROFESSION_BITS)) for (const [position, positionBit] of [['MELEE', 1], ['RANGED', 2], ['ALL', 3]])
      assert.equal(stageCardMultiplier(compiled, { profession, position }, 'cost'), (professionMask & bit) && (buildableMask & positionBit) ? scale : 1);
  }
});
test('stage initial cost precedes redeployment rounding, leaves source stats intact and drives refund', () => {
  const id = 'char_123_fang', b = fixture([id], rule(512, 3, 3));
  const raw = b.data.getChess(id).stats.cost, cost = stageCardBaseCost(b, b.data.getChess(id));
  assert.equal(cost, b.stageInitialCosts.get(id) * 3 + raw - b.stageInitialCosts.get(id));
  assert.equal(b.cost(id), cost);
  const dp = b.dp, u = b.deployOperator(id, 3, 3, 'RIGHT');
  assert.equal(b.dp, dp - cost); assert.equal(u.base.cost, cost);
  const paid = b.dp; b.retreatOperator(id); assert.equal(b.dp, paid + Math.floor(cost / 2));
  assert.equal(b.cost(id), Math.floor(cost * 1.5)); assert.equal(b.data.getChess(id).stats.cost, raw);
  assert.deepEqual(b.errors, []);
});
test('profession-specific cost affects the operator and does not inherit onto its TOKEN summon', () => {
  const id = 'char_110_deepcl', b = fixture([id], rule(PROFESSION_BITS.SUPPORT));
  b.deployOperator(id, 3, 2, 'RIGHT'); const card = regularSummonCards(b)[0];
  assert.equal(card.record.profession, 'TOKEN'); assert.equal(card.cost, 5);
  const dp = b.dp; deployRegularSummon(b, card.key, 3, 3); assert.equal(b.dp, dp - 5); assert.deepEqual(b.errors, []);
});
for (const id of ['char_110_deepcl', 'char_2023_ling', 'char_248_mgllan', 'char_4123_ela', 'char_4072_ironmn']) {
  test(`${id}: summon card, affordability, payment and refund use one stage-adjusted cost`, () => {
    const b = fixture([id]); b.deployOperator(id, 3, 2, 'RIGHT'); b.addDp('arkpedia', 99);
    const card = regularSummonCards(b)[0]; assert.ok(card, id);
    const raw = card.record.stats.cost; assert.ok(raw > 0); assert.equal(card.cost, raw * 3);
    let spot;
    for (let r = 0; r < b.grid.rows && !spot; r++) for (let c = 0; c < b.grid.cols && !spot; c++)
      if (!summonPlacementError(b, card.key, r, c)) spot = [r, c];
    assert.ok(spot, id);
    b.getPlayer('arkpedia').dp = card.cost - 1; assert.equal(summonPlacementError(b, card.key, ...spot), 'Not enough DP.');
    b.getPlayer('arkpedia').dp = 99; const token = deployRegularSummon(b, card.key, ...spot, 'RIGHT');
    assert.equal(b.dp, 99 - card.cost); assert.equal(card.record.stats.cost, raw);
    if (card.config.refundRatio > 0) { const paid = b.dp; retreatRegularSummon(b, summonUnitId(token)); assert.equal(b.dp, paid + Math.floor(card.cost * card.config.refundRatio)); }
    assert.deepEqual(b.errors, []);
  });
}
test('unknown masks and malformed costs refuse admission; inactive NONE rules do not alter either difficulty', async () => {
  const { receipt } = await loadStageRuleReceipt(process.cwd(), '0-7_challenge_mode');
  const source = { id: receipt.stageId, variant: { kind: 'challenge_mode', of_stage_id: receipt.parentStageId } };
  for (const edit of [r => r.professionMask = 2048, r => r.buildableMask = 'SKY', r => r.blackboard[0].value = -1,
    r => r.blackboard.push({ key: 'scale', value: 2, valueStr: null })]) {
    const bad = structuredClone(receipt); edit(bad.runes.find(r => r.key === 'cbuff_char_cost')); assert.throws(() => compileStageRules(source, bad), /Invalid|Unsupported/);
  }
  const inactive = structuredClone(receipt); inactive.runes.find(r => r.key === 'cbuff_char_cost').difficultyMask = 'NONE';
  assert.equal(compileStageRules(source, inactive).allyCards, undefined);
  assert.equal(stageCardBaseCost({stageCardRules:rule()}, {profession:'PIONEER',position:'MELEE',stats:{cost:7}}),21);
  assert.equal(stageSummonCost({stageCardRules:rule(128,3,1.5)}, {profession:'TOKEN',position:'ALL',stats:{cost:5}}),7);
});
test('squad and first-deployment discounts remain outside the stage initial-cost multiplier', () => {
  const b = fixture(['char_123_fang', 'char_115_headbr', 'char_456_ash']);
  const fang = b.data.getChess('char_123_fang'), ash = b.data.getChess('char_456_ash');
  const original = b.stageInitialCosts.get('char_123_fang');
  assert.equal(b.cost('char_123_fang'), original * 3 + fang.stats.cost - original);
  assert.equal(b.cost('char_456_ash'), ash.stats.cost * 3 + ash.talents.find(t => t.bb.runtime_cost != null).bb.runtime_cost);
});
for (const id of ['char_110_deepcl', 'char_2023_ling', 'char_248_mgllan', 'char_4123_ela', 'char_4072_ironmn']) {
  test(`${id}: stage redeployment multiplier reaches its summon cooldown without changing source stats`, () => {
    const rules = { allyCards: [{ attribute: 'respawnTime', professionMask: 1023, buildableMask: 3, scale: 2 }] };
    const b = fixture([id], rules), op = b.deployOperator(id, 3, 2, 'RIGHT'); b.addDp('arkpedia', 99);
    const card = regularSummonCards(b)[0], raw = card.record.stats.respawnTime;
    let spot;
    for (let r = 0; r < b.grid.rows && !spot; r++) for (let c = 0; c < b.grid.cols && !spot; c++)
      if (!summonPlacementError(b, card.key, r, c)) spot = [r, c];
    assert.ok(spot); deployRegularSummon(b, card.key, ...spot, 'RIGHT');
    const current = regularSummonCards(b)[0]; assert.equal(current.readyAt - b.time, raw * 2);
    assert.equal(current.record.stats.respawnTime, raw);
    const base = op.base.respawnTime; b.retreatOperator(id);
    assert.equal(b.bench[id].readyAt - b.time, base * op.s.redeployMul); assert.deepEqual(b.errors, []);
  });
}
test('original 5-5 Challenge doubles initial redeployment time before talent corrections', async () => {
  const { receipt } = await loadStageRuleReceipt(process.cwd(), '5-5_challenge_mode');
  const rules = compileStageRules({id:receipt.stageId,variant:{kind:'challenge_mode',of_stage_id:receipt.parentStageId}}, receipt);
  assert.deepEqual(rules.allyCards, [{attribute:'respawnTime',professionMask:1023,buildableMask:3,scale:2}]);
  const id = 'char_123_fang', b = fixture([id], rules), def = b.data.getChess(id), u = b.deployOperator(id,3,3,'RIGHT');
  assert.equal(u.base.respawnTime, def.stats.respawnTime + def.raw.baseCardStats.respawnTime);
  b.retreatOperator(id); assert.equal(b.bench[id].readyAt - b.time, u.base.respawnTime);
  assert.match(b.placementError(id,3,3), /redeploying/); assert.deepEqual(b.errors, []);
});
