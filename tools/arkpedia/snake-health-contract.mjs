// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {snakeCounterContract} from './snake-counter-contract.mjs';
import {verifiedNative} from './enemy-support.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
export async function snakeHealthContract({read=readFile}={}){
 const sources={},raw={};
 for(const[name,path]of Object.entries({counter:'data/candidates/arkpedia-ch17-snake-counter-contract.json',
  graph:'data/candidates/arkpedia-ch17-firewall-boss-source.json',indexed:'data/candidates/arkpedia-ch17-firewall-boss-native.json',
  notes:'data/candidates/arkpedia-ch17-boss-mechanics-notes.json'})){
  raw[name]=await read(new URL(path,root));sources[name]={path,sha256:sha(raw[name])};
 }
 const counter=await snakeCounterContract({read});
 if(!Buffer.from(JSON.stringify(counter,null,2)+'\n').equals(raw.counter))throw Error('Stale snake counter foundation');
 const indexRaw=await read(new URL('data/arkpedia-enemy-clock-source.json',root)),index=JSON.parse(indexRaw),native=JSON.parse(raw.indexed),
  mvp=JSON.parse(await read(new URL('data/arkpedia-mvp.json',root)));
 verifiedNative(native,index.prefabs,sha(indexRaw),mvp.behaviors.source);
 const graph=JSON.parse(raw.graph),parts=native.prefabs['dyn/battle/prefabs/enemies/'+counter.enemy+'.prefab'];
 const buffs=parts.flatMap(c=>JSON.parse(c.originalJson)._buffs??[]),parents=buffs.filter(b=>b.buffKey==='enemy_musnake_hp_ratio_trigger');
 if(parents.length!==1)throw Error('Ambiguous snake HP parent');const parent=parents[0];
 const actions=(key,event)=>JSON.parse(JSON.parse(graph.templates[key].originalJson).eventToActions._items.find(e=>e.key===event).value.SerializedState);
 const start=actions(parent.templateKey,0),poll=actions(parent.templateKey,2),injury=actions('enemy_jmusnake_get_injured',0),
  success=actions('enemy_musnake_stun_buff',2),failed=actions('enemy_musnake_heal_buff',2);
 if(parent.triggerInterval!==0.10000000149011612||parent.waitFirstTriggerInterval!==1||parent.isSilenceable!==0||parent.isStunnable!==0
  ||parent.isFreezable!==0||parent.isLevitatable!==0||JSON.stringify(parent.attributes.abnormalFlags)!=='[22]'
  ||start.length!==1||!start[0].$type.endsWith('+MarkCurrentHpRatio')||!start[0]._markInBlackboard
  ||!poll[0].$type.endsWith('+HpRatioTrigger')||poll[0]._condType!=='GT'||poll[0]._useMinHpRatio
  ||poll[2]?._buff?.buffKey!=='enemy_musnake_during_click')throw Error('Unreviewed snake HP polling');
 const force=success[1],heal=failed[1],damage=injury[0],skill=counter.record.skills.find(s=>s.prefabKey==='Injured');
 const clocks=parts.filter(c=>c.objectName==='Injured').map(c=>JSON.parse(c.originalJson)).filter(c=>c._cooldownKey==='stun_duration');
 if(clocks.length!==1||clocks[0]._timeMode!==3||clocks[0]._affectedBySlowDown!==0
  ||!force?.$type.endsWith('+TriggerEnemySkill')||force._skillName!=='Injured'||!force._checkSkillActive||force._checkSkillReady
  ||!force._interruptCurAbility||!force._clearPalsyingBuffBeforeTrigger
  ||!heal?.$type.endsWith('+HealViaMaxHpRatio')||heal._ignoreHealFree||heal._skipModifierEvent
  ||injury.length!==1||!damage.$type.endsWith('+DamageViaMaxHpRatio')||damage._damageType!=='PURE'||damage._skipModifierEvent
  ||!(skill?.bb.hp_ratio>0&&skill.bb.stun_duration>0))throw Error('Unreviewed snake injury/recovery actions');
 const notes=JSON.parse(raw.notes);
 if(notes.sources?.hpLoss?.revision!==442170||notes.sources?.snake?.revision!==441734||notes.hpLoss?.resetOnHealing!==false
  ||notes.hpLoss?.comparison!=='GT'||notes.injured?.damageAtSkillStart!==true||notes.injured?.formalStunnedStatus!==false
  ||notes.interactionWait?.invulnerable!==true||notes.interactionWait?.blocksAbilityTriggers!==true)throw Error('Unreviewed supplemental snake semantics');
 return{schemaVersion:1,testOnly:true,scope:'Snake HP-loss admission, owned interaction wait, forced injury and recovery only. Complete boss and stage support remain held.',
  sources,enemy:counter.enemy,record:counter.record,parent,start,poll,success,failed,injury,clock:clocks[0],
  defaults:{interval:parent.triggerInterval,step:counter.record.bb['StepKill.hp_ratio'],heal:counter.record.bb['StepKill.enemy_musnake_heal_buff.hp_ratio'],
   injury:skill.bb.hp_ratio,duration:skill.bb.stun_duration},
  limits:['Canonical/native parameters and serialized actions govern; revision-pinned PRTS research supplies HP-stage persistence, injury onset and waiting semantics, not compiled/client/frame proof.',
   'UNMOVABLE_PRIVATE maps to an owned noMove flag, without bind, selfBound or displacement immunity. Injury action hold uses noMove/disarm without a Stunned status.',
   'The parent polls on world ticks without catch-up admissions. A pending wait coalesces admissions; injury and waiting resources are independent. Floating boundaries use an explicit ratio epsilon.',
   'A mandatory cast interrupt receiver must be wired by the future full boss actor. Existing injury is not restarted; intrinsic stun/freeze/levitate/sleep prevents forced admission.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: snake-health-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-snake-health-contract.json',root),text=JSON.stringify(await snakeHealthContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Snake health contract differs from retained sources');}else await writeFile(file,text);
 console.log('Verified snake health sources; complete enemy support remains held');
}
