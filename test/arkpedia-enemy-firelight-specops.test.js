// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAny,ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { StageReeds } from '../server/sim/content/arkpedia-stage-reeds.js';
import { enemySupport } from '../shared/arkpedia/enemy-support.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const ids=['enemy_1293_duswrd','enemy_1293_duswrd_2','enemy_1293_duswrd_3'];
function fixture(id=ids[0]){
 const h=spawnAny(id,{seconds:.1,autoFinish:false,units:[{chessId:'test_enemy_harness_guard',row:9,col:6},{chessId:'test_enemy_harness_guard',row:9,col:7}]}),{b}=h,e=b.enemies[0],u=b.allyUnits[0];
 e.x=u.x;e.y=u.y;e.tileR=u.tileR;e.tileC=u.tileC;e.blockedBy=u;u.blocking=[e];e.atkCd=0;
 for(const ally of b.allyUnits)b.addBuff(ally,{key:'hold',flags:{disarm:true,noMove:true}});const hits=[];
 b.on('damaged',c=>{if(c.source===e)hits.push({time:b.time,...c});});
 return{...h,e,u,hits,ability:e.mem.ab.list.find(a=>'charge'in a)};
}
for(const id of ids)test(`${id}: three ordinary attacks charge a five-event skill without extra ordinary damage`,()=>{
 const h=fixture(id),{b,e,u,hits,ability}=h;assert.ok(h.runUntil(()=>ability.cast,10));
 assert.equal(e.stats.attacks,3);assert.equal(ability.charge,0);assert.equal(hits.length,3);
 const start=b.time,atk=e.s.atk,scale=id.endsWith('_3')?1.2:1;h.run(.2);assert.equal(hits.length,3);
 h.run(1.7);const skill=hits.filter(c=>c.dmg.tags.includes('chargedMelee'));
 assert.equal(skill.length,5);assert.equal(new Set(skill.map(c=>c.dmg.attackId)).size,1);
 for(let i=0;i<5;i++){assert.ok(Math.abs(skill[i].time-start-[.3,16/30,1,40/30,55/30][i])<.07);assert.equal(skill[i].hpLoss,atk*scale-u.s.def);}
 assert.equal(ability.charge,0);assert.equal(e.mem.regularFormVisual.clip,'Skill');
 assert.ok(h.runUntil(()=>!ability.cast,2));assert.equal(e.mem.regularFormVisual,null);assert.equal(!!e.profile.noAttack,false);
 assert.deepEqual(b.errors,[]);
});
test('Silence holds the charge and terrain ignition remains active during Silence and stun',()=>{
 const h=fixture(),{b,e,u,ability,hits}=h;b.addBuff(e,{key:'silence',flags:{silence:true}});
 b.stageReeds=new StageReeds(b,{kind:'reeds',scanInterval:.1,damageInterval:1,entryStealth:.2,
  tiles:[0,1].map(dx=>({row:u.tileR,col:u.tileC+dx,ignite_duration:15,extinct_duration:20,cooldown_duration:5,damage:40,ep_damage:40}))});
 h.runUntil(()=>e.stats.attacks===4,12);assert.equal(ability.charge,3);assert.equal(ability.cast,undefined);
 assert.equal(b.stageReeds.at(u.tileR,u.tileC).mode,1);
 b.applyStatus(e,'stun',{duration:1});e.x++;h.run(.2);assert.equal(b.stageReeds.at(u.tileR,u.tileC+1).mode,1);
 h.run(1);b.removeBuff(e,'silence');assert.ok(h.runUntil(()=>ability.cast,4));assert.equal(hits.filter(c=>c.dmg.tags.includes('chargedMelee')).length,0);
});
test('stun interrupts future slashes and cleans up the cast without refunding spent charge',()=>{
 const h=fixture(),{b,e,ability,hits}=h;ability.charge=3;h.step();h.run(.4);
 assert.equal(hits.filter(c=>c.dmg.tags.includes('chargedMelee')).length,1);
 b.applyStatus(e,'stun',{duration:4});assert.equal(ability.cast,null);assert.equal(e.mem.regularFormVisual,null);
 h.run(3);assert.equal(hits.filter(c=>c.dmg.tags.includes('chargedMelee')).length,1);assert.equal(ability.charge,0);assert.deepEqual(b.errors,[]);
});
test('Slow Down stretches the native combo clock, and the locked target is never replaced after death',()=>{
 const h=fixture(),{b,e,u,ability,hits}=h;ability.charge=3;b.addBuff(e,{key:'slow',mods:{slowDownMul:.5}});
 h.step();h.run(.4);assert.equal(hits.length,0);h.run(.3);assert.equal(hits.length,1);
 b.kill(u);const next=b.allyUnits.find(a=>a!==u);e.blockedBy=next;next.blocking=[e];h.run(4.5);assert.equal(hits.length,1);assert.ok(ability.cast);e.blockedBy=null;next.blocking=[];h.run(.5);assert.equal(ability.cast,null);assert.deepEqual(b.errors,[]);
});
test('native admission rejects changed hit count, cast retargeting, ignition cadence and source skill scale',()=>{
 for(const id of ids)assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
 for(const change of ['count','retarget','cadence','silence']){
  const n=structuredClone(native),rows=n.prefabs[`dyn/battle/prefabs/enemies/${ids[0]}.prefab`];
  for(const row of rows){const d=JSON.parse(row.originalJson);
   if(change==='count'&&'_additionalTimes'in d)d._additionalTimes=5;
   if(change==='retarget'&&'_refreshInputTargetOnCheckSpell'in d)d._refreshInputTargetOnCheckSpell=1;
   if(row.objectName==='ignite'&&d._buffs){if(change==='cadence')d._buffs[0].triggerInterval=1;if(change==='silence')d._buffs[0].isSilenceable=1;}
   row.originalJson=JSON.stringify(d);
  }
  assert.equal(enemySupport(ENEMY_RECORDS.enemies[ids[0]],clocks.prefabs,n).policy,null,change);
 }
 const r=structuredClone(ENEMY_RECORDS.enemies[ids[2]]);r.levels[0].skills[0].bb.atk_scale=1;
 assert.equal(enemySupport(r,clocks.prefabs,native).policy,null);
});
