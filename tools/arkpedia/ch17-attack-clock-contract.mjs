// SPDX-License-Identifier: GPL-3.0-or-later
// Reproduce selected Combat bindings from retained verified source, never from
// a guessed animation/component name or a normalized skill-key inventory.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {writeJSONAtomic} from './write-json.mjs';
import {parseSkel} from '../assets/skel.mjs';
const root=new URL('../../',import.meta.url),sources={};
async function read(path){const raw=await readFile(new URL(path,root));sources[path]={path,sha256:createHash('sha256').update(raw).digest('hex')};return JSON.parse(raw);}
async function verified(row){const value=await read(row.path);assert.equal(sources[row.path].sha256,row.sha256,'Changed reviewed clock input: '+row.path);return value;}
const infantryReview=await read('data/candidates/arkpedia-ch17-reviewed-reactions.json');
const carrierReview=await read('data/candidates/arkpedia-ch17-reviewed-channel-carrier.json');
const support=await read('data/candidates/arkpedia-ch16-enemy-support.json');
const records=(await verified(support.source.records)).enemies;
const infantry=await verified(infantryReview.sources.graph),carrier=await verified(carrierReview.sources.graph);
const infantryAnimation=await read('data/candidates/arkpedia-ch17-infantry-bow-animation-source.json');
const carrierAnimation=await read('data/candidates/arkpedia-ch17-channel-carrier-animation-source.json');
for(const [a,review]of [[infantryAnimation,infantryReview],[carrierAnimation,carrierReview]])assert.deepEqual(a.source.graph,review.sources.graph);
const ids=['enemy_10201_muinf','enemy_10201_muinf_2','enemy_10203_mumag','enemy_10203_mumag_2','enemy_10208_mucow','enemy_10208_mucow_2'];
const enemies={};
for(const id of ids){
 const graph=(id.includes('muinf')?infantry:carrier).prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];assert.ok(graph);
 const roots=graph.filter(c=>JSON.parse(c.originalJson)._combat);assert.equal(roots.length,1);
 const root=roots[0],ref=JSON.parse(root.originalJson)._combat;assert.equal(ref.m_FileID,0);assert.notEqual(ref.m_PathID,'0');
 const attacks=graph.filter(c=>c.pathId===ref.m_PathID);assert.equal(attacks.length,1);const attack=attacks[0],n=JSON.parse(attack.originalJson);
 assert.equal(n._animKey,'Attack');assert.equal(n._affectedBySlowDown,1);assert.equal(n._timeMode,0);assert.equal(n._maxAnimScale,1);
 assert.equal(n._cooldown,0);assert.equal(n._cooldownKey,'duration');assert.equal(n._resetCdStrategy,1);assert.equal(n._waitForAttackEvent,1);
 assert.equal(n._selectTargetTiming,0);assert.equal(n._selectTargetSource,2);assert.equal(n._interuptIfTargetDead,0);assert.equal(n._ignoreIfOwnerDead,0);
 assert.equal(n._allowNoTarget,0);assert.equal(n._alwaysIncludeTarget,1);assert.equal(n._preDelay,0);assert.equal(n._escapeTime,0);
 for(const c of [root,attack])assert.equal(createHash('sha256').update(c.originalJson).digest('hex'),c.sha256);
 const levels=Object.fromEntries(Object.entries(records[id].levels).map(([level,r])=>{
  assert.equal(r.key,id);assert.equal(r.prefabKey,id);assert.equal(String(r.level),level);
  return[level,{applyWay:r.applyWay,groups:r.talents.groups,bb:r.talents.bb,abilities:r.abilities,skills:r.skills}];
 }));
 const animation=(id.includes('muinf')?infantryAnimation:carrierAnimation).enemies[id],raw=Buffer.from(animation.base64,'base64');
 assert.equal(raw.length,animation.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),animation.sha256);
 assert.equal(createHash('sha256').update(animation.skeletonDataOriginalJson).digest('hex'),animation.skeletonDataSha256);
 const skeletonBindings=graph.map(c=>JSON.parse(c.originalJson).skeletonDataAsset).filter(Boolean);assert.equal(skeletonBindings.length,1);
 assert.deepEqual(animation.prefabBinding,skeletonBindings[0]);assert.equal(animation.skeletonDataPathId,animation.prefabBinding.m_PathID);
 const skel=parseSkel(raw,undefined,{includeExactDurations:true,includeEventPayloads:true}),duration=skel.exactDurations.Attack,events=skel.eventPayloads.Attack;
 assert.ok(Number.isFinite(duration)&&duration>0);assert.equal(events.length,1);assert.equal(events[0].name,'OnAttack');assert.ok(events[0].time>0&&events[0].time<duration);
 enemies[id]={combatPathId:ref.m_PathID,rootPathId:root.pathId,native:[root.originalJson,attack.originalJson],levels,
  attack:{duration,hit:events[0].time,damageType:n._damageType===1?'phys':n._damageType===2?'arts':null}};
 assert.ok(enemies[id].attack.damageType);
}
const result={schemaVersion:1,testOnly:true,frameParity:false,
 scope:'Exact selected Chapter 17 ordinary Combat clocks and bound Attack event markers. No stage, S3 enemy compatibility, compiled FSM/frame or other ability clock admission.',
 sources,enemies};
const out=new URL('data/candidates/arkpedia-ch17-attack-clock-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);
else await writeJSONAtomic(out,result);
console.log('Verified selected Chapter 17 Combat clocks:',ids.join(', '));
