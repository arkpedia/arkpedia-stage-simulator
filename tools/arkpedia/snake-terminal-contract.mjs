// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {snakeCounterContract} from './snake-counter-contract.mjs';
import {verifiedNative} from './enemy-support.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
export async function snakeTerminalContract({read=readFile}={}){
 const sources={},raw={};
 for(const[name,path]of Object.entries({counter:'data/candidates/arkpedia-ch17-snake-counter-contract.json',graph:'data/candidates/arkpedia-ch17-firewall-boss-source.json',
  indexed:'data/candidates/arkpedia-ch17-firewall-boss-native.json',events:'data/candidates/arkpedia-firewall-boss-event-alias-source.json',status:'data/arkpedia-makoto-status-source.json'})){
  raw[name]=await read(new URL(path,root));sources[name]={path,sha256:sha(raw[name])};
 }
 const counter=await snakeCounterContract({read});
 if(!Buffer.from(JSON.stringify(counter,null,2)+'\n').equals(raw.counter))throw Error('Stale snake counter foundation');
 const indexRaw=await read(new URL('data/arkpedia-enemy-clock-source.json',root)),idx=JSON.parse(indexRaw),mvp=JSON.parse(await read(new URL('data/arkpedia-mvp.json',root)));
 const native=JSON.parse(raw.indexed);verifiedNative(native,idx.prefabs,sha(indexRaw),mvp.behaviors.source);
 const graph=JSON.parse(raw.graph),events=JSON.parse(raw.events),status=JSON.parse(raw.status);
 if(events.events['27']?.name!=='ON_BEFORE_TRY_SET_HP_ZERO'||events.events['44']?.name!=='ON_OWNER_ROOT_TILE_CHANGED')throw Error('Uncorroborated firewall boss callback aliases');
 if(status.definitions.UNDEADABLE!==6||status.definitions.E_NUM!==46)throw Error('Unreviewed snake terminal status alias');
 const components=native.prefabs['dyn/battle/prefabs/enemies/'+counter.enemy+'.prefab'];
 const before=components.flatMap(c=>JSON.parse(c.originalJson)._buffs??[]).filter(b=>b.buffKey==='enemy_musnake_before_dead');
 if(before.length!==1||JSON.stringify(before[0].attributes.abnormalFlags)!=='[6]'||before[0].isSilenceable!==0)throw Error('Unreviewed snake terminal floor');
 const actions=(key,event)=>JSON.parse(JSON.parse(graph.templates[key].originalJson).eventToActions._items.find(e=>e.key===event).value.SerializedState);
 const admission=actions(before[0].templateKey,27);
 if(admission.length!==1||!admission[0]._isDerivedBuff||!admission[0]._finishDerivedBuffIfParentFinish)throw Error('Unreviewed snake terminal child');
 const child=admission[0]._buff;
 if(child.templateKey!==counter.cases.final.template||child.triggerCnt!==1||child.triggerInterval!==.5||!child.waitFirstTriggerInterval)throw Error('Unreviewed snake terminal delay');
 const finish=actions(counter.cases.final.action._successBuffKey,2),kills=finish.filter(n=>n.$type.endsWith('+InstantKill')),waves=finish.filter(n=>n.$type.endsWith('+FinishCurrentWave'));
 if(kills.length!==1||kills[0]._targetType!=='BUFF_OWNER'||kills[0]._markReachExit||kills[0]._skipReborn||waves.length!==1||!waves[0]._finishAndSkip)throw Error('Unreviewed snake terminal finish');
 return{schemaVersion:1,testOnly:true,scope:'Source-bound snake pre-floor terminal admission, delayed final counter and self-kill/wave-finish handoff only. No HP-step, injury, timeout, attack, firewall, stage or enemy-support approval.',
  sources,enemy:counter.enemy,record:counter.record,beforeDead:before[0],admission,finish,
  status:{name:'UNDEADABLE',value:6,versionLimit:status.source.versionLimit},
  limits:['The pre-floor HP-set callback and UNIQUE terminal-child coalescing are local engine mappings; compiled dispatch and frame parity are not claimed.',
   'The finishWave receiver must implement the retained FinishCurrentWave action on an admitted canonical wave. This subsystem cannot admit a stage or replace it by force-clearing every pending spawn.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: snake-terminal-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-snake-terminal-contract.json',root),text=JSON.stringify(await snakeTerminalContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Snake terminal contract differs from retained sources');}else await writeFile(file,text);
 console.log('Verified original snake terminal admission and finish actions; complete boss support remains held');
}
