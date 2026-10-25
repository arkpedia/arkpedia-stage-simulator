// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import casterSource from '../data/arkpedia-five-star-caster-prefabs.json' with {type:'json'};
import utilitySource from '../data/arkpedia-utility-prefabs.json' with {type:'json'};
const CHARGER='char_290_vigna',GUARD='char_122_beagle',FANG='char_1036_fang2',MERCHANT='char_272_strong',SVASH='char_1045_svash2';
function fixture(ids=[GUARD],overrides={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const b=new StandardBattle(d,{operators:ids.map(id=>({...defaultBuild(d.operators[id]),...overrides[id]}))});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 const deploy=(id=ids[0],row=2,col=7)=>{b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,row,col,'RIGHT');b.getPlayer('arkpedia').dp=0;return u;};return{b,deploy};
}
test('ordinary paid withdrawals use the captured half-cost refund through repeated deployments',()=>{
 const{b,deploy}=fixture();
 for(let n=0;n<3;n++){b.bench[GUARD].readyAt=b.time;const u=deploy(),paid=b.bench[GUARD].lastCost,base=u.base.cost;b.retreatOperator(GUARD);assert.equal(b.dp,Math.floor(Math.min(paid/2,base)));assert.equal(u.alive,false);assert.ok(b.bench[GUARD].readyAt>b.time);}
 assert.deepEqual(b.errors,[]);
});
test('a real Fang withdrawal card discounts a Charger without allowing its refund to mint DP',()=>{
 const{b,deploy}=fixture([FANG,CHARGER]);deploy(FANG);b.retreatOperator(FANG);assert.equal(b._fangFireSharpenedCard,-1);
 const u=deploy(CHARGER),paid=b.bench[CHARGER].lastCost;assert.equal(paid,u.base.cost-1);b.retreatOperator(CHARGER);assert.equal(b.dp,paid);assert.deepEqual(b.errors,[]);
});
test('a skill-delivered zero-payment Charger cannot refund its positive displayed card cost',()=>{
 const{b}=fixture([CHARGER]);b.getPlayer('arkpedia').dp=0;const u=b.redeployOperatorFromSkill(CHARGER,2,7,'RIGHT');assert.equal(b.bench[CHARGER].lastCost,0);assert.ok(u.mem.regularCostAttribute>0);
 b.retreatOperator(CHARGER);assert.equal(b.dp,0);assert.equal(u.alive,false);assert.deepEqual(b.errors,[]);
});
test('temporary card cost increases are capped by the deployment basic cost',()=>{
 const{b,deploy}=fixture();const base=b.data.getChess(GUARD).stats.cost;b.bench[GUARD].costDelta=40;const u=deploy();assert.ok(b.bench[GUARD].lastCost/2>base);assert.equal(b.bench[GUARD].costDelta,0);
 b.retreatOperator(GUARD);assert.equal(b.dp,base);assert.equal(u.alive,false);assert.deepEqual(b.errors,[]);
});
test('a real SilverAsh S3 base-cost swap supplies the refund cap even after its card override is consumed',()=>{
 const{b,deploy}=fixture([SVASH,GUARD,CHARGER],{[SVASH]:{skillId:'skchr_svash2_3',skillRank:10,elite:2,level:90}}),owner=deploy(SVASH,3,4);
 owner.skill.setSpTotal(owner.skill.spCost);assert.equal(b.activateOperator(SVASH),true);for(let i=0;i<4;i++)b.step();const high=owner.mem.svash2Owner.swappedCards[0],cap=b.bench[high].baseCost;assert.ok(Number.isFinite(cap));
 b.bench[high].costDelta=40;const u=deploy(high),paid=b.bench[high].lastCost;assert.ok(paid*.5>cap);assert.equal(b.bench[high].baseCost,undefined);
 b.retreatOperator(high);assert.equal(b.dp,cap);assert.equal(u.alive,false);assert.deepEqual(b.errors,[]);
});
test('engine-owned withdrawal ignores the viewport while refunding an immutable captured payment once',()=>{
 const{b,deploy}=fixture();const u=deploy(),paid=b.bench[GUARD].lastCost,cap=u.base.cost;b.setViewport('preview');assert.throws(()=>b.retreatOperator(GUARD),/inactive/);
 b.bench[GUARD].lastCost=99;u.base.cost=99;let nested;b.on('death',({unit})=>{if(unit===u)nested=b.withdrawOperator(u);});
 assert.equal(b.withdrawOperator(u,{life:u.deploySeq}),true);assert.equal(b.dp,Math.floor(Math.min(paid/2,cap)));assert.equal(nested,false);assert.equal(b.withdrawOperator(u),false);assert.deepEqual(b.errors,[]);
});
test('stale body and deployment-life references cannot withdraw the current operator or consume its refund',()=>{
 const{b,deploy}=fixture();const old=deploy();b.retreatOperator(GUARD);b.bench[GUARD].readyAt=b.time;const current=deploy();assert.notEqual(old,current);
 assert.equal(b.withdrawOperator(old),false);assert.equal(b.withdrawOperator(current,{life:current.deploySeq-1}),false);assert.equal(b.dp,0);assert.equal(current.alive,true);
 const paid=b.bench[GUARD].lastCost;assert.equal(b.withdrawOperator(current),true);assert.equal(b.dp,Math.floor(Math.min(paid/2,current.base.cost)));assert.deepEqual(b.errors,[]);
});

