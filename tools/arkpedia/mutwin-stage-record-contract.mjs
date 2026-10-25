// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {flattenBlackboard,talentGroups} from '../../shared/arkpedia/enemy-records.js';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function mutwinStageRecordContract({read=readFile,fetchImpl=fetch}={}){
 const sources={},inputs={};
 for(const [name,path] of Object.entries({stage:'data/candidates/arkpedia-stage-17-18-source.json',lock:'data/arkpedia-canonical-stage-17-18.lock.json',foundation:'data/candidates/arkpedia-ch17-mutwin-lifecycle-contract.json',records:'data/candidates/arkpedia-enemy-records.canonical.json',receipt:'data/candidates/arkpedia-enemy-records.canonical.receipt.json'})){
  const bytes=await read(new URL(path,root));sources[name]={path,sha256:sha(bytes),bytes:bytes.length};inputs[name]=JSON.parse(bytes);
 }
 const {stage,lock,foundation}=inputs,pin=lock.files.rawLevel;
 if(stage.testOnly!==true||stage.admitted!==false||lock.testOnly!==true||lock.stage!=='17-18'||lock.repository!=='arkpedia/arkpedia-data'||stage.canonicalData.commit!==lock.commit||!same(stage.inputs,lock.files))throw Error('Unreviewed staged twin provenance');
 if(sources.records.sha256!==inputs.receipt.output.sha256||sources.records.bytes!==inputs.receipt.output.bytes||!same(inputs.records.canonicalData,inputs.receipt.canonicalData)||!same(inputs.records.upstream,stage.upstream))throw Error('Unreviewed staged twin database receipt');
 const response=await fetchImpl(`https://raw.githubusercontent.com/${lock.repository}/${lock.commit}/${pin.path}`);
 if(!response.ok)throw Error('Canonical staged twin level fetch failed');
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length!==pin.bytes||sha(bytes)!==pin.sha256||!same(JSON.parse(bytes),stage.rawLevel))throw Error('Canonical staged twin level checksum mismatch');
 const enemies=reviewStagedTwinRecords(stage.rawLevel,foundation,inputs.records.enemies);
 return{schemaVersion:1,testOnly:true,stage:'17-18',scope:'Exact internal staged twin records only; room execution and full stage admission remain held.',sources,rawLevel:pin,enemies};
}
export function reviewStagedTwinRecords(rawLevel,foundation,records){
 const enemies={};
 if(!same(Object.keys(foundation.enemies),['enemy_1591_mutwin','enemy_1591_mutwin_2']))throw Error('Unreviewed staged twin foundation');
 for(const [key,proof] of Object.entries(foundation.enemies)){
  const refs=rawLevel.enemyDbRefs.filter(r=>r.id===key),ref=refs[0];
  if(refs.length!==1||ref.useDb!==true||ref.level!==0)throw Error('Unreviewed staged twin reference');
  const over=ref.overwrittenData;
  // The literal blackboard replaces the entire list. All other stage fields
  // must remain inactive; never silently discard an unfamiliar override.
  for(const [field,value] of Object.entries(over)){
   if(field==='talentBlackboard')continue;
   if(field==='attributes'){
    if(Object.values(value).some(v=>v!==null&&v?.m_defined!==false))throw Error('Unreviewed staged twin attribute');
   }else if(value!==null&&value?.m_defined!==false)throw Error('Unreviewed staged twin override');
  }
  const flat=flattenBlackboard(over.talentBlackboard),talents={...flat,groups:talentGroups({...flat.bb,...flat.bbStr})},base=records?.[key]?.levels[0];
  if(!base||!same({talents:base.talents,skills:base.skills,abilities:base.abilities},proof.record))throw Error('Unreviewed staged twin database record');
  if(!Array.isArray(over.talentBlackboard)||over.talentBlackboard.length!==8||!same(talents.bb,base.talents.bb)||!same(talents.groups,base.talents.groups)
   ||!same(talents.bbStr,{'DamageResistance.boss_room':'(0,10,0)'})||base.talents.bbStr['DamageResistance.boss_room']!=='(0,6,0)')throw Error('Unreviewed staged twin blackboard');
  enemies[key]={record:{...base,talents},room:'(0,10,0)'};
 }
 return enemies;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: mutwin-stage-record-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-mutwin-stage-record-contract.json',root),text=JSON.stringify(await mutwinStageRecordContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Staged twin record receipt differs');}else await writeFile(file,text);
 console.log('Verified exact 17-18 twin overrides against canonical level bytes; stage remains held');
}
