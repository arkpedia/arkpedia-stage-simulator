// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {writeJSONAtomic} from './write-json.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),sources={};
async function read(path,pin){const raw=await readFile(new URL(path,root));if(pin)assert.equal(sha(raw),pin);sources[path]={path,sha256:sha(raw)};return JSON.parse(raw);}
const foundation=await read('data/candidates/arkpedia-ch17-muama-combat-contract.json','69663279e7cd31f398ec95cfdd20b83d6d67cf2129e2d504df254e305766cb07');
const graph=await read(foundation.sources.graph.path,foundation.sources.graph.sha256);
const events=await read('data/candidates/arkpedia-war-caster-event-alias-source.json');assert.equal(events.events['10'].name,'ON_TAKE_DAMAGE');assert.equal(events.events['10'].witnesses.length,3);
const template=graph.templates['enemy_muama_t[damage_resistance]'];assert.equal(sha(template.originalJson),template.sha256);
const parsed=JSON.parse(template.originalJson);assert.equal(parsed.eventToActions._items.length,1);const event=parsed.eventToActions._items[0];assert.equal(event.key,10);
const actions=JSON.parse(event.value.SerializedState);
assert.deepEqual(actions,[{_targetType:'BUFF_OWNER',$type:'Torappu.Battle.Action.Nodes+CheckFirewallDamageSource'},
 {_filterDamageType:true,_damageMask:'PHYSICAL_AND_MAGICAL',_filterApplyWay:false,_applyWayFilter:'NONE',_filterModifierKey:false,_modifierKey:'',_isOneMinus:true,_isStackable:false,_isValidStackCnt:false,_cachedDeltaValueToBBKey:'',_customKey:'',$type:'Torappu.Battle.Action.Nodes+DamageScale'}]);
const enemies={};
for(const[key,proof]of Object.entries(foundation.enemies)){
 const parent=proof.passive.filter(p=>p.templateKey==='enemy_muama_t[damage_resistance]');assert.equal(parent.length,1);
 const rows=graph.prefabs[`dyn/battle/prefabs/enemies/${key}.prefab`];
 const creators=rows.filter(r=>r.componentType==='MonoBehaviour'&&JSON.parse(r.originalJson)._buffs?.some(b=>b.buffKey===parent[0].buffKey));assert.equal(creators.length,1);
 const creator=creators[0],original=JSON.parse(creator.originalJson)._buffs.find(b=>b.buffKey===parent[0].buffKey);assert.deepEqual(original,parent[0]);
 const ratio=proof.record.talents.bb['DamageResistance.damage_resistance'];assert.equal(ratio,.9);assert.equal(proof.defaults.resistance,ratio);
 assert.equal(original.isSilenceable,0);assert.equal(original.lifeTimeType,2);assert.equal(original.triggerLifeType,0);assert.equal(original.maxStackCnt,1);
 enemies[key]={parent:parent[0],ratio,creator:{pathId:creator.pathId,originalJson:creator.originalJson,sha256:sha(creator.originalJson)}};
}
const result={schemaVersion:1,testOnly:true,frameParity:false,scope:'Exact three-boss firewall damage parent, literal ON_TAKE_DAMAGE actions and Physical/Arts scaling parameters. Existing regular-engine point-segment and incoming-multiplier mappings remain; no native dispatcher/geometry/stacking parity or stage admission.',sources,event:{number:10,name:events.events['10'].name},template,actions,enemies};
const out=new URL('data/candidates/arkpedia-ch17-muama-durability-contract.json',root);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);else await writeJSONAtomic(out,result);
console.log('Verified three boss durability parents and the literal firewall Physical/Arts damage-scaling action');
