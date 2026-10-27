// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifiedChapter16FamilyGraph} from './enemy-support.mjs';
import {parseJsonSkel} from '../assets/skel.mjs';
import {compileStageLocalEnemy} from '../../shared/arkpedia/enemy-records.js';
import {writeJSONAtomic} from './write-json.mjs';
const root=new URL('../../',import.meta.url),sources={},sha=b=>createHash('sha256').update(b).digest('hex');
async function read(path){const raw=await readFile(new URL(path,root));sources[path]={path,sha256:sha(raw)};return raw;}
const graphRaw=await read('data/candidates/arkpedia-ch16-miner-source.json');
const inventory=await read('data/arkpedia-cn-native-source.json'),enemyInventory=await read('data/arkpedia-cn-enemy-native-source.json');
const index=JSON.parse(await read('data/arkpedia-enemy-clock-source.json'));
const graph=verifiedChapter16FamilyGraph(graphRaw,inventory,enemyInventory,index);
const animation=JSON.parse(await read('data/candidates/arkpedia-ch16-miner-animation-source.json'));
assert.equal(animation.source.graph.sha256,sha(graphRaw));assert.equal(animation.source.inventory.sha256,sha(inventory));
const id='enemy_3010_mcreep',rows=graph.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
const nodes=rows.map(row=>({...row,data:JSON.parse(row.originalJson)}));
const resolve=ref=>{assert.equal(ref.m_FileID,0);const row=nodes.find(r=>r.pathId===ref.m_PathID);assert.ok(row);return row;};
const bodies=nodes.filter(r=>r.data._modes&&r.data._animator);assert.equal(bodies.length,1);
const body=bodies[0];assert.equal(body.data._modes.length,1);assert.deepEqual(body.data._commonAbilities,[]);
const mode=resolve(body.data._modes[0]),animator=resolve(body.data._animator),skeleton=resolve(animator.data._skeleton);
const cast=resolve(mode.data._attack),n=cast.data;
assert.equal(mode.data._combat.m_PathID,'0');
for(const[k,v]of Object.entries({_animKey:'Attack',_timeMode:0,_affectedBySlowDown:1,_maxAnimScale:1,
 _waitForAttackEvent:1,_selectTargetSource:2,_selectTargetTiming:0,_damageType:1,_attackType:1,
 _interruptAbilityOnDetach:1,_atkScale:1,_useDynamicAttackType:0}))assert.equal(n[k],v,k);
assert.deepEqual(n._activeBuffs,[]);
const aliases=animator.data._animations.filter(a=>a.animKey===n._animKey);assert.equal(aliases.length,1);
const alias=aliases[0];assert.deepEqual(alias,{animKey:'Attack',animName:'Attack',ignoreMissing:1,loop:0,speed:1});
const original=animation.enemies[id],raw=Buffer.from(original.base64,'base64');
assert.deepEqual(skeleton.data.skeletonDataAsset,original.prefabBinding);
assert.equal(original.prefabBinding.m_PathID,original.skeletonDataPathId);
assert.equal(raw.length,original.bytes);assert.equal(sha(raw),original.sha256);
assert.equal(sha(original.skeletonDataOriginalJson),original.skeletonDataSha256);
const parsed=parseJsonSkel(raw,undefined,{includeEventPayloads:true,includeExactDurations:true});
assert.equal(parsed.eventPayloads.Attack.length,1);assert.equal(parsed.eventPayloads.Attack[0].name,'OnAttack');
const talentBindings={};
for(const key of ['GetHeal','TileEscapeShadowManager','FearLoseBlood']){
 const go=nodes.find(r=>r.componentType==='GameObject'&&r.data.m_Name===key);assert.ok(go);
 const components=go.data.m_Component.map(p=>resolve(p.component));
 const binding=components.find(r=>r.data._overwriteTalentKey==='');assert.ok(binding);
 assert.equal(binding.data._affectWhenNotRootTalent,0);assert.equal(binding.data._applyBlackboardBySkill,0);
 const ability=components.find(r=>r.data._buffs);assert.ok(ability);
 assert.ok(ability.data._buffs.every(b=>b.blackboard.length===0));
 talentBindings[key]={gameObjectPathId:go.pathId,bindingPathId:binding.pathId,bindingOriginalJson:binding.originalJson,
  abilityPathId:ability.pathId,abilityOriginalJson:ability.originalJson};
}
const stage=JSON.parse(await read('data/candidates/arkpedia-stage-16-9-source.json'));
const refs=stage.rawLevel.enemyDbRefs.filter(r=>r.useDb===false);assert.equal(refs.length,1);
const local=compileStageLocalEnemy(refs[0],{damageType:'PHYSIC'});
assert.equal(local.prefabKey,id);assert.deepEqual(local.talents.bb,{'FearLoseBlood.value':0});
const result={schemaVersion:1,testOnly:true,frameParity:false,sources,enemy:id,
 bodyPathId:body.pathId,modePathId:mode.pathId,animatorPathId:animator.pathId,alias,
 cast:{pathId:cast.pathId,originalJson:cast.originalJson,hit:parsed.eventPayloads.Attack[0].time,
  duration:parsed.exactDurations.Attack,damageType:'phys'},talentBindings,
 local:{stage:'16-9',record:local},
 limits:['Original prefab/animator/skeleton references bind the physical Attack and its JSON OnAttack marker. The simulator uses sampled capped TimeMode0 playback, current eligible slowdown, captured input deployments and owned movement holds. Initial FSM and compiled frame ordering remain unproven.',
 'The local definition uses the physical native Attack, not a NO_DAMAGE handbook surrogate. It contains only FearLoseBlood.value=0. Native talent components have empty parameter blackboards and no explicit fallback for absent GetHeal/TileEscapeShadowManager; local talent attachment, passive healing/shadow behavior and full 16-9 integration remain held. This contract grants no local enemy or stage support.']};
const out=new URL('data/candidates/arkpedia-ch16-miner-clock-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified miner original attack clock, native talent bindings and isolated 16-9 physical record');
