// SPDX-License-Identifier: GPL-3.0-or-later
// Build-only audit of retained source templates. A compilable template does
// not imply that its owning enemy, transport or environment is implemented.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {compileNativeBuffProgram} from '../../shared/arkpedia/behavior-native-compiler.js';
import {prepareBehaviorProgram} from '../../shared/arkpedia/behavior-program.js';
import {writeJSONAtomic} from './write-json.mjs';
const root=new URL('../../',import.meta.url),sha=v=>createHash('sha256').update(v).digest('hex');
function templateKeys(value,out=new Set()){
  if(!value||typeof value!=='object')return out;
  if(typeof value.templateKey==='string'&&value.templateKey)out.add(value.templateKey);
  for(const v of Object.values(value))templateKeys(v,out);return out;
}
export function auditNativeBuffPrograms(evidence,support={}){
  const direct=new Map(),children=new Map();
  for(const[key,template]of Object.entries(evidence.templates??{}))children.set(key,templateKeys(template.eventToActions));
  for(const[path,components]of Object.entries(evidence.prefabs??{})){
    const id=path.split('/').at(-1).replace(/\.prefab$/,'');
    for(const row of components)for(const key of templateKeys(JSON.parse(row.originalJson))){
      if(!direct.has(key))direct.set(key,new Set());direct.get(key).add(id);
    }
  }
  const consumers=new Map();
  const propagate=(key,id,seen=new Set())=>{
    if(seen.has(key))return;seen.add(key);
    if(!consumers.has(key))consumers.set(key,new Set());consumers.get(key).add(id);
    for(const child of children.get(key)??[])propagate(child,id,seen);
  };
  for(const[key,ids]of direct)for(const id of ids)propagate(key,id);
  const templates=[],groups=new Map();
  for(const key of Object.keys(evidence.templates??{}).sort()){
    const enemyIds=[...(consumers.get(key)??[])].sort(),row={key,consumers:enemyIds,
      unsupportedConsumers:enemyIds.filter(id=>!support[id]?.policy)};
    try{
      const graph=compileNativeBuffProgram(key,k=>evidence.templates[k]),bytes=JSON.stringify(graph)+'\n';
      Object.assign(row,{compiled:true,programSha256:sha(bytes),bytes:Buffer.byteLength(bytes),
        templateCount:Object.keys(graph.templates).length,requiredBlackboard:[...prepareBehaviorProgram(graph).requiredBlackboard].sort()});
    }catch(error){
      Object.assign(row,{compiled:false,reason:error.message});
      if(!groups.has(error.message))groups.set(error.message,{reason:error.message,templates:[],consumers:new Set(),unsupportedConsumers:new Set()});
      const g=groups.get(error.message);g.templates.push(key);enemyIds.forEach(id=>g.consumers.add(id));row.unsupportedConsumers.forEach(id=>g.unsupportedConsumers.add(id));
    }
    templates.push(row);
  }
  const refusals=[...groups.values()].map(g=>({...g,consumers:[...g.consumers].sort(),unsupportedConsumers:[...g.unsupportedConsumers].sort()}))
    .sort((a,b)=>b.unsupportedConsumers.length-a.unsupportedConsumers.length||b.templates.length-a.templates.length||a.reason.localeCompare(b.reason));
  return{retainedPrefabs:Object.keys(evidence.prefabs??{}).length,templates:templates.length,compiled:templates.filter(t=>t.compiled).length,
    refused:templates.filter(t=>!t.compiled).length,results:templates,refusals};
}
export async function buildNativeBuffProgramAudit(){
  const inputs=['data/arkpedia-enemy-native-abilities.json','data/arkpedia-enemy-support.json','shared/arkpedia/behavior.js',
    'shared/arkpedia/behavior-native-compiler.js','shared/arkpedia/behavior-program.js'];
  const bytes=await Promise.all(inputs.map(p=>readFile(new URL(p,root))));
  return{schemaVersion:1,scope:'Only retained native templates/prefabs, not the complete game corpus. Refusals report the first compiler blocker per template. Compilability never grants enemy or stage admission.',
    source:Object.fromEntries(inputs.map((p,i)=>[p,sha(bytes[i])])),...auditNativeBuffPrograms(JSON.parse(bytes[0]),JSON.parse(bytes[1]).enemies)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const report=await buildNativeBuffProgramAudit(),out=new URL('data/arkpedia-native-buff-program-audit.json',root);
  if(process.argv.includes('--check')){
    if(JSON.stringify(report)!==JSON.stringify(JSON.parse(await readFile(out,'utf8'))))throw Error('Native buff program audit is stale');
  }else if(process.argv.includes('--write'))await writeJSONAtomic(out,report);
  console.log(JSON.stringify({templates:report.templates,compiled:report.compiled,refused:report.refused,retainedPrefabs:report.retainedPrefabs}));
}
