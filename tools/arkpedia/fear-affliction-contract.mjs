// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { verifiedChapter16FamilyGraph } from './enemy-support.mjs';
import { writeJSONAtomic } from './write-json.mjs';
const root=new URL('../../',import.meta.url),sources={},sha=b=>createHash('sha256').update(b).digest('hex');
async function read(path,pin){const raw=await readFile(new URL(path,root));if(pin)assert.equal(sha(raw),pin);sources[path]={path,sha256:sha(raw)};return raw;}
const graphRaw=await read('data/candidates/arkpedia-ch16-fear-projectile-source.json');
const inventory=await read('data/arkpedia-cn-native-source.json'),enemyInventory=await read('data/arkpedia-cn-enemy-native-source.json');
const index=JSON.parse(await read('data/arkpedia-enemy-clock-source.json'));
const graph=verifiedChapter16FamilyGraph(graphRaw,inventory,enemyInventory,index);
const aliases=JSON.parse(await read('data/candidates/arkpedia-buff-event-alias-source.json'));
assert.equal(aliases.events[0].name,'ON_BUFF_START');assert.equal(aliases.events[2].name,'ON_BUFF_TRIGGER');
assert.equal(aliases.source.nativeInventory.sha256,sha(inventory));
const rows=graph.prefabs['dyn/battle/prefabs/enemies/enemy_10128_fearpj.prefab'];
const casts=rows.filter(row=>JSON.parse(row.originalJson)._activeBuffs?.some(b=>b.templateKey==='feawpj_a[mcreep_fear]'));
assert.equal(casts.length,1);const parent=JSON.parse(casts[0].originalJson)._activeBuffs.find(b=>b.templateKey==='feawpj_a[mcreep_fear]');
for(const[k,v]of Object.entries({buffKey:'feawpj_a[mcreep_fear]',lifeTimeType:2,triggerInterval:.5,waitFirstTriggerInterval:1,
 isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,disableOverride:0,overrideType:2,maxStackCnt:1}))assert.equal(parent[k],v,k);
const template=graph.templates[parent.templateKey];
assert.equal(sha(template.originalJson),template.sha256);
const events=JSON.parse(template.originalJson).eventToActions._items;
assert.deepEqual(events.map(e=>e.key),[0,2]);
const start=JSON.parse(events[0].value.SerializedState),tick=JSON.parse(events[1].value.SerializedState);
assert.equal(start.length,1);const conditional=start[0];assert.ok(conditional.$type.endsWith('+IfElse'));
assert.deepEqual(conditional._conditionNode._buffKeys,['enemy_mcreep_self_mark']);
assert.equal(conditional._conditionNode._targetType,'BUFF_OWNER');assert.equal(conditional._conditionNode.isAND,true);
for(const k of ['_loadFromBlackboard','_checkBuffSource','_checkSourceHost'])assert.equal(conditional._conditionNode[k],false,k);
assert.equal(conditional._failNodes.length,1);assert.ok(conditional._failNodes[0].$type.endsWith('+FinishBuff'));
const children=conditional._succeedNodes;assert.equal(children.length,2);
for(const child of children){assert.ok(child.$type.endsWith('+CreateBuff'));assert.equal(child._buffOwner,'BUFF_OWNER');
 assert.equal(child._isDerivedBuff,true);assert.equal(child._finishDerivedBuffIfParentFinish,true);assert.equal(child._useSpecialBuffSource,false);
 for(const k of ['isSilenceable','isStunnable','isFreezable','isLevitatable'])assert.equal(child._buff[k],false,k);
 assert.equal(child._buff.statusResistable,'AUTOMATIC');}
assert.equal(children[0]._buff.buffKey,'fear');assert.equal(children[0]._buff.loadFromDB,true);
assert.equal(children[0]._buff.lifeTimeType,'LIMITED');
assert.deepEqual(children[0]._buff.blackboard,[{key:'fear',value:999999,valueStr:''}]);
assert.equal(children[1]._buff.buffKey,'fearpj_a[mcreep_disarmed]');assert.equal(children[1]._buff.lifeTimeType,'INFINITY');
assert.deepEqual(children[1]._buff.attributes.abnormalFlags,['DISARMED']);assert.equal(children[1]._buff.loadFromDB,false);
assert.equal(children[1]._buff.overrideType,'UNIQUE');assert.equal(children[1]._buff.maxStackCnt,1);
assert.equal(tick.length,2);assert.ok(tick[0].$type.endsWith('+FilterByTargetHpRatio'));
assert.equal(tick[0]._targetType,'BUFF_OWNER');assert.equal(tick[0]._condType,'EQUALS');assert.equal(tick[0]._value,1);
assert.equal(tick[0]._useSourceHpRatio,false);assert.ok(tick[1].$type.endsWith('+FinishBuff'));
const result={schemaVersion:1,testOnly:true,frameParity:false,sources,
 castPathId:casts[0].pathId,parent,templateOriginalJson:template.originalJson,
 defaults:{parentKey:parent.buffKey,minerMark:'enemy_mcreep_self_mark',interval:parent.triggerInterval,fearDuration:children[0]._buff.blackboard[0].value,
 disarmKey:children[1]._buff.buffKey},
 limits:['Only the retained affliction parent/derived Fear/Disarm and sampled full-HP finish are mapped. Unique parent replacement and independently keyed child receipts are explicit simulator ownership mappings. Fear uses the existing engine status/immunity/resistance/movement implementation. Launch, native self-destruction/death dispatch, compiled frame parity, stage-local miner support and16-9 admission remain held. No original OnAttack marker is fabricated.']};
const out=new URL('data/candidates/arkpedia-ch16-fear-affliction-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified source-bound fear-projectile affliction parent, derived children and full-HP finish');
