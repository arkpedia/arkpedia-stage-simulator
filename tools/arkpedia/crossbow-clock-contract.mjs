// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { parseJsonSkel } from '../assets/skel.mjs';
import { writeJSONAtomic } from './write-json.mjs';
const root=new URL('../../',import.meta.url),sources={},sha=b=>createHash('sha256').update(b).digest('hex');
async function read(path,pin){const raw=await readFile(new URL(path,root));if(pin)assert.equal(sha(raw),pin);sources[path]={path,sha256:sha(raw)};return JSON.parse(raw);}
const review=await read('data/candidates/arkpedia-ch16-reviewed-crossbow.json');
const graph=await read(review.sources.graph.path,review.sources.graph.sha256);
await read(review.sources.indexed.path,review.sources.indexed.sha256);
const animation=await read('data/candidates/arkpedia-ch16-crossbow-animation-source.json');
assert.equal(animation.source.graph.sha256,review.sources.graph.sha256);
await read(animation.source.inventory.path,animation.source.inventory.sha256);
const enemies={};
for(const id of Object.keys(review.enemies)){
  const rows=graph.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
  for(const row of rows)assert.equal(sha(row.originalJson),row.sha256);
  const nodes=rows.map(row=>({...row,data:JSON.parse(row.originalJson)}));
  const modes=nodes.filter(row=>row.data._attack&&row.data._combat);assert.equal(modes.length,1);
  const mode=modes[0];assert.notEqual(mode.data._attack.m_PathID,mode.data._combat.m_PathID);
  const row=animation.enemies[id],raw=Buffer.from(row.base64,'base64');
  assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);
  assert.equal(sha(row.skeletonDataOriginalJson),row.skeletonDataSha256);
  assert.equal(row.prefabBinding.m_PathID,row.skeletonDataPathId);
  const d=parseJsonSkel(raw,undefined,{includeEventPayloads:true,includeExactDurations:true}),casts={};
  for(const key of ['attack','combat']){
    const reference=mode.data['_'+key];assert.equal(reference.m_FileID,0);
    const cast=nodes.find(row=>row.pathId===reference.m_PathID),n=cast.data,anim=key==='attack'?'Attack':'Skill';
    for(const[k,v]of Object.entries({_animKey:anim,_timeMode:0,_affectedBySlowDown:1,_maxAnimScale:1,
      _selectTargetSource:2,_selectTargetTiming:0,_waitForAttackEvent:1,_damageType:1,_attackType:1}))assert.equal(n[k],v,k);
    if(key==='attack'){assert.equal(n._projectileKey,'projectile_enemy_uasnip');assert.equal(n._useCachedAtkOnly,0);assert.equal(n._atkScaleKey,'atk_scale_2');}
    else assert.equal(n._atkScaleKey,'atk_scale');
    assert.equal(d.eventPayloads[anim].length,1);assert.equal(d.eventPayloads[anim][0].name,'OnAttack');
    casts[key]={pathId:cast.pathId,originalJson:cast.originalJson,hit:d.eventPayloads[anim][0].time,duration:d.exactDurations[anim]};
  }
  enemies[id]={modePathId:mode.pathId,casts};
}
const result={schemaVersion:1,testOnly:true,frameParity:false,sources,enemies,
  limits:['Distinct native Attack/Combat components retain independent cooldowns. Original JSON animation markers, captured input deployment/mode, sampled capped TimeMode0 playback and live eligible slow_down are bound. Born ranged output has a separate world clock and source life. Native initial FSM and exact mid-clip mode handoff/frame ordering remain held; the explicit simulator port serializes accepted clips. Listener direct-radius geometry remains the existing test-only center model.']};
const out=new URL('data/candidates/arkpedia-ch16-crossbow-clock-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified both crossbow Attack/Combat bindings and original JSON event clocks');