test('removing an independent same-character body cannot change the selected card cooldown or payment',()=>{
 for(const removal of ['killed','retreat']){
  const{b,deploy}=fixture(),current=deploy(),entry=b.bench[GUARD],paid=entry.lastCost;
  const separate=b._makeAlly(b.getPlayer('arkpedia'),b.data.getChess(GUARD),'op',2,6,{dir:'RIGHT'});
  b._setupUnit(separate,{talents:[],trait:{noAttack:true},skill:null});assert.ok(b._deploy(separate));
  entry.readyAt=123;assert.equal(b.withdrawOperator(separate),false);
  if(removal==='killed')b.kill(separate,null);else b.retreat(separate,{permanent:true});
  assert.equal(separate.alive,false);assert.equal(entry.readyAt,123);assert.equal(entry.unit,current);assert.equal(current.alive,true);
  assert.equal(entry.lastCost,paid);assert.equal(b.dp,0);assert.equal(b.withdrawOperator(current),true);
  assert.equal(entry.readyAt,b.time+current.base.respawnTime*current.s.redeployMul);
  assert.equal(b.dp,Math.floor(Math.min(paid/2,current.base.cost)));assert.deepEqual(b.errors,[]);
 }
});
test('nonrefunding merchants and non-withdrawal deaths do not acquire ordinary refunds',()=>{
 const merchant=fixture([MERCHANT]);const u=merchant.deploy();assert.ok(merchant.b.bench[MERCHANT].lastCost>0);assert.equal(merchant.b.withdrawOperator(u),true);assert.equal(merchant.b.dp,0);
 for(const reason of ['killed','expired']){const{b,deploy}=fixture(),u=deploy();if(reason==='killed')b.kill(u,null);else b.retreat(u,{reason,permanent:true});assert.equal(b.withdrawOperator(u),false);assert.equal(b.dp,0);assert.deepEqual(b.errors,[]);}
 assert.deepEqual(merchant.b.errors,[]);
});
test('Amiya S3 natural completion uses its retained Withdraw action and returns the ordinary refund outside the active viewport',()=>{
 const id='char_002_amiya',action=casterSource.templates.suicide.eventToActions.ON_BUFF_START[0];assert.ok(action.$type.startsWith('Torappu.Battle.Action.Nodes+Withdraw,'));assert.equal(action._withdrawSource,true);assert.equal(action._switchToDeadState,true);
 const{b,deploy}=fixture([id],{[id]:{elite:2,level:80,skillId:'skchr_amiya_3',skillRank:10}}),u=deploy(id,1,1),paid=b.bench[id].lastCost;u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(id),true);b.setViewport('preview');
 for(let n=0;n<Math.ceil(70/b.dt)&&u.alive;n++)b.step();assert.equal(u.alive,false);assert.equal(u.removeReason,'retreat');assert.equal(b.dp,Math.floor(Math.min(paid/2,u.base.cost)));assert.ok(b.bench[id].readyAt>b.time);assert.deepEqual(b.errors,[]);
});
test('THRM-EX source-owned explosion withdrawal refunds once after its native finish action',()=>{
 const id='char_376_therex',action=utilitySource.buffTemplates.therex_t_1.eventToActions.ON_BUFF_FINISH[1];assert.ok(action.$type.startsWith('Torappu.Battle.Action.Nodes+Withdraw,'));assert.equal(action._withdrawSource,true);
 const native=Object.values(utilitySource.sourceComponentGraphs[id+'.ab']).find(c=>Object.hasOwn(c,'_withdrawCostRecoverRatio'));assert.equal(native._withdrawCostRecoverRatio,.5);
 const{b,deploy}=fixture([id]),u=deploy(),paid=b.bench[id].lastCost;b.setViewport('preview');for(let n=0;n<Math.ceil(10/b.dt)&&u.alive;n++)b.step();assert.equal(u.alive,false);assert.equal(u.removeReason,'retreat');assert.equal(b.dp,Math.floor(paid/2));const dp=b.dp;assert.equal(b.withdrawOperator(u),false);assert.equal(b.dp,dp);assert.deepEqual(b.errors,[]);
});
