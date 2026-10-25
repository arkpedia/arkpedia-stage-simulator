// SPDX-License-Identifier: GPL-3.0-or-later
// Retain only the two original click-counter actions; this approves no enemy.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {verifiedChapter16FamilyGraph} from './enemy-support.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
export async function snakeCounterContract({read=readFile}={}){
 const sources={},raw={};
 for(const[name,path]of Object.entries({graph:'data/candidates/arkpedia-ch17-firewall-boss-source.json',
  records:'data/candidates/arkpedia-enemy-records.canonical.json',events:'data/candidates/arkpedia-buff-event-alias-source.json'})){
  raw[name]=await read(new URL(path,root));sources[name]={path,sha256:sha(raw[name])};
 }
 const index=JSON.parse(await read(new URL('data/arkpedia-enemy-clock-source.json',root)));
 const graph=verifiedChapter16FamilyGraph(raw.graph,await read(new URL('data/arkpedia-cn-native-source.json',root)),await read(new URL('data/arkpedia-cn-enemy-native-source.json',root)),index);
 const aliases=JSON.parse(raw.events);
 if(aliases.events['2']?.name!=='ON_BUFF_TRIGGER')throw Error('Snake counter trigger alias not corroborated');
 const enemy='enemy_1593_musnake',record=JSON.parse(raw.records).enemies[enemy].levels[0],cases={};
 for(const[kind,template]of Object.entries({step:'enemy_musnake_hp_ratio_trigger',final:'enemy_musnake_during_click'})){
  const node=JSON.parse(graph.templates[template].originalJson),event=node.eventToActions._items.find(e=>e.key===2);
  const nodes=JSON.parse(event.value.SerializedState),matches=nodes.map((action,index)=>({action,index})).filter(n=>n.action.$type==='Torappu.Battle.Action.Nodes+Mainline17CreateBossClickCounterButton');
  if(matches.length!==1)throw Error('Ambiguous snake click-counter source');
  const {action,index}=matches[0];
  if(action._bossType!=='BUFF_OWNER'||!Number.isSafeInteger(action._requiredClickCount)||action._requiredClickCount<1
   ||!Number.isFinite(action._duration)||action._duration<=0||!graph.templates[action._successBuffKey]||!graph.templates[action._failedBuffKey])throw Error('Unsupported snake click-counter action');
  cases[kind]={template,event:2,actionIndex:index,action};
 }
 return{schemaVersion:1,testOnly:true,scope:'Source-bound snake click-counter transport and resolution only; no HP-step, injury, fatal, timeout, attack, firewall, wave, stage or enemy-support approval.',
  sources,enemy,record:{groups:record.talents.groups,bb:record.talents.bb,skills:record.skills,abilities:record.abilities},cases,
  limits:['The caller applies the exact success/failure buff selected by the retained action; those buff mechanics require their own phase controller.',
   'Click/deadline ordering and input transport are local simulator mappings, not compiled-dispatch or captured frame parity.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: snake-counter-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-snake-counter-contract.json',root),text=JSON.stringify(await snakeCounterContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Snake click-counter contract differs from retained sources');}
 else await writeFile(file,text);
 console.log('Verified the two original snake click-counter actions; enemy support remains held');
}
