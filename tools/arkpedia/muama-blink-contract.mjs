// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {muamaLineContract} from './muama-line-contract.mjs';
import {parseSkel} from '../assets/skel.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
export async function muamaBlinkContract({read=readFile}={}){
 const sources={},raw={};
 for(const[name,path]of Object.entries({line:'data/candidates/arkpedia-ch17-muama-line-contract.json',graph:'data/candidates/arkpedia-ch17-firewall-boss-source.json',clock:'data/candidates/arkpedia-ch17-firewall-boss-animation-source.json',events:'data/candidates/arkpedia-firewall-boss-event-alias-source.json',notes:'data/candidates/arkpedia-ch17-muama-mechanics-notes.json'})){
  raw[name]=await read(new URL(path,root));sources[name]={path,sha256:sha(raw[name])};
 }
 const line=await muamaLineContract({read});if(!Buffer.from(JSON.stringify(line,null,2)+'\n').equals(raw.line))throw Error('Stale Muama line foundation');
 const graph=JSON.parse(raw.graph),clocks=JSON.parse(raw.clock),events=JSON.parse(raw.events),notes=JSON.parse(raw.notes),enemies={};
 const one=(xs,f)=>{const found=xs.filter(f);if(found.length!==1)throw Error('Ambiguous Muama blink source');return found[0];};
 const actions=(key,event)=>JSON.parse(one(JSON.parse(graph.templates[key].originalJson).eventToActions._items,e=>e.key===event).value.SerializedState),rootActions=actions('enemy_muama_blink_buff',44),refreshActions=actions('enemy_muama_trriger_env',2),trigger=rootActions[0];
 if(events.events['44']?.name!=='ON_OWNER_ROOT_TILE_CHANGED'||notes.source.revision!==441735||!notes.refresh.nextCheckpoint
  ||notes.refresh.protectedIntroSeconds!==2||notes.refresh.protectedOutroSeconds!==1.5||notes.refresh.unblockableImmunitySeconds!==5||notes.refresh.rootChangeRefreshDelay!==.1
  ||!trigger.$type.endsWith('+CreateBuff')||trigger._buff.buffKey!=='enemy_muama_trriger_env'||trigger._isDerivedBuff||trigger._finishDerivedBuffIfParentFinish
  ||trigger._buff.lifeTime!==.15||trigger._buff.triggerCnt!==1||trigger._buff.triggerInterval!==.1||!trigger._buff.waitFirstTriggerInterval
  ||!refreshActions[0].$type.endsWith('+TriggerEnvSystem')||refreshActions[0]._envKey!=='env_v073_mainline17_boss_ctrl'||refreshActions[0]._target!=='SOURCE'||refreshActions[0]._tryRuntimeLoad)throw Error('Unreviewed blink root refresh');
 for(const[key,proof]of Object.entries(line.enemies)){
  const rows=graph.prefabs['dyn/battle/prefabs/enemies/'+key+'.prefab'],names=new Map(rows.filter(c=>c.componentType==='GameObject').map(c=>[c.pathId,JSON.parse(c.originalJson).m_Name])),full=rows.map(c=>JSON.parse(c.originalJson)),parts=full.filter(c=>names.get(c.m_GameObject?.m_PathID)==='Blink'),
   wrapper=one(parts,c=>'_ignoreSilence'in c),ability=one(parts,c=>c._buffs),buff=ability._buffs[0],actionComponent=one(parts,c=>c._actions),blink=JSON.parse(actionComponent._actions.SerializedState)[0],graphics=one(full,c=>c._animations),
   disappear=one(graphics._animations,c=>c.animKey==='Disappear'),appear=one(graphics._animations,c=>c.animKey==='Appear'),skill=one(proof.record.skills,c=>c.prefabKey==='Blink'),
   parsed=parseSkel(Buffer.from(clocks.enemies[key].base64,'base64'),null,{includeExactDurations:true});
  if(wrapper._ignoreSilence!==1||wrapper._castLikeAttack!==0||wrapper._immuneStunWhenAffecting!==0||ability._waitForAttackEvent!==0||ability._waitForCasting!==0||ability._resetCdStrategy!==1
   ||buff.buffKey!==(key==='enemy_1590_muama'?'enemy_muama_blink':'enemy_mutwin_blink')||buff.templateKey!=='enemy_muama_blink_buff'||buff.lifeTime!==5||buff.lifeTimeType!==1
   ||JSON.stringify(buff.attributes.abnormalImmunes)!=='[3]'||buff.attributes.abnormalFlags.length||buff.isSilenceable||buff.isStunnable||buff.isFreezable||buff.isLevitatable
   ||actionComponent._runActionOnEvent!==4||!blink.$type.endsWith('+BlinkNode')||!blink._toNextCheckpoint||!blink._useAnimSpeed||blink._withoutSwitchToBlinkState||blink._skipDisappearCheckpoint||blink._toEndIfNoCheckpoint||blink._useNewRouteBeforeBlink||blink._toMapPosition
   ||disappear.animName!=='Move'||appear.animName!=='Start'||disappear.speed!==1||appear.speed!==1||parsed.exactDurations.Move!==2||parsed.exactDurations.Start!==1.5||!(skill.initCooldown>0&&skill.cooldown>0))throw Error('Unreviewed Muama blink ability');
  enemies[key]={record:proof.record,wrapper,ability,actionComponent,blink,disappear,appear,defaults:{initialCooldown:skill.initCooldown,cooldown:skill.cooldown,buffKey:buff.buffKey,duration:buff.lifeTime,intro:parsed.exactDurations.Move,outro:parsed.exactDurations.Start,refreshDelay:trigger._buff.triggerInterval,refreshLifetime:trigger._buff.lifeTime}};
 }
 return{schemaVersion:1,testOnly:true,scope:'Internal Muama/twin checkpoint Blink, protection state, unblockable immunity and delayed firewall refresh; complete bosses/stages remain held.',sources,rootActions,refreshActions,enemies,
  limits:['Skill admission shares the ready ordinary/line action opportunity and ignores silence. Its source buff and skill cooldown start immediately; the separately owned blink state holds action/movement through intro and outro.',
   'Literal Move/Start clip seconds are a local animation-speed dispatch, not compiled/frame proof. Blink state protection overrides the source buff unblockable immunity; ordinary unblockable parents remain attached and resume when immunity expires.',
   'Only a current nonfinal MOVE checkpoint is mapped. WAIT/APPEAR/DISAPPEAR dispatch is not inferred here; an exhausted checkpoint list leaves position unchanged. Canonical stage integration must verify its real route/cursor against this mapping.',
   'Relocation commits the captured route cursor only if its route, index and checkpoint still match. Root change dispatch uses accepted enemyMoved endpoints, and coalesces the native single named delayed parent. The refresh is not derived from the five-second buff and survives its expiration.',
   'Source retirement/reuse, route replacement before arrival, rejected protection and battle end cannot leave a stale action lock or move another life. Born line output remains owned independently.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: muama-blink-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-muama-blink-contract.json',root),text=JSON.stringify(await muamaBlinkContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Muama blink contract differs from retained sources');}else await writeFile(file,text);
 console.log('Verified retained Muama/twin Blink and root-refresh sources; boss support remains held');
}
