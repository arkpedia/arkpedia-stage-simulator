// SPDX-License-Identifier: GPL-3.0-or-later
import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';import assert from'node:assert/strict';
import{writeJSONAtomic}from'./write-json.mjs';import{verifyEnemyInstantKill}from'../../server/sim/enemy-instant-kill.js';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const reviewPath='data/candidates/arkpedia-ch17-reviewed-war-caster.json',reviewRaw=await readFile(new URL(reviewPath,root)),review=JSON.parse(reviewRaw);
const pin=review.sources.graph,raw=await readFile(new URL(pin.path,root));assert.equal(sha(raw),pin.sha256);const graph=JSON.parse(raw);
const template=graph.templates.enemy_muwiz_s_leave;assert.equal(sha(template.originalJson),template.sha256);
const parsed=JSON.parse(template.originalJson);assert.equal(parsed.eventToActions._items.length,1);
const event=parsed.eventToActions._items[0];assert.equal(event.key,0);const actions=JSON.parse(event.value.SerializedState);assert.equal(actions.length,3);
assert.deepEqual(actions[0],{_target:'BUFF_OWNER',_replaceAnimPairs:[{fromAnimKey:'Die',toAnimKey:'Leave'}],_isOverwrite:true,_modifyCurrentMode:true,_modeIndex:-1,$type:'Torappu.Battle.Action.Nodes+ModifyAnimatorHookerReplacePair'});
assert.deepEqual(actions[1],{$type:'Torappu.Battle.Action.Nodes+AlwaysNext'});
const kill=verifyEnemyInstantKill(actions[2]);assert.equal(kill._targetType,'TARGET');for(const k of ['_killSource','_noSource','_skipReborn'])assert.equal(kill[k],false);
const result={schemaVersion:1,testOnly:true,frameParity:false,scope:'Exact stronger War Caster Leave template and literal InstantKill flags. Self-target execution uses the existing regular-engine skill mapping; no native selector/FSM timing or stage admission.',
 sources:{review:{path:reviewPath,sha256:sha(reviewRaw)},graph:pin},template:{originalJson:template.originalJson,sha256:template.sha256},event:0,actions};
const out=new URL('data/candidates/arkpedia-war-caster-leave-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified exact War Caster Leave template and non-skipping InstantKill action');
