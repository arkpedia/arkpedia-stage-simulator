// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-summon-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { summonCardId, summonUnitId, summonRecordFor } from '../shared/arkpedia/summons.js';
import { regularSummonCards, summonPlacementError, deployRegularSummon,
  retreatRegularSummon } from '../server/sim/content/arkpedia-summons.js';
const id='char_452_bstalk', tokenId='token_10014_bstalk_crab',card=summonCardId(id);
const near=(a,e)=>assert.ok(Math.abs(a-e)<1e-6,`${a} != ${e}`);
function advance(b,seconds){for(let i=0;i<Math.round(seconds/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({elite=2,potential=1,skill=0,rank=10,companions=[]}={}){
  const source=structuredClone(data),op=source.operators[id];
  assert.ok(op && source.tokens[tokenId],'Reviewed Beanstalk/token snapshot is required');
  source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
  const build={...defaultBuild(op),elite,level:[45,60,70][elite],potential,skillId:op.skills[skill].id,skillRank:rank};
  const b=new StandardBattle(source,{operators:[build,...companions.map(c=>defaultBuild(source.operators[c]))]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  const u=b.deployOperator(id,3,2,'RIGHT');u.profile.canAttack=()=>false;
  return{b,u,source};
}
function activate(u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.activate('test'),true);}
function enemy(b,pos=[3,3]){const e=b.spawnEnemy('enemy_1007_slime',{pos});e.base.maxHp=100000;e.hp=100000;
  e.base.def=100;e.markDirty();b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true},persist:true});return e;}
test('source rally point retains its tile, ignores slots, requires host range, and uses literal active/inactive skeleton modes',()=>{
  const src=evidence.tokens[tokenId],c=src.character.find(r=>'_occupiedRemainingCharacterCnt'in r);
  assert.equal(c._occupiedRemainingCharacterCnt,0);assert.equal(c._buildCondition.needSpecifyDirection,0);
  assert.equal(c._buildCondition.limitByHostAttackRange,1);assert.equal(c._withdrawCostRecoverRatio,0);
  assert.ok(c._retainedBuffsWhenDead.includes('bstalk_s_2[def_up]'));
  near(src.character.find(r=>r._animKey==='Skill_Begin')._preDelay,.800000011920929);
  assert.equal(src.modePresentation.find(r=>r._animations)._animations.find(a=>a.animKey==='Attack').animName,'Y_Attack');
  const spawn=evidence.operators[id].skills.skchr_bstalk_2.find(r=>r._tokenId===tokenId);
  assert.equal(spawn._checkTokenMaxDeployCnt,0);assert.equal(spawn._forceSpawn,0);
  assert.ok(spawn._buffsToToken.some(b=>b.buffKey==='bstalk_s_2[withdraw]'&&b.templateKey==='suicide_after_buff[not_source]'));
});
test('Metal Crabs use exact independent source keyframes and20/17/15-second promotion recovery timers',()=>{
  for(const[elite,level,hp,atk,def,interval]of[[0,1,863,162,187,20],[0,45,1121,232,250,20],
    [1,1,1180,240,258,17],[1,60,1440,321,323,17],[2,1,1516,331,334,15],[2,70,1895,404,408,15]]){
    const r=summonRecordFor(id,{elite,level,potential:6,trust:200},data.tokens);
    near(r.stats.maxHp,hp);near(r.stats.atk,atk);near(r.stats.def,def);
    near(r.stats.respawnTime,interval);near(r.stats.cost,0);near(r.stats.maxDeployCount,1);
    near(r.talents[0].bb.block_cnt,1);
  }
});
test('player deployment places one tactical point in attack range, cannot move it or consume a deployment slot, and original rebirth takes.8 seconds',()=>{
  const{b,u}=make();assert.equal(b.allyUnits.filter(t=>t.kind==='token').length,0);
  assert.match(summonPlacementError(b,card,2,7),/attack range/);
  b.unitLimit=1;const dp=b.dp,t=deployRegularSummon(b,card,3,3);
  near(b.dp,dp);assert.equal(b.deployedSlots(),1);assert.equal(regularSummonCards(b)[0].stock,0);
  assert.equal(t.mem.crabMode,'warming');assert.equal(t.mem.regularFormVisual.clip,'Y_Start');
  near(t.s.blockCnt,0);assert.equal(t.s.flags.invulnerable,true);
  advance(b,.7);assert.equal(t.mem.crabMode,'warming');advance(b,.2);
  assert.equal(t.mem.crabMode,'active');assert.equal(t.mem.regularFormVisual.clip,'Y_Idle');near(t.s.blockCnt,1);
  assert.match(summonPlacementError(b,card,3,4),/No summons/);
  b.retreat(u);assert.equal(t.alive,false);assert.equal(t.removeReason,'owner-removed');
});
test('defeat and voluntary retreat preserve the tactical point and stock while its source timer regenerates a full reinforcement',()=>{
  for(const elite of[0,1,2]){
    const{b,u}=make({elite,rank:[4,7,10][elite]}),t=deployRegularSummon(b,card,3,3);advance(b,1);
    const e=enemy(b);b._checkBlock(e);assert.equal(e.blockedBy,t);
    b.dealDamage(e,t,{amount:10000,type:'true'});assert.equal(t.alive,true);assert.equal(t.mem.crabMode,'inactive');
    near(t.s.blockCnt,0);assert.equal(e.blockedBy,null);assert.equal(t.s.flags.invulnerable,true);
    const interval=[20,17,15][elite];advance(b,interval-.1);assert.equal(t.mem.crabMode,'inactive');
    advance(b,.2);assert.equal(t.mem.crabMode,'warming');advance(b,.8);
    assert.equal(t.mem.crabMode,'active');near(t.hp,t.s.maxHp);
    assert.equal(regularSummonCards(b)[0].stock,0);
    retreatRegularSummon(b,summonUnitId(t));assert.equal(t.mem.crabMode,'inactive');assert.equal(t.alive,true);
    const generation=t.mem.crabGeneration;retreatRegularSummon(b,summonUnitId(t));assert.equal(t.mem.crabGeneration,generation);
    b.retreat(u);advance(b,interval+1);assert.equal(t.alive,false);
  }
});
test('Beanstalk attack scales before DEF only against enemies blocked by her own reinforcement; crab strikes exactly one target at its source frame',()=>{
  const{b,u}=make({companions:['char_208_melan']}),t=deployRegularSummon(b,card,3,3);advance(b,1);
  t.profile.canAttack=()=>false;const e=enemy(b),other=enemy(b,[3,3.2]);b._checkBlock(e);assert.equal(e.blockedBy,t);
  const hp=e.hp,hp2=other.hp;b.forceAttack(t,[e]);advance(b,.3);near(e.hp,hp);advance(b,.15);
  near(hp-e.hp,t.s.atk-100);near(other.hp,hp2);
  let before=e.hp;b.forceAttack(u,[e]);advance(b,.8);near(before-e.hp,u.s.atk*1.5-100);
  b.releaseBlocked(t);e.x=4;before=e.hp;b.forceAttack(u,[e]);advance(b,.8);near(before-e.hp,u.s.atk-100);
  const ally=b.deployOperator('char_208_melan',3,4,'RIGHT');ally.profile.canAttack=()=>false;b._checkBlock(e);assert.equal(e.blockedBy,ally);
  before=e.hp;b.forceAttack(u,[e]);advance(b,.8);near(before-e.hp,u.s.atk-100);
});
test('Beanstalk S1 waits for its source cast frame, grants8DP and heals or reactivates the primary tactical point at every source rank',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,u}=make({rank}),t=deployRegularSummon(b,card,3,3);advance(b,1);t.profile.canAttack=()=>false;t.hp-=500;
    b.getPlayer('arkpedia').dp=0;activate(u);advance(b,.5);near(b.dp,0);near(t.hp,t.s.maxHp-500);
    advance(b,.2);near(b.dp,8);near(t.hp,t.s.maxHp);
    retreatRegularSummon(b,summonUnitId(t));activate(u);advance(b,.7);assert.equal(t.mem.crabMode,'warming');
    advance(b,.8);assert.equal(t.mem.crabMode,'active');near(t.hp,t.s.maxHp);near(b.dp,16);
  }
});
test('Beanstalk S2 uses real adjacent valid tiles, spends no extra stock/slots, buffs source DEF and produces12DP over15 seconds at every rank',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,u,source}=make({rank,skill:1}),t=deployRegularSummon(b,card,3,3);advance(b,1);
    const bb=Object.fromEntries(source.operators[id].skills[1].levels[rank-1].blackboard.map(r=>[r.key,r.value]));
    b.getPlayer('arkpedia').dp=0;activate(u);near(t.s.def,t.base.def*(1+bb['attack@def']));
    advance(b,.5);assert.equal(b.allyUnits.filter(t=>t.kind==='token').length,1);near(b.dp,0);
    advance(b,.2);const extras=b.allyUnits.filter(t=>t.mem.crabExtra&&t.alive);
    assert.ok(extras.length>0&&extras.length<=4);near(b.dp,0);assert.equal(b.deployedSlots(),1);
    assert.equal(regularSummonCards(b)[0].stock,0);
    for(const extra of extras){near(Math.abs(extra.tileR-t.tileR)+Math.abs(extra.tileC-t.tileC),1);
      near(extra.s.def,extra.base.def*(1+bb['attack@def']));}
    advance(b,.6);near(b.dp,1);advance(b,13.8);near(b.dp,12);assert.equal(u.skill.active,false);
    near(t.s.def,t.base.def);for(const extra of extras)near(extra.s.def,extra.base.def);
    advance(b,1);for(const extra of extras)assert.equal(extra.alive,false);assert.equal(t.alive,true);
  }
});
test('S2 excludes occupied/nonmelee adjacent tiles, does not resurrect temporary reinforcements, and owner death stops DP/cleans all points',()=>{
  const{b,u}=make({skill:1,companions:['char_208_melan']}),t=deployRegularSummon(b,card,3,3);advance(b,1);
  b.deployOperator('char_208_melan',3,4,'RIGHT');b.getPlayer('arkpedia').dp=0;activate(u);advance(b,1.5);
  const extras=b.allyUnits.filter(t=>t.mem.crabExtra&&t.alive);assert.ok(extras.every(t=>!(t.tileR===3&&t.tileC===4)));
  const extra=extras[0];b.dealDamage(null,extra,{amount:10000,type:'true'});assert.equal(extra.alive,false);
  const dp=b.dp;b.kill(u);advance(b,20);near(b.dp,dp);assert.equal(t.alive,false);
  assert.ok(b.allyUnits.filter(t=>t.kind==='token').every(t=>!t.alive));
});
