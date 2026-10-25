// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {muamaCombatContract} from './muama-combat-contract.mjs';
import {parseSkel} from '../assets/skel.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
export async function muamaLineContract({read=readFile}={}){
 const sources={},raw={};
 for(const[name,path]of Object.entries({combat:'data/candidates/arkpedia-ch17-muama-combat-contract.json',graph:'data/candidates/arkpedia-ch17-firewall-boss-source.json',clock:'data/candidates/arkpedia-ch17-firewall-boss-animation-source.json',notes:'data/candidates/arkpedia-ch17-muama-mechanics-notes.json'})){
  raw[name]=await read(new URL(path,root));sources[name]={path,sha256:sha(raw[name])};
 }
 const combat=await muamaCombatContract({read});if(!Buffer.from(JSON.stringify(combat,null,2)+'\n').equals(raw.combat))throw Error('Stale Muama combat foundation');
 const graph=JSON.parse(raw.graph),clocks=JSON.parse(raw.clock),notes=JSON.parse(raw.notes),enemies={};
 if(notes.source.revision!==441735||notes.line.horizontalOwnRows!==3||notes.line.verticalOwnColumns!==3||notes.line.raysPerCast!==3
  ||!notes.line.firstContactOnly||notes.line.physicalAttackScale!==1||!notes.line.sameNamedImpactDoesNotStack)throw Error('Unreviewed Muama line corroboration');
 const one=(xs,f)=>{const found=xs.filter(f);if(found.length!==1)throw Error('Ambiguous Muama line source');return found[0];};
 const template=JSON.parse(graph.templates.enemy_muama_line_buff.originalJson),actions=event=>JSON.parse(one(template.eventToActions._items,e=>e.key===event).value.SerializedState),start=actions(0),tick=actions(2);
 if(start.length!==1||start[0]._buff.buffKey!=='stun'||!start[0]._isDerivedBuff||!start[0]._finishDerivedBuffIfParentFinish
  ||tick.length!==1||!tick[0].$type.endsWith('+FixedValueDamage')||tick[0]._damageType!=='PURE'||tick[0]._damageKey!=='value'||tick[0]._skipModifierEvent||tick[0]._damageSourceType!=='SOURCE')throw Error('Unreviewed Muama line impact');
 for(const[key,proof]of Object.entries(combat.enemies)){
  const rows=graph.prefabs['dyn/battle/prefabs/enemies/'+key+'.prefab'],names=new Map(rows.filter(c=>c.componentType==='GameObject').map(c=>[c.pathId,JSON.parse(c.originalJson).m_Name])),
   full=rows.filter(c=>c.componentType==='MonoBehaviour').map(c=>({id:c.pathId,data:JSON.parse(c.originalJson)})),skills={};
  const clock=clocks.enemies[key],p=parseSkel(Buffer.from(clock.base64,'base64'),null,{includeExactDurations:true,includeEventPayloads:true}),events=p.eventPayloads.Skill_End.filter(e=>e.name==='OnAttack');
  if(events.length!==1||p.exactDurations.Skill_Begin!==1||p.exactDurations.Skill_Loop!==1.5||p.exactDurations.Skill_End!==2)throw Error('Unreviewed Muama line clock');
  for(const name of ['HorizontalLineAttack','VerticalLine']){
   const parts=full.filter(c=>names.get(c.data.m_GameObject?.m_PathID)===name).map(c=>c.data),ability=one(parts,c=>c._activeBuffs),wrapper=one(parts,c=>'_ignoreSilence'in c),sequence=one(parts,c=>c._beginAnim),buff=ability._activeBuffs[0],
    trigger=one(full,c=>c.id===wrapper._trigger.m_PathID).data,selectorParts=full.filter(c=>c.data.m_GameObject.m_PathID===trigger.m_GameObject.m_PathID).map(c=>c.data),selector=one(selectorParts,c=>'_targetSide'in c),range=one(selectorParts,c=>'_horizonSize'in c),horizontal=name==='HorizontalLineAttack';
   if(ability._affectedBySlowDown!==0||ability._timeMode!==0||ability._maxAnimScale!==1||ability._damageType!==1||ability._atkScale!==1||ability._useCachedAtkOnly!==0
    ||ability._allowNoTarget!==0||ability._selectTargetTiming!==0||ability._waitForAttackEvent!==1||ability._resetCdStrategy!==1||ability._emitToInputPosWhenTargetIsInvalid!==0
    ||wrapper._ignoreSilence!==0||wrapper._immuneStunWhenAffecting!==0||wrapper._castLikeAttack!==0||wrapper._resetMainAbilityCdWhenCastEnd!==0
    ||sequence._beginAnim!=='Skill_Begin'||sequence._oneshotAnim!=='Skill_Loop'||sequence._endAnim!=='Skill_End'||sequence._maxAnimScale!==1
    ||trigger._minTargetNum!==1||trigger._keepTarget!==0||selector._ignoreTargetFree!==0||selector._targetSide!==2||selector._targetCategory!==1||selector._targetMotion!==1||selector._maxNum!==1
    ||range._horizonSize!==3||range._isHorizontalInfinite!==(horizontal?1:0)||range._isVerticalInfinite!==(horizontal?0:1)
    ||buff.templateKey!=='enemy_muama_line_buff'||buff.buffKey!==(key==='enemy_1590_muama'?'enemy_muama_line_buff':'enemy_mutwin_line_buff')||buff.durationKey!=='stun'||buff.triggerInterval!==1||buff.waitFirstTriggerInterval!==1||buff.isDamageMissable!==0
    ||buff.isSilenceable!==0||buff.isStunnable!==0||buff.isFreezable!==0||buff.isLevitatable!==0)throw Error('Unreviewed Muama line ability');
   const projectileParts=graph.projectiles['dyn/battle/prefabs/[uc]projectiles/'+ability._projectileKey+'.prefab'].map(c=>({...JSON.parse(c.originalJson),componentType:c.componentType})),
    mover=one(projectileParts,c=>'_speed'in c),projectile=one(projectileParts,c=>'_lifeTime'in c),collisionSelector=one(projectileParts,c=>'_targetSide'in c),collider=one(projectileParts,c=>c.componentType==='CircleCollider2D'),skill=one(proof.record.skills,c=>c.prefabKey===name);
   if(mover._speed!==10||mover._moveType!==4||mover._useHorizontalDir!==(horizontal?1:0)||mover._useVerticalDir!==(horizontal?0:1)
    ||projectile._lifeTime!==10||projectile._maxHitNum!==1||projectile._stopAfterMaxHit!==1||projectile._managedBySource!==0||projectile._stopWhenSourceInvalid!==0
    ||collisionSelector._ignoreTargetFree!==1||collisionSelector._targetCategory!==1||collisionSelector._targetSide!==2||collisionSelector._targetMotion!==1||collider.m_Radius!==.25
    ||!(skill.bb.value>0&&skill.bb.stun>0&&skill.initCooldown>0&&skill.cooldown>0))throw Error('Unreviewed Muama line transport');
   skills[name]={ability,wrapper,sequence,trigger,selector,range,mover,projectile,collisionSelector,collider,
    defaults:{horizontal,initialCooldown:skill.initCooldown,cooldown:skill.cooldown,damage:skill.bb.value,dotDuration:skill.bb.stun,interval:buff.triggerInterval,
     hit:p.exactDurations.Skill_Begin+p.exactDurations.Skill_Loop+events[0].time,duration:p.exactDurations.Skill_Begin+p.exactDurations.Skill_Loop+p.exactDurations.Skill_End,
     speed:mover._speed,maxAge:projectile._lifeTime,radius:collider.m_Radius,buffKey:buff.buffKey}};
  }
  enemies[key]={record:proof.record,skills};
 }
 return{schemaVersion:1,testOnly:true,scope:'Internal Muama/twin horizontal and vertical line actors and collision/impact mechanics. No complete boss or stage admission.',sources,start,tick,enemies,
  limits:['Begin, Loop and End are played once in sequence using literal source clip seconds, unaffected by ASPD or slowdown. This local sequence dispatch is not compiled/frame proof; native timeMode0 and sequence fields remain retained for review.',
   'Ready skills occupy a ready ordinary attack opportunity. Ordinary cooldown continues while casting; skill cooldown restarts at cast end. Equal ready line skills use seeded random arbitration. Blink must join the same actor arbitration before full boss support.',
   'Three rays use root-tile row/column centers with offsets -1,0,1 and the selected target axis direction, captured at admission. Exact visual mount projection and zero-axis facing are local mappings, not captured client geometry.',
   'Admission uses ordinary ground target filters; collision ignores target-free flags but skips hidden bodies, devices and flying motion. Swept point/circle transport is a local mapping.',
   'Physical impact does not gate the separate named DOT/derived stun on damage success. One parent per native key replaces earlier ownership across same-key casters; distinct native keys coexist.',
   'Silence prevents admission; intrinsic control/epoch changes interrupt an active cast. Born output survives source retirement with captured source attribution. Target redeployment and battle end retire its impact. No skill-driven ATK stack increment is inferred.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: muama-line-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-muama-line-contract.json',root),text=JSON.stringify(await muamaLineContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Muama line contract differs from retained sources');}else await writeFile(file,text);
 console.log('Verified retained Muama/twin line sources; complete boss support remains held');
}
