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
const id='char_484_robrta', tokenId='token_10018_robrta_mach', card=summonCardId(id);
const near=(a,e)=>assert.ok(Math.abs(a-e)<1e-6,`${a} != ${e}`);
function advance(b,seconds){for(let i=0;i<Math.round(seconds/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({elite=2,potential=1,skill=0,rank=10,companions=['char_208_melan']}={}){
  const source=structuredClone(data), op=source.operators[id];
  assert.ok(op && source.tokens[tokenId],'Reviewed Roberta/token snapshot is required');
  source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
  const build={...defaultBuild(op),elite,level:[45,60,70][elite],potential,skillId:op.skills[skill].id,skillRank:rank};
  const b=new StandardBattle(source,{operators:[build,...companions.map(c=>defaultBuild(source.operators[c]))]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  const u=b.deployOperator(id,2,7,'RIGHT');return{b,u,source};
}
function activate(u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.activate('test'),true);}
const bbAt=(source,skill,rank)=>Object.fromEntries(source.operators[id].skills[skill].levels[rank-1].blackboard.map(r=>[r.key,r.value]));
test('original Modeler prefab specifies facing, all deployable tiles, no slots, persistent device charges and literal model modes',()=>{
  const source=evidence.tokens[tokenId], character=source.character.find(r=>'_occupiedRemainingCharacterCnt'in r);
  assert.equal(character._occupiedRemainingCharacterCnt,0);assert.equal(character._buildCondition.needSpecifyDirection,1);
  assert.equal(character._buildCondition.buildableType,3);near(character._withdrawCostRecoverRatio,.5);
  const shield=evidence.templates.robrta_mach_t.eventToActions.ON_TAKE_DAMAGE[0];
  assert.match(shield.$type,/BlockDamage/);assert.equal(shield._filterDamageType,false);
  assert.equal(evidence.templates.robrta_mach_t.onEventPriority,'HIGH_PRIORITY');
  assert.ok(source.character.some(r=>r._passiveBuffs?.some(b=>b.durationKey==='duration'&&b.templateKey==='withdraw_target_as_dead_when_buff_finish')));
  assert.ok(source.modePresentation.some(r=>r._replaceAnimPairs?.some(p=>p.fromAnimKey==='Idle'&&p.toAnimKey==='Default')));
  assert.deepEqual(source.modePresentation.find(r=>r._animations)._animations.find(a=>a.animKey==='Die').animName,'End');
});
test('Modeler source talent follows owner promotion and potential without inheriting owner statistics',()=>{
  for(const[elite,potential,def,duration,shields]of[[0,1,.1,15,1],[0,5,.13,15,1],[1,1,.2,25,1],[1,5,.23,25,1],[2,1,.3,25,2],[2,5,.33,25,2]]){
    const r=summonRecordFor(id,{elite,level:[45,60,70][elite],potential,trust:200},data.tokens);
    near(r.stats.maxHp,100);near(r.stats.atk,100);near(r.stats.def,0);near(r.stats.cost,5);
    near(r.stats.maxDeployCount,3);near(r.stats.maxDeckStackCnt,3);near(r.stats.respawnTime,15);
    near(r.talents[0].bb.def,def);near(r.talents[0].bb.duration,duration);
    assert.equal(r.talents[0].prefabKey==='1+'?2:1,shields);
  }
});
test('directional devices cost DP and stock but no slots; their lifetime begins even without an ally ahead',()=>{
  const{b,u}=make({companions:[]});assert.equal(regularSummonCards(b)[0].stock,3);
  b.unitLimit=1;const dp=b.dp,t=deployRegularSummon(b,card,3,3,'LEFT');
  near(b.dp,dp-5);assert.equal(b.deployedSlots(),1);assert.equal(t.dir,'LEFT');assert.equal(t.mem.regularFormVisual.clip,'Default');
  assert.equal(t.s.blockCnt,0);assert.equal(t.profile.canAttack(b,t),false);
  const hp=t.hp;b.dealDamage(null,t,{amount:10000,type:'true'});near(t.hp,hp);
  assert.equal(summonPlacementError(b,card,1,3),'Summon is still redeploying.');
  advance(b,15.1);assert.equal(summonPlacementError(b,card,1,3),null);
  const high=deployRegularSummon(b,card,1,3,'DOWN');assert.ok(high.alive);
  advance(b,10);assert.equal(t.alive,false);assert.equal(t.removeReason,'modeler-expired');
  assert.equal(regularSummonCards(b)[0].stock,1);assert.ok(u.alive);
});
test('Modeler DEF and 1/2 all-type shield charges follow only the facing melee ally and retain spent stock',()=>{
  for(const elite of[0,1,2]){
    const{b,u}=make({elite,rank:[4,7,10][elite]});const ally=b.deployOperator('char_208_melan',3,4,'RIGHT');
    const base=ally.s.def,t=deployRegularSummon(b,card,3,3,'RIGHT');near(ally.s.def,base*(1+[.1,.2,.3][elite]));
    assert.equal(t.mem.regularFormVisual.clip,'Idle');let hp=ally.hp;
    b.dealDamage(null,ally,{amount:100,type:'true'});near(ally.hp,hp);
    if(elite===2){b.dealDamage(null,ally,{amount:100,type:'arts'});near(ally.hp,hp);}
    b.dealDamage(null,ally,{amount:100,type:'true'});near(ally.hp,hp-100);
    near(ally.s.def,base*(1+[.1,.2,.3][elite]));
    b.relocate(ally,3,5);advance(b,.1);near(ally.s.def,base);
    b.relocate(ally,3,4);advance(b,.1);near(ally.s.def,base*(1+[.1,.2,.3][elite]));
    hp=ally.hp;b.dealDamage(null,ally,{amount:100,type:'true'});near(ally.hp,hp-100);
    b.retreat(u);near(ally.s.def,base);assert.equal(t.alive,false);
  }
});
test('overlapping Modelers never stack DEF, consume only one device charge per hit, and remove their own aura on retreat',()=>{
  const{b}=make();const ally=b.deployOperator('char_208_melan',3,4,'RIGHT');const base=ally.s.def;
  const first=deployRegularSummon(b,card,3,3,'RIGHT');advance(b,15.1);
  const second=deployRegularSummon(b,card,3,5,'LEFT');near(ally.s.def,base*1.3);
  const hp=ally.hp;b.dealDamage(null,ally,{amount:100,type:'true'});near(ally.hp,hp);
  assert.equal(first.mem.modelerShields+second.mem.modelerShields,3);
  retreatRegularSummon(b,summonUnitId(first));near(ally.s.def,base*1.3);
  b.dealDamage(null,ally,{amount:100,type:'true'});b.dealDamage(null,ally,{amount:100,type:'true'});near(ally.hp,hp);
  b.dealDamage(null,ally,{amount:100,type:'true'});near(ally.hp,hp-100);
  retreatRegularSummon(b,summonUnitId(second));near(ally.s.def,base);
});
test('Roberta S1 and S2 obey every source rank, S2 stops attacks and recharges one Modeler after finishing only',()=>{
  for(const skill of[0,1])for(let rank=1;rank<=10;rank++){
    const{b,u,source}=make({skill,rank,companions:[]}),bb=bbAt(source,skill,rank),a=u.s.atk,d=u.s.def;
    const t=deployRegularSummon(b,card,3,3,'RIGHT');const before=regularSummonCards(b)[0].stock;
    activate(u);near(u.s.def,d*(1+bb.def));
    if(skill===0)near(u.s.atk,a*(1+bb.atk));
    else{near(u.s.atk,a);assert.equal(u.s.blockCnt,3);assert.equal(u.skill.attackOverride().noAttack,true);}
    near(regularSummonCards(b)[0].stock,before);
    u.skill.end('duration');near(u.s.atk,a);near(u.s.def,d);assert.equal(u.s.blockCnt,2);
    near(regularSummonCards(b)[0].stock,before+(skill===1?1:0));assert.ok(t.alive);
    if(skill===1){activate(u);u.skill.end('duration');assert.equal(regularSummonCards(b)[0].stock,3);}
  }
});
