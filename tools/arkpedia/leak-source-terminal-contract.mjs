// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {writeJSONAtomic} from './write-json.mjs';
import {verifyEnemyInstantKill} from '../../server/sim/enemy-instant-kill.js';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),sources={};
async function read(path,pin){const raw=await readFile(new URL(path,root));assert.equal(sha(raw),pin);sources[path]={path,sha256:pin};return JSON.parse(raw);}
const graph=await read('data/candidates/arkpedia-ch16-action-source.json','f54ddb0a56f4ac0c56253f67c162cc8a5ceca91713d81de18fad463b382e6338');
const native=await read('data/candidates/arkpedia-ch16-native-abilities.json','51b97736e90dbaa29ab09cf7fb46d940f576ea1aa4b0f6fae39f76c487314269');
const events=await read('data/candidates/arkpedia-buff-event-alias-source.json','df85c1d8ee05e0391c7be3854bb39632bdf5282b1f48b061c4e7af5b5397e407');
assert.equal(events.events['1'].name,'ON_BUFF_FINISH');assert.equal(events.events['2'].name,'ON_BUFF_TRIGGER');
const templates={};
for(const key of ['enemy_murad_s_flag','enemy_murad_locate_passive','enemy_murad_check_appear']){
 const row=graph.templates[key];assert.equal(sha(row.originalJson),row.sha256);templates[key]=row;
}
const actions=(key,event)=>JSON.parse(JSON.parse(templates[key].originalJson).eventToActions._items.find(e=>e.key===event).value.SerializedState);
const finish=actions('enemy_murad_s_flag',1),trigger=actions('enemy_murad_check_appear',2),locate=actions('enemy_murad_locate_passive',2);
assert.equal(finish.length,2);assert.equal(trigger.length,8);assert.equal(locate.length,6);
assert.equal(finish[0].$type,'Torappu.Battle.Action.Nodes+IfTarget');assert.equal(finish[0]._targetType,'BUFF_OWNER');assert.equal(finish[0]._checkTargetAlive,true);
for(const [action,recipient] of [[finish[1],'BUFF_OWNER'],[trigger[7],'BUFF_SOURCE']]){
 const kill=verifyEnemyInstantKill(action);assert.equal(kill._targetType,recipient);
 for(const key of ['_killSource','_noSource','_skipReborn'])assert.equal(kill[key],false);
}
const create=locate[3];assert.equal(create.$type,'Torappu.Battle.Action.Nodes+CreateBuff');assert.equal(create._buff.buffKey,'enemy_murad_check_appear');assert.equal(create._buff.templateKey,'enemy_murad_check_appear');
assert.equal(create._buffOwner,'BUFF_OWNER');assert.equal(create._useSpecialBuffSource,false);assert.equal(create._isDerivedBuff,true);assert.equal(create._finishDerivedBuffIfParentFinish,true);
const rows=native.prefabs['dyn/battle/prefabs/enemies/enemy_10211_murad.prefab'];
const creators=rows.filter(r=>JSON.parse(r.originalJson)._buffs?.some(b=>['enemy_murad_s_flag','enemy_murad_locate_passive'].includes(b.buffKey)));
assert.equal(creators.length,2);
const result={schemaVersion:1,testOnly:true,runtimeIntegrated:false,frameParity:false,
 scope:'Literal Leak Source terminal recipients, parent creation and original action graphs. Caller/action-source kill credit remains unresolved; no controller conversion, stage or enemy compatibility admission.',
 sources,eventNames:{finish:events.events['1'].name,trigger:events.events['2'].name},templates,
 creators:creators.map(r=>({...r,sha256:sha(r.originalJson)})),terminal:{finish:{template:'enemy_murad_s_flag',event:1,index:1,action:finish[1]},contact:{template:'enemy_murad_check_appear',event:2,index:7,action:trigger[7]}}};
const out=new URL('data/candidates/arkpedia-leak-source-terminal-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified Leak Source terminal recipients; caller kill credit and runtime conversion remain held');
