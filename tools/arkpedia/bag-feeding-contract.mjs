// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {writeJSONAtomic} from './write-json.mjs';
import {verifyEnemyInstantKill} from '../../server/sim/enemy-instant-kill.js';
const root=new URL('../../',import.meta.url),sources={};
async function read(path){const raw=await readFile(new URL(path,root));sources[path]={path,sha256:createHash('sha256').update(raw).digest('hex')};return JSON.parse(raw);}
const review=await read('data/candidates/arkpedia-ch17-reviewed-bag.json'),inputs={};
for(const [key,pin]of Object.entries(review.sources)){inputs[key]=await read(pin.path);assert.equal(sources[pin.path].sha256,pin.sha256);}
assert.equal(inputs.events.events['1'].name,'ON_BUFF_FINISH');assert.equal(inputs.events.events['2'].name,'ON_BUFF_TRIGGER');
const graph=inputs.graph,enemies={};
for(const id of ['enemy_10209_mubag','enemy_10209_mubag_2']){
 const parts=graph.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
 for(const p of parts)assert.equal(createHash('sha256').update(p.originalJson).digest('hex'),p.sha256);
 const rows=parts.map(p=>({...p,data:JSON.parse(p.originalJson)})),one=f=>{const a=rows.filter(r=>f(r.data));assert.equal(a.length,1);return a[0];};
 const owner=one(d=>d._combat),combat=rows.find(r=>r.pathId===owner.data._combat.m_PathID);assert.ok(combat);assert.equal(owner.data._combat.m_FileID,0);
 const skill=one(d=>d._cooldownKey==='anim_duration');assert.equal(skill.data._affectedBySlowDown,0);assert.equal(skill.data._timeMode,3);
 const feeding=one(d=>d._buffs?.some(b=>b.buffKey==='enemy_mubag_atk_up')).data._buffs.find(b=>b.buffKey==='enemy_mubag_atk_up');
 assert.equal(feeding.lifeTime,review.defaults.feedingDuration);assert.equal(feeding.triggerInterval,review.defaults.feedingInterval);
 assert.deepEqual(feeding.attributes,{abnormalAntis:[],abnormalComboImmunes:[],abnormalCombos:[],abnormalFlags:[],abnormalImmunes:[],attributeModifiers:[]});
 assert.equal(feeding.lifeTimeType,1);assert.equal(feeding.statusResistable,2);
 enemies[id]={combatPathId:combat.pathId,combatOriginalJson:combat.originalJson,skillPathId:skill.pathId,skillOriginalJson:skill.originalJson,feeding,
  phaseDuration:review.enemies[id].skills[0].bb.anim_duration};
 assert.equal(enemies[id].phaseDuration,11);
}
const actions=(key,event)=>{
 const row=graph.templates[key];assert.equal(createHash('sha256').update(row.originalJson).digest('hex'),row.sha256);
 return JSON.parse(JSON.parse(row.originalJson).eventToActions._items.find(e=>e.key===event).value.SerializedState);
};
const kill=actions('enemy_mubag_kill_murad',2);assert.equal(kill.length,2);
assert.equal(kill[0].$type,'Torappu.Battle.Action.Nodes+CheckEnemySkillAffecting');assert.equal(kill[0]._targetType,'BUFF_SOURCE');
const nativeKill=verifyEnemyInstantKill(kill[1]);assert.equal(nativeKill._targetType,'BUFF_OWNER');
assert.equal(nativeKill._killSource,false);assert.equal(nativeKill._noSource,false);assert.equal(nativeKill._skipReborn,false);
const result={schemaVersion:1,testOnly:true,frameParity:false,scope:'Selected Bag feeding clocks, nonstatus feeding parent and native consumption action. No stage or Closure compatibility admission.',
 sources,eventNames:{finish:inputs.events.events['1'].name,trigger:inputs.events.events['2'].name},defaults:review.defaults,enemies,
 consume:kill,finishTrigger:actions('enemy_mubag_atk_up',1)};
const out=new URL('data/candidates/arkpedia-ch17-bag-feeding-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified both Bag feeding clocks and native consumption action');
