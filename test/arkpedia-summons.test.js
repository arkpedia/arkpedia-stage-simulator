// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-summon-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { summonCardId, summonUnitId, summonRecordFor, sourceCandidate } from '../shared/arkpedia/summons.js';
import { regularSummonCards, summonPlacementError, deployRegularSummon,
  retreatRegularSummon, selectedRegularSummon } from '../server/sim/content/arkpedia-summons.js';

const id = 'char_110_deepcl', tokenId = 'token_10001_deepcl_tentac', card = summonCardId(id);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function make({ elite = 2, level = 70, potential = 1, skill = 0, rank = 10, companions = [] } = {}) {
  const source = structuredClone(data), op = source.operators[id];
  assert.ok(op && source.tokens[tokenId], 'Reviewed summoner/token snapshot is required');
  source.stage.geometry.waves[0].spawns = [];
  source.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(op), elite, level, potential,
    skillId: op.skills[skill].id, skillRank: rank };
  const b = new StandardBattle(source, { operators: [build,
    ...companions.map(companion => defaultBuild(source.operators[companion]))] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.addDp('arkpedia', 99);
  const u = b.deployOperator(id, 3, 2, 'RIGHT');
  u.profile.canAttack = () => false;
  return { b, u, source, build };
}
function activate(u) { u.skill.gainSp(u.skill.spCost, 'test'); assert.equal(u.skill.activate('test'), true); }
const bbAt = (source, skill, rank) => Object.fromEntries(source.operators[id].skills[skill].levels[rank-1].blackboard.map(row => [row.key,row.value]));

test('original summon evidence preserves byte-verified base models, direction policy, deployment slots and owner-finish cleanup', () => {
  assert.equal(evidence.sourceBundle.sha256, 'eb82b7f36d14b08e833f8effd2f39608a67676959cf42bcd4aae372f9010df8f');
  const character = evidence.tokens[tokenId].character.find(row => '_occupiedRemainingCharacterCnt' in row);
  assert.equal(character._occupiedRemainingCharacterCnt, 1);
  assert.equal(character._buildCondition.needSpecifyDirection, 0);
  near(character._withdrawCostRecoverRatio, .5);
  near(evidence.tokens[tokenId].model.hits.Attack[0], .467);
  assert.match(evidence.tokens[tokenId].model.files['token_10001_deepcl_tentacle.skel'].sha256, /^[a-f0-9]{64}$/);
  assert.match(evidence.templates.die_to_kill_token.eventToActions.ON_OWNER_FINISH[0].$type, /KillTokens/);
});

test('Tentacle statistics come from their own phase/level keyframes, with exact rounded interpolation and no owner trust/potential ATK', () => {
  for (const [elite, level, hp, atk, def, limit] of [[0,1,975,218,128,2], [0,45,1170,295,220,2],
    [1,1,1275,308,236,3], [1,60,1480,348,275,3], [2,1,1605,393,280,4], [2,70,2016,462,335,4]]) {
    const r = summonRecordFor(id, {elite,level,potential:6,trust:200}, data.tokens);
    near(r.stats.maxHp,hp); near(r.stats.atk,atk); near(r.stats.def,def);
    near(r.stats.maxDeployCount,limit); near(r.stats.cost,5); near(r.stats.baseAttackTime,1.25);
    near(r.stats.respawnTime,10); assert.deepEqual(r.rangeGrid, [[0,0]]);
  }
  const middle = summonRecordFor(id, {elite:2,level:35,potential:1}, data.tokens);
  near(middle.stats.maxHp, Math.round(1605+(2016-1605)*34/69));
  near(middle.stats.atk, Math.round(393+(462-393)*34/69));
  assert.throws(() => summonRecordFor(id, {elite:2,level:71,potential:1},data.tokens));
  assert.throws(() => summonRecordFor('unreviewed-summoner', {elite:2,level:70,potential:1},data.tokens));
});

test('source token talent selection never enables locked elite/level or potential candidates', () => {
  const candidates = [
    {unlockCondition:{phase:'PHASE_0',level:1},requiredPotentialRank:0,tag:'base'},
    {unlockCondition:{phase:'PHASE_2',level:40},requiredPotentialRank:0,tag:'level'},
    {unlockCondition:{phase:'PHASE_2',level:40},requiredPotentialRank:4,tag:'potential'},
  ];
  assert.equal(sourceCandidate(candidates,{elite:1,level:60,potential:6}).tag,'base');
  assert.equal(sourceCandidate(candidates,{elite:2,level:39,potential:6}).tag,'base');
  assert.equal(sourceCandidate(candidates,{elite:2,level:40,potential:1}).tag,'level');
  assert.equal(sourceCandidate(candidates,{elite:2,level:40,potential:5}).tag,'potential');
});

test('player-placed Tentacles spend exact stock/DP/slots, share their source cooldown, and reject invalid placements without mutation', () => {
  const {b,u}=make();
  assert.equal(b.allyUnits.filter(unit => unit.kind==='token').length,0);
  assert.equal(regularSummonCards(b)[0].stock,4);
  const dp=b.dp, token=deployRegularSummon(b,card,3,3);
  near(b.dp,dp-5); assert.equal(regularSummonCards(b)[0].stock,3); assert.equal(b.deployedSlots(),2);
  assert.equal(token.ownerUnit,u); assert.equal(token.skill.noSkill,true);
  assert.equal(summonPlacementError(b,card,3,4),'Summon is still redeploying.');
  assert.throws(()=>deployRegularSummon(b,card,3,4)); near(b.dp,dp-5);
  advance(b,10.1);
  assert.equal(summonPlacementError(b,card,3,3),'Tile is occupied.');
  assert.equal(summonPlacementError(b,card,1,3),'Choose a melee tile.');
  assert.equal(summonPlacementError(b,card,-1,3),'Select a tile on the map.');
  b.unitLimit=2; assert.equal(summonPlacementError(b,card,3,4),'Deployment limit reached.'); b.unitLimit=8;
  b.getPlayer('arkpedia').dp=4; assert.equal(summonPlacementError(b,card,3,4),'Not enough DP.');
  b.setViewport('preview'); assert.match(summonPlacementError(b,card,3,4),/fullscreen/);
  b.setViewport('fullscreen-workspace'); b.getPlayer('arkpedia').dp=99;
  deployRegularSummon(b,card,3,4); advance(b,10.1); deployRegularSummon(b,card,3,5);
  advance(b,10.1); deployRegularSummon(b,card,3,6); advance(b,10.1);
  assert.equal(regularSummonCards(b)[0].stock,0);
  assert.equal(summonPlacementError(b,card,3,7),'No summons remaining.');
});

test('Tentacle retreat returns only half base DP, never stock, and owner retreat/death removes all owned summons and resets stock on redeploy', () => {
  for (const killed of [false,true]) {
    const {b,u}=make(),token=deployRegularSummon(b,card,3,3),key=summonUnitId(token);
    const before=b.dp; retreatRegularSummon(b,key); near(b.dp-before,2);
    assert.equal(regularSummonCards(b)[0].stock,3); assert.equal(selectedRegularSummon(b,key),null);
    advance(b,10.1); const second=deployRegularSummon(b,card,3,4);
    if(killed)b.kill(u); else b.retreatOperator(id);
    assert.equal(second.alive,false); assert.equal(regularSummonCards(b)[0].available,false);
    assert.equal(summonPlacementError(b,card,3,5),'Deploy the summoner first.');
    advance(b,u.base.respawnTime+.1); b.addDp('arkpedia',99); b.deployOperator(id,1,2,'RIGHT');
    assert.equal(regularSummonCards(b)[0].stock,4);
    const next=deployRegularSummon(b,card,3,3); assert.notEqual(next.ownerUnit,u);
  }
});

test('Tentacles use source single-target Physical attack/hit frame and auto-facing, cannot heal normally or attack fliers', () => {
  const {b,u}=make(),token=deployRegularSummon(b,card,3,3);
  token.profile.canAttack=()=>false;token.hp-=500;
  near(b.heal(u,token,100),0);near(b.heal(token,token,100,{self:true}),0);
  const before=token.hp; b.addBuff(token,{key:'test:regen',mods:{hpRegen:30}});advance(b,1);
  near(token.hp-before,30);b.removeBuff(token,'test:regen');
  const enemy=b.spawnEnemy('enemy_1007_slime',{pos:[3,2.8]}),other=b.spawnEnemy('enemy_1007_slime',{pos:[3,3.2]});
  for(const e of[enemy,other]){e.base.maxHp=10000;e.hp=10000;e.base.def=100;e.markDirty();b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true},persist:true});}
  const hp=enemy.hp,hp2=other.hp;b.forceAttack(token,[enemy]);advance(b,.4);
  near(enemy.hp,hp);advance(b,.2);near(hp-enemy.hp,token.s.atk-100);near(other.hp,hp2);
  assert.equal(token.dir,'LEFT');assert.equal(token.profile.canHitFly,false);
});

