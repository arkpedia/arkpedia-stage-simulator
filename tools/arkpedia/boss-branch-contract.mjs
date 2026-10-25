// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileStageLocalEnemy} from '../../shared/arkpedia/enemy-records.js';
import {mutwinStageRecordContract} from './mutwin-stage-record-contract.mjs';
const root=new URL('../../',import.meta.url),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sha=b=>createHash('sha256').update(b).digest('hex');
export function reviewBossBranch(source,records,brute){
 const raw=source.rawLevel,branch=raw.branches?.boss;
 if(source.testOnly!==true||source.admitted!==false||source.geometry.rows!==17||source.geometry.cols!==11
  ||!same(Object.keys(raw.branches),['boss'])||branch.phases.length!==1||branch.phases[0].preDelay!==0||branch.phases[0].actions.length!==3||raw.extraRoutes.length!==3)throw Error('Unreviewed 17-18 boss branch');
 const snake='enemy_1593_musnake',local='enemy_10207_mubrut_2_a',refs=key=>raw.enemyDbRefs.filter(r=>r.id===key);
 if(refs(snake).length!==1||refs(snake)[0].useDb!==true||refs(snake)[0].level!==0||refs(snake)[0].overwrittenData!==null||refs(local).length!==1)throw Error('Unreviewed boss branch enemy reference');
 const localRecord=compileStageLocalEnemy(refs(local)[0],{damageType:'PHYSIC'}),proof=brute.enemies[localRecord.prefabKey];
 if(localRecord.prefabKey!=='enemy_10207_mubrut_2'||localRecord.applyWay!=='MELEE'||!proof||!same(localRecord.skills,proof.skills)||!same(localRecord.talents.bb,proof.bb)||!same(localRecord.talents.groups,proof.groups))throw Error('Unreviewed local boss-branch Brute');
 const attacks=proof.native.map(JSON.parse).filter(c=>Object.hasOwn(c,'_damageType'));
 if(attacks.length!==2||!same(attacks.map(c=>c._animKey).sort(),['Attack','Skill'])||attacks.some(c=>c._damageType!==1||c._attackType!==1))throw Error('Unreviewed local Brute physical melee source');
 const pair=p=>{if(!Number.isInteger(p?.row)||!Number.isInteger(p?.col)||p.row<0||p.row>=17||p.col<0||p.col>=11)throw Error('Invalid boss branch position');return[p.row,p.col];};
 const entries=branch.phases[0].actions.map((action,i)=>{
  const expected={actionType:'SPAWN',managedByScheduler:true,key:i?local:snake,count:1,preDelay:3*(i+1),interval:1,routeIndex:i,blockFragment:false,autoPreviewRoute:false,autoDisplayEnemyInfo:i===0,isUnharmfulAndAlwaysCountAsKilled:false,hiddenGroup:null,randomSpawnGroupKey:null,randomSpawnGroupPackKey:null,randomType:'ALWAYS',refreshType:'ALWAYS',weight:0,dontBlockWave:false,forceBlockWaveInBranch:false};
  if(!same(action,expected))throw Error('Unreviewed boss branch action');
  const native=raw.extraRoutes[i];
  if(native.motionMode!=='WALK'||native.allowDiagonalMove!==true||native.visitEveryTileCenter!==false||native.visitEveryNodeCenter!==false||native.visitEveryCheckPoint!==false||!same(native.spawnRandomRange,{x:0,y:0})||!same(native.spawnOffset,{x:0,y:0}))throw Error('Unreviewed boss branch traversal');
  const route={motion:'WALK',start:pair(native.startPosition),end:pair(native.endPosition),checkpoints:native.checkpoints.map(cp=>{
   if(cp.randomizeReachOffset!==false||cp.reachDistance!==0||!same(cp.reachOffset,{x:0,y:0}))throw Error('Unreviewed boss branch checkpoint');
   if(cp.type==='MOVE'&&cp.time===0)return{type:'MOVE',pos:pair(cp.position)};
   // Native WAIT positions are sentinel metadata, not movement destinations.
   if(cp.type==='WAIT_FOR_SECONDS'&&cp.time===20&&same(cp.position,{row:-8,col:0}))return{type:'WAIT',time:20};
   throw Error('Unreviewed boss branch checkpoint');
  })};
  const conditional=source.conditional[i];
  if(source.conditional.length!==3||conditional?.source!=='branch'||conditional.branch!=='boss'||conditional.phase!==0||conditional.enemy_id!==action.key||conditional.count!==1||conditional.route!==i||conditional.time!==action.preDelay)throw Error('Boss branch conditional timing disagrees');
  return{time:conditional.time,enemyKey:action.key,extraRouteIndex:i,action,native,route};
 });
 return{entries,records:{[snake]:records[snake].levels[0],[local]:localRecord}};
}
export async function bossBranchContract({read=readFile,fetchImpl=fetch}={}){
 const verified=await mutwinStageRecordContract({read,fetchImpl}),sources={...verified.sources},inputs={};
 for(const [name,path]of Object.entries({stage:sources.stage.path,records:sources.records.path,brute:'data/candidates/arkpedia-ch17-reviewed-brute.json'})){
  const bytes=await read(new URL(path,root));if(sources[name]&&sources[name].sha256!==sha(bytes))throw Error('Boss branch inputs changed during verification');sources[name]={path,sha256:sha(bytes),bytes:bytes.length};inputs[name]=JSON.parse(bytes);
 }
 const reviewed=reviewBossBranch(inputs.stage,inputs.records.enemies,inputs.brute);
 return{schemaVersion:1,testOnly:true,stage:'17-18',branch:'boss',scope:'Internal explicit boss branch scheduler and exact local Brute. Room/wave execution and stage admission remain held.',sources,...reviewed,
  limits:['Branch start is explicit. The camera/withdraw/branch ordering and the main-wave FinishCurrentWave receiver are separate stage integration work.',
   'Spawn times use the canonical conditional producer offsets 3/6/9 from branch start. Typed native extra-route MOVE/WAIT checkpoints are retained; this local scheduling bridge is not compiled-client or captured-frame proof.',
   'The local Brute is compiled in isolation from the level, including its uncounted/life and hit-rate values. Its exact prefab combat uses the retained Brute action graph and clocks; its description and numerical fields are never inherited from a catalogue alias.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: boss-branch-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-boss-branch-contract.json',root),text=JSON.stringify(await bossBranchContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Boss branch receipt differs');}else await writeFile(file,text);
 console.log('Verified canonical boss branch actions, extra routes and exact local Brute; stage remains held');
}
