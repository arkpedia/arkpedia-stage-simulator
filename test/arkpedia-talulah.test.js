// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {applyStageEnemyBlackboard,applyStageEnemyTalentMultipliers} from '../shared/arkpedia/stage-enemy-talents.js';
import {talulahNative,talulahParams} from '../shared/arkpedia/enemy-talulah-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1503_talula',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];
const PREFAB='dyn/battle/prefabs/enemies/enemy_1503_talula.prefab';
// tools/arkpedia/stage-enemy-blackboards.mjs passes a missing talent blackboard as [].
const JT8_2={level:0,blackboard:[],skills:[{prefabKey:'DanceFire',priority:0,cooldown:40,initCooldown:160,spCost:0,
 blackboard:[{key:'atk_scale',value:1,valueStr:null},{key:'range_radius',value:2.5,valueStr:null}]}],spData:null};

/** Talulah at row 10, col 5 (the field spans rows 9-12), held still; operators (block 0) at [row, col]. */
function fixture(positions=[],{rec=record,disarm=true}={}){
 const op=chessRec({id:'talula_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,timeLimit:2000,defs:{chess:{[op.chessId]:op},enemies:{[id]:rec}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:11,col:1+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();
 ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];u.tileR=positions[i][0];u.tileC=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[10,5],route:0});
 b.addBuff(e,{key:'hold',persist:true,flags:{noMove:true,...disarm?{disarm:true}:{}}});
 const ab=e.mem.ab.list.find(a=>'half'in a),attack=e.mem.ab.list.find(a=>a.attack);
 const hits=[];b.on('damaged',c=>{if(c.source===e)hits.push({target:c.target,amount:c.amount,type:c.dmg?.type,tags:c.dmg?.tags??[],t:b.time});});
 return {...h,e,ops,ab,hits,strike:t=>attack.attack({targets:[t]},b,e,ab),p:talulahParams(rec),run:s=>{h.run(s);assert.equal(b.finished,false);}};
}
const tagged=(hits,tag)=>hits.filter(x=>x.tags.includes(tag));
const withComponent=(test,edit)=>{const n=structuredClone(native);for(const row of n.prefabs[PREFAB]){const d=JSON.parse(row.originalJson);if(test(d)){edit(d);row.originalJson=JSON.stringify(d);}}return nativeComponents(n,id);};

test('both levels of Talulah are admitted only with the complete native tree; JT8-2 and its Challenge overrides only',()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(talulahNative(r,n),true,`level ${r.level}`);
 assert.equal(talulahNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'halfhp.def':2}}},n),false);
 assert.equal(talulahNative({...record,skills:record.skills.map(s=>s.prefabKey==='DragonFire'?{...s,cooldown:10}:s)},n),false);
 assert.equal(talulahNative(record,withComponent(d=>d._damageType===3,d=>{d._damageType=1;})),false,'true melee');
 const jt=applyStageEnemyBlackboard(record,JT8_2);
 assert.deepEqual(jt.skills.map(s=>[s.prefabKey,s.priority,s.initCooldown]),[['DanceFire',0,160]]);assert.equal(talulahNative(jt,n),true);
 const challenge=applyStageEnemyTalentMultipliers(jt,{'halfhp.hp_ratio':2});assert.equal(challenge.talents.bb['halfhp.hp_ratio'],1);assert.equal(talulahNative(challenge,n),true);
 assert.throws(()=>applyStageEnemyBlackboard(record,{...JT8_2,skills:[{...JT8_2.skills[0],priority:2}]}),/Unsupported/,'only the reviewed priority');
 assert.throws(()=>applyStageEnemyBlackboard(record,{...JT8_2,skills:[{...JT8_2.skills[0],prefabKey:'DragonFire',blackboard:[]}]}),/Unsupported/,'only the reviewed subset');
});