test('Deepcolor Shadow Tentacle buffs only her actual summons at all source ranks, regenerates despite heal prohibition and includes late summons', () => {
  for(let rank=1;rank<=10;rank++) {
    const{b,u,source}=make({rank}),token=deployRegularSummon(b,card,3,3),bb=bbAt(source,0,rank);
    token.profile.canAttack=()=>false;token.hp-=1000;activate(u);
    near(u.s.atk,u.base.atk);near(u.s.def,u.base.def);near(u.s.hpRegen,0);
    near(token.s.atk,token.base.atk*(1+bb.atk));near(token.s.def,token.base.def*(1+bb.def));
    near(token.s.hpRegen,bb.hp_recovery_per_sec);const hp=token.hp;advance(b,1);near(token.hp-hp,bb.hp_recovery_per_sec);
    advance(b,9.1);const late=deployRegularSummon(b,card,3,4);
    near(late.s.atk,late.base.atk*(1+bb.atk));near(late.s.hpRegen,bb.hp_recovery_per_sec);
    advance(b,20);assert.equal(u.skill.active,false);near(token.s.atk,token.base.atk);near(late.s.hpRegen,0);
  }
});

test('Deepcolor Visual Trap expands the source attack/aura grid, applies Physical-only dodge at every rank, tracks entry/exit and cleans on withdrawal', () => {
  for(let rank=1;rank<=10;rank++) {
    const{b,u,source}=make({skill:1,rank,companions:['char_123_fang','char_122_beagle']}),bb=bbAt(source,1,rank);
    const token=deployRegularSummon(b,card,3,3);activate(u);
    assert.deepEqual(u.liveRangeGrid,source.operators[id].skills[1].levels[rank-1].rangeGrid);
    near(u.s.dodgePhys,bb.prob);near(u.s.dodgeArts,0);near(token.s.dodgePhys,bb.prob);
    const ally=b.deployOperator('char_123_fang',3,5,'RIGHT');near(ally.s.dodgePhys,bb.prob);
    const outside=b.deployOperator('char_122_beagle',2,7,'RIGHT');near(outside.s.dodgePhys,0);
    assert.equal(b.relocate(outside,3,4),true);advance(b,.1);near(outside.s.dodgePhys,bb.prob);
    assert.equal(b.relocate(outside,2,7),true);advance(b,.1);near(outside.s.dodgePhys,0);
    b.retreatOperator(id);near(ally.s.dodgePhys,0);assert.equal(token.alive,false);
  }
});
