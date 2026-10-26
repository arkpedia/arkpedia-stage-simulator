// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {writeJSONAtomic} from './write-json.mjs';import {parseSkel} from '../assets/skel.mjs';
const root=new URL('../../',import.meta.url),sources={},sha=b=>createHash('sha256').update(b).digest('hex');
async function read(path,pin){const raw=await readFile(new URL(path,root));if(pin)assert.equal(sha(raw),pin,path);sources[path]={path,sha256:sha(raw)};return JSON.parse(raw);}
const review=await read('data/candidates/arkpedia-ch16-reviewed-fortbreaker.json'),inputs={};
for(const[key,row]of Object.entries(review.sources))inputs[key]=await read(row.path,row.sha256);
const enemies={};
for(const id of Object.keys(review.enemies)){
 const rows=inputs.graph.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`],nodes=rows.map(r=>({...r,data:JSON.parse(r.originalJson)}));
 for(const r of rows)assert.equal(sha(r.originalJson),r.sha256);
 const one=f=>{const matches=nodes.filter(r=>f(r.data));assert.equal(matches.length,1);return matches[0];};
 const mode=one(n=>n._attack&&n._combat),rootNode=one(n=>n._commonAbilities),skill=one(n=>n._familyMask!==undefined);
 const cast={};for(const key of ['attack','combat']){
  const ref=mode.data['_'+key];assert.equal(ref.m_FileID,0);const row=nodes.find(r=>r.pathId===ref.m_PathID);assert.ok(row);
  assert.equal(row.data._animKey,key==='attack'?'F_Attack':'F_Combat');assert.equal(row.data._timeMode,0);assert.equal(row.data._affectedBySlowDown,1);assert.equal(row.data._maxAnimScale,1);
  assert.equal(row.data._selectTargetSource,key==='attack'?1:2);assert.equal(row.data._selectTargetTiming,key==='attack'?1:0);assert.equal(row.data._waitForAttackEvent,1);
  cast[key]={pathId:row.pathId,originalJson:row.originalJson};
 }
 const volley=one(n=>n._animKey==='F_Skill');assert.equal(volley.data._timeMode,1);assert.equal(volley.data._affectedBySlowDown,1);assert.equal(volley.data._maxAnimScale,1);
 assert.equal(volley.data._selectTargetSource,1);assert.equal(volley.data._selectTargetTiming,1);assert.equal(volley.data._waitAttackEventForAllAttacks,0);assert.equal(volley.data._useCachedAtkOnly,0);
 // The wrapper's trigger is its selector, not its cast. Bind the sequence
 // through their shared GameObject component list, then follow its abilities.
 const owner=nodes.find(r=>r.pathId===skill.data.m_GameObject.m_PathID);assert.ok(owner);
 const components=owner.data.m_Component.map(r=>r.component);
 assert.ok(components.some(r=>r.m_FileID===0&&r.m_PathID===skill.pathId));
 const sequence=nodes.filter(r=>components.some(p=>p.m_FileID===0&&p.m_PathID===r.pathId)&&r.data._abilities);
 assert.equal(sequence.length,1);
 const seen=new Set(),pending=[{m_FileID:0,m_PathID:sequence[0].pathId}];
 while(pending.length){const ref=pending.pop();assert.equal(ref.m_FileID,0);if(ref.m_PathID==='0'||seen.has(ref.m_PathID))continue;seen.add(ref.m_PathID);const n=nodes.find(r=>r.pathId===ref.m_PathID);assert.ok(n);for(const p of [n.data._mainAbility,...(n.data._abilities??[]),...(n.data._subAbilities??[])].filter(Boolean))pending.push(p);}
 assert.ok(seen.has(volley.pathId));
 const animation=inputs.animation.enemies[id],raw=Buffer.from(animation.base64,'base64');assert.equal(raw.length,animation.bytes);assert.equal(sha(raw),animation.sha256);
 const decoded=parseSkel(raw,undefined,{includeExactDurations:true,includeEventPayloads:true}),timings={};
 for(const key of ['attack','combat','skill']){const clip=key==='skill'?'F_Skill':key==='attack'?'F_Attack':'F_Combat',events=decoded.eventPayloads[clip];assert.equal(events.length,1);assert.equal(events[0].name,'OnAttack');timings[key]={hit:events[0].time,duration:decoded.exactDurations[clip]};}
 enemies[id]={mode:{pathId:mode.pathId,originalJson:mode.originalJson},root:{pathId:rootNode.pathId,originalJson:rootNode.originalJson},wrapper:{pathId:skill.pathId,originalJson:skill.originalJson},
  casts:{...cast,skill:{pathId:volley.pathId,originalJson:volley.originalJson}},timings,burstInterval:volley.data._triggerDelta};
}
const result={schemaVersion:1,testOnly:true,frameParity:false,scope:'Selected Fortbreaker ordinary and volley clocks. Base support unchanged; Mk-II AttackParam/KillBonusAura remain unimplemented and unadmitted.',sources,enemies,
 limits:['TimeMode 0 samples ordinary BAT/interval capped at one; TimeMode 1 uses the fixed skill clip rate. Eligible elapsed cast work consumes current slow_down. These are explicit regular-engine mappings, not compiled/frame proof.',
 'Unborn volley rounds share the cast clock. Already-born projectile travel/impact delays remain world-clock work and retain their source deployment.']};
const out=new URL('data/candidates/arkpedia-ch16-fortbreaker-clock-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified Fortbreaker Attack/Combat and source-bound volley clocks for both retained prefabs');
