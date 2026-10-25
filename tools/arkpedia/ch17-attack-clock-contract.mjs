// SPDX-License-Identifier: GPL-3.0-or-later
// Reproduce selected Combat bindings from retained verified source, never from
// a guessed animation/component name or a normalized skill-key inventory.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {writeJSONAtomic} from './write-json.mjs';
const root=new URL('../../',import.meta.url),sources={};
async function read(path){const raw=await readFile(new URL(path,root));sources[path]={path,sha256:createHash('sha256').update(raw).digest('hex')};return JSON.parse(raw);}
async function verified(row){const value=await read(row.path);assert.equal(sources[row.path].sha256,row.sha256,'Changed reviewed clock input: '+row.path);return value;}
const infantryReview=await read('data/candidates/arkpedia-ch17-reviewed-reactions.json');
const carrierReview=await read('data/candidates/arkpedia-ch17-reviewed-channel-carrier.json');
const support=await read('data/candidates/arkpedia-ch16-enemy-support.json');
const records=(await verified(support.source.records)).enemies;
const infantry=await verified(infantryReview.sources.graph),carrier=await verified(carrierReview.sources.graph);
const ids=['enemy_10201_muinf','enemy_10201_muinf_2','enemy_10203_mumag','enemy_10203_mumag_2','enemy_10208_mucow','enemy_10208_mucow_2'];
const enemies={};
for(const id of ids){
 const graph=(id.includes('muinf')?infantry:carrier).prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];assert.ok(graph);
 const roots=graph.filter(c=>JSON.parse(c.originalJson)._combat);assert.equal(roots.length,1);
 const root=roots[0],ref=JSON.parse(root.originalJson)._combat;assert.equal(ref.m_FileID,0);assert.notEqual(ref.m_PathID,'0');
 const attacks=graph.filter(c=>c.pathId===ref.m_PathID);assert.equal(attacks.length,1);const attack=attacks[0],n=JSON.parse(attack.originalJson);
 assert.equal(n._animKey,'Attack');assert.equal(n._affectedBySlowDown,1);assert.equal(n._timeMode,0);assert.equal(n._maxAnimScale,1);
 assert.equal(n._cooldown,0);assert.equal(n._cooldownKey,'duration');assert.equal(n._resetCdStrategy,1);assert.equal(n._waitForAttackEvent,1);
 for(const c of [root,attack])assert.equal(createHash('sha256').update(c.originalJson).digest('hex'),c.sha256);
 const levels=Object.fromEntries(Object.entries(records[id].levels).map(([level,r])=>{
  assert.equal(r.key,id);assert.equal(r.prefabKey,id);assert.equal(String(r.level),level);
  return[level,{groups:r.talents.groups,bb:r.talents.bb,abilities:r.abilities,skills:r.skills}];
 }));
 enemies[id]={combatPathId:ref.m_PathID,rootPathId:root.pathId,native:[root.originalJson,attack.originalJson],levels};
}
const result={schemaVersion:1,testOnly:true,frameParity:false,
 scope:'Exact selected Chapter 17 ordinary Combat cooldowns. No stage, S3 enemy compatibility, animation/FSM or other ability clock admission.',
 sources,enemies};
const out=new URL('data/candidates/arkpedia-ch17-attack-clock-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);
else await writeJSONAtomic(out,result);
console.log('Verified selected Chapter 17 Combat clocks:',ids.join(', '));
