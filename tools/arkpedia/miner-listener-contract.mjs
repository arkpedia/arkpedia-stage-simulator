// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifiedChapter16FamilyGraph} from './enemy-support.mjs';
import {writeJSONAtomic} from './write-json.mjs';
const root=new URL('../../',import.meta.url),sources={},sha=b=>createHash('sha256').update(b).digest('hex');
async function read(path){const raw=await readFile(new URL(path,root));sources[path]={path,sha256:sha(raw)};return raw;}
const graphRaw=await read('data/candidates/arkpedia-ch16-miner-source.json');
const inventory=await read('data/arkpedia-cn-native-source.json'),enemyInventory=await read('data/arkpedia-cn-enemy-native-source.json');
const index=JSON.parse(await read('data/arkpedia-enemy-clock-source.json'));
const graph=verifiedChapter16FamilyGraph(graphRaw,inventory,enemyInventory,index);
const aliases=JSON.parse(await read('data/candidates/arkpedia-buff-event-alias-source.json'));
assert.equal(aliases.events[2].name,'ON_BUFF_TRIGGER');assert.equal(aliases.source.nativeInventory.sha256,sha(inventory));
const nodes=Object.values(graph.prefabs)[0].map(r=>({...r,data:JSON.parse(r.originalJson)}));
const ability=key=>{const matches=nodes.filter(r=>r.data._buffs?.some(b=>b.buffKey===key));assert.equal(matches.length,1);return matches[0];};
const rootBuff=key=>{const a=ability(key),b=a.data._buffs.find(b=>b.buffKey===key);
 for(const[k,v]of Object.entries({lifeTimeType:2,triggerLifeType:2,triggerInterval:.30000001192092896,waitFirstTriggerInterval:1,
  isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0}))assert.equal(b[k],v,k);
 return{abilityPathId:a.pathId,originalJson:a.originalJson,buff:b};};
const actions=key=>{const t=graph.templates[key];assert.equal(sha(t.originalJson),t.sha256);
 const events=JSON.parse(t.originalJson).eventToActions._items;assert.deepEqual(events.map(e=>e.key),[2]);
 return JSON.parse(events[0].value.SerializedState);};
const listener=rootBuff('mcreep_t[fear_listener]'),shadow=rootBuff('mcreep_t[work_espace_shadow]');
const conditional=actions(listener.buff.templateKey);assert.equal(conditional.length,1);
const branch=conditional[0];assert.ok(branch.$type.endsWith('+IfElse'));
assert.deepEqual(branch._conditionNode._buffKeys,['fear']);assert.equal(branch._conditionNode._targetType,'BUFF_OWNER');
assert.equal(branch._succeedNodes.length,3);assert.deepEqual(branch._succeedNodes[0]._buffKeys,['mcreep_t[fear_blood]']);
assert.ok(branch._succeedNodes[1].$type.endsWith('+IfNot'));
const create=branch._succeedNodes[2];assert.ok(create.$type.endsWith('+CreateBuff'));
assert.equal(create._isDerivedBuff,false);assert.equal(create._finishDerivedBuffIfParentFinish,false);
assert.equal(create._buffOwner,'BUFF_OWNER');assert.equal(create._useSpecialBuffSource,false);
const blood=create._buff;
for(const[k,v]of Object.entries({buffKey:'mcreep_t[fear_blood]',triggerInterval:1,firstTriggerInterval:1,waitFirstTriggerInterval:true,
 lifeTimeType:'INFINITY',triggerLifeType:'INFINITY',overrideType:'UNIQUE',loadFromDB:false,
 isSilenceable:false,isStunnable:false,isFreezable:false,isLevitatable:false}))assert.equal(blood[k],v,k);
assert.equal(branch._failNodes.length,1);const finish=branch._failNodes[0];
assert.ok(finish.$type.endsWith('+FinishBuffsById'));assert.equal(finish._buffKey,blood.buffKey);
assert.equal(finish._targetType,'BUFF_OWNER');assert.equal(finish._checkBuffSource,false);
const loss=actions(blood.templateKey);assert.equal(loss.length,3);
assert.ok(loss[0].$type.endsWith('+FilterByTargetHpRatio'));assert.equal(loss[0]._targetType,'BUFF_OWNER');
assert.equal(loss[0]._condType,'EQUALS');assert.equal(loss[0]._value,1);assert.equal(loss[0]._useSourceHpRatio,false);
assert.ok(loss[1].$type.endsWith('+IfNot'));assert.ok(loss[2].$type.endsWith('+FixedValueDamage'));
assert.equal(loss[2]._damageType,'PURE');assert.equal(loss[2]._damageKey,'value');assert.equal(loss[2]._targetType,'TARGET');
assert.equal(loss[2]._damageSourceType,'SOURCE');assert.equal(loss[2]._noSourceDamage,false);
const work=actions(shadow.buff.templateKey);assert.equal(work.length,1);const guardian=work[0];
assert.ok(guardian.$type.endsWith('+IfElse'));assert.deepEqual(guardian._conditionNode._buffKeys,['gyegrd_a[exist]']);
assert.equal(guardian._conditionNode._targetType,'BUFF_OWNER');assert.equal(guardian._succeedNodes.length,1);
assert.ok(guardian._succeedNodes[0].$type.endsWith('+FinishBuff'));
assert.equal(guardian._failNodes.length,3);assert.deepEqual(guardian._failNodes[0]._buffKeys,['fear']);
assert.ok(guardian._failNodes[1].$type.endsWith('+IfNot'));const change=guardian._failNodes[2];
assert.ok(change.$type.endsWith('+Main16ChangeTileShadowViaRange'));assert.equal(change._rangeId,'x-4');
assert.equal(change._temporaryEscapeShadowState,true);assert.equal(change._changeTileShadowState,false);
const result={schemaVersion:1,testOnly:true,frameParity:false,sources,listener,shadow,blood,
 templates:Object.fromEntries([listener.buff.templateKey,shadow.buff.templateKey,blood.templateKey].map(k=>[k,graph.templates[k]])),
 mapping:{guardianKey:'gyegrd_a[exist]',fearStatus:'fear',shadowRange:'x-4',shadowFinishesOnGuardian:true},
 limits:['Ordinary miner listener actions only. Fear is mapped to the shared logical Fear status. Each root uses a sampled native interval; the blood child waits its own full one-second interval after admission. Root and non-derived child ownership are distinct. Guardian FinishBuff is terminal for that root; existing tile suppression expires independently. Native initial attachment, compiled frame order and local 16-9 talent selection remain unproven. No local or stage admission.']};
const out=new URL('data/candidates/arkpedia-ch16-miner-listener-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified miner fear listener, independent one-second blood child and terminal Guardian shadow finish');