test('attacks: an unblocked 40% Arts shot; a blocked 100% true strike',()=>{
 const h=fixture([[10,7]]),{b,e,p,hits,strike}=h,[op]=h.ops;
 strike(op);h.run(.4);
 assert.deepEqual(tagged(hits,'talulahShot').map(x=>[x.target,x.type]),[[op,'arts']]);
 e.blockedBy=op;strike(op);
 assert.deepEqual(tagged(hits,'talulahMelee').map(x=>[x.target,x.amount,x.type]),[[op,e.s.atk,'true']]);
 assert.equal(p.ranged.scale,Math.fround(.4));assert.deepEqual(b.errors,[]);
});

test('Burning Breath at 19 s on an operator anywhere, rising from 50/s to 230/s over 30 s, never on one already burning',()=>{
 const h=fixture([[9,0],[12,10]]),{b,e,p,ab,hits}=h,[a1,a2]=h.ops;
 const breath=p.skills.find(s=>s.key==='DragonFire');
 h.run(breath.initial-.1);assert.equal(ab.cast,null);
 h.run(.15);assert.equal(ab.cast?.skill.key,'DragonFire');const first=ab.cast.target;
 h.run(breath.anim.hit);assert.ok(first.findBuff('dragon_fire'));
 h.run(1.02);const ticks=tagged(hits,'talulahBreath');assert.equal(ticks.length,1);assert.ok(Math.abs(ticks[0].amount-(50+180/30))<1e-6,'one second in');
 h.run(29);const later=tagged(hits,'talulahBreath');assert.ok(Math.abs(later.at(-1).amount-230)<1e-6,'capped at 230');
 assert.ok(later.filter(x=>x.target===first).length>=30&&later.every(x=>x.type==='true'));
 h.run(breath.cooldown-30-breath.anim.hit-1.05+.2);
 assert.ok(ab.cast?.skill.key==='DragonFire'||tagged(hits,'talulahBreath').some(x=>x.target!==first),'the next breath picks the other operator');
 assert.notEqual(ab.cast?.target??null,first);
 assert.deepEqual(b.errors,[]);
});

test('Stellar Corona hits operators within 2.5; it has the higher priority; below half HP DEF +100%, RES +80% and the [Half] skills',()=>{
 const h=fixture([[10,7],[10,9]]),{b,e,p,ab,hits}=h,[near,far]=h.ops;
 const corona=p.skills.find(s=>s.key==='DanceFire'),breath=p.skills.find(s=>s.key==='DragonFire');
 ab.left.DragonFire=0;ab.left.DanceFire=0;h.run(.05);assert.equal(ab.cast?.skill.key,'DanceFire','priority 1 first');
 h.run(corona.anim.hit);
 assert.deepEqual(tagged(hits,'talulahCorona').map(x=>[x.target,x.amount,x.type]),[[near,e.s.atk,'arts']]);
 const def=e.s.def,res=e.s.res;
 b.dealDamage(null,e,{amount:e.s.maxHp*.51,type:'true',sourceless:true});h.run(corona.anim.dur);
 assert.equal(ab.half,true);assert.equal(e.s.def,def*2);assert.ok(Math.abs(e.s.res-res*1.8)<1e-9);
 assert.equal(ab.left['DragonFire[Half]']>0&&ab.left['DragonFire[Half]']<=7,true);assert.ok(ab.left['DanceFire[Half]']>7);
 h.run(7-corona.anim.dur+.2);assert.equal(ab.cast?.skill.key,'DragonFire[Half]','7 s after the enrage');
 assert.deepEqual(b.errors,[]);
});

test('JT8-2: only Stellar Corona, first at 160 s; its Challenge starts enraged, with no [Half] skill left',()=>{
 const jt=applyStageEnemyBlackboard(record,JT8_2);
 {
  const h=fixture([[10,6]],{rec:jt}),{ab}=h;
  h.run(159.9);assert.equal(ab.cast,null);h.run(.2);assert.equal(ab.cast?.skill.key,'DanceFire');
 }
 {
  const h=fixture([[10,6]],{rec:applyStageEnemyTalentMultipliers(jt,{'halfhp.hp_ratio':2})}),{ab}=h;
  h.run(.1);assert.equal(ab.half,true,'enraged at full HP');h.run(200);assert.equal(ab.cast,null);
 }
});
