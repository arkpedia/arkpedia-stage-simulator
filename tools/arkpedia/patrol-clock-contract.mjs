// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { parseSkel } from '../assets/skel.mjs';
import { writeJSONAtomic } from './write-json.mjs';
const root=new URL('../../',import.meta.url),sources={},sha=b=>createHash('sha256').update(b).digest('hex');
async function read(path,pin){const raw=await readFile(new URL(path,root));if(pin)assert.equal(sha(raw),pin);sources[path]={path,sha256:sha(raw)};return JSON.parse(raw);}
const review=await read('data/candidates/arkpedia-ch16-reviewed-patrol.json');
const graph=await read(review.sources.graph.path,review.sources.graph.sha256);
await read(review.sources.indexed.path,review.sources.indexed.sha256);
const animation=await read('data/candidates/arkpedia-ch16-patrol-animation-source.json');
assert.equal(animation.source.graph.sha256,review.sources.graph.sha256);
await read(animation.source.inventory.path,animation.source.inventory.sha256);
const id=review.enemy.key,rows=graph.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
for(const row of rows)assert.equal(sha(row.originalJson),row.sha256);
const nodes=rows.map(row=>({...row,data:JSON.parse(row.originalJson)}));
const body=nodes.filter(row=>row.data._modes&&row.data._animator);assert.equal(body.length,1);
assert.equal(body[0].data._modes.length,1);
const resolve=ref=>{assert.equal(ref.m_FileID,0);const row=nodes.find(r=>r.pathId===ref.m_PathID);assert.ok(row,'Missing original native reference');return row;};
const mode=resolve(body[0].data._modes[0]),animator=resolve(body[0].data._animator),skeleton=resolve(animator.data._skeleton);
assert.notEqual(mode.data._attack.m_PathID,mode.data._combat.m_PathID);
const row=animation.enemies[id],raw=Buffer.from(row.base64,'base64');
assert.deepEqual(skeleton.data.skeletonDataAsset,row.prefabBinding);
assert.equal(row.prefabBinding.m_PathID,row.skeletonDataPathId);
assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);
assert.equal(sha(row.skeletonDataOriginalJson),row.skeletonDataSha256);
const d=parseSkel(raw,undefined,{includeEventPayloads:true,includeExactDurations:true}),casts={};
for(const key of ['attack','combat']){
 const cast=resolve(mode.data['_'+key]),n=cast.data;
 for(const[k,v]of Object.entries({_animKey:key==='attack'?'Attack_01':'Attack_02',_timeMode:0,_affectedBySlowDown:1,
  _maxAnimScale:1,_selectTargetSource:2,_selectTargetTiming:0,_waitForAttackEvent:1,_interruptAbilityOnDetach:0,_damageType:1,_attackType:1}))assert.equal(n[k],v,k);
 if(key==='attack'){assert.equal(n._projectileKey,'projectile_enemy_uoffcr');assert.equal(n._useCachedAtkOnly,0);}
 const aliases=animator.data._animations.filter(a=>a.animKey===n._animKey);assert.equal(aliases.length,1);
 const alias=aliases[0];assert.equal(alias.animName,key==='attack'?'Attack':'Combat');
 assert.equal(alias.speed,1);assert.equal(alias.loop,0);assert.equal(alias.ignoreMissing,0);
 assert.equal(d.eventPayloads[alias.animName].length,1);assert.equal(d.eventPayloads[alias.animName][0].name,'OnAttack');
 casts[key]={pathId:cast.pathId,originalJson:cast.originalJson,alias,hit:d.eventPayloads[alias.animName][0].time,duration:d.exactDurations[alias.animName]};
}
const result={schemaVersion:1,testOnly:true,frameParity:false,sources,enemies:{[id]:{bodyPathId:body[0].pathId,
 modePathId:mode.pathId,animatorPathId:animator.pathId,animatorOriginalJson:animator.originalJson,skeletonPathId:skeleton.pathId,casts}},
 limits:['Native body/mode/animator/skeleton references bind Attack_01->Attack and Attack_02->Combat, separate cooldowns and original binary markers. TimeMode0 samples capped BAT/interval and consumes eligible live slow_down. Input deployment and mode are captured; born shots retain separate world time and source lives. Native initial FSM and exact mid-clip mode handoff/frame ordering remain held; interruptAbilityOnDetach0 is retained rather than treated as proof. The explicit simulator port serializes accepted clips.']};
const out=new URL('data/candidates/arkpedia-ch16-patrol-clock-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified Patrol Captain native animator aliases, original binary clocks and cast bindings');
