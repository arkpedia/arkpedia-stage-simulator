// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {snakeHealthContract} from './snake-health-contract.mjs';
import {parseSkel} from '../assets/skel.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
export async function snakeLineContract({read=readFile}={}){
 const sources={},raw={};
 for(const[name,path]of Object.entries({health:'data/candidates/arkpedia-ch17-snake-health-contract.json',
  graph:'data/candidates/arkpedia-ch17-firewall-boss-source.json',indexed:'data/candidates/arkpedia-ch17-firewall-boss-native.json',
  clock:'data/candidates/arkpedia-ch17-firewall-boss-animation-source.json'})){
  raw[name]=await read(new URL(path,root));sources[name]={path,sha256:sha(raw[name])};
 }
 const health=await snakeHealthContract({read});
 if(!Buffer.from(JSON.stringify(health,null,2)+'\n').equals(raw.health))throw Error('Stale snake health foundation');
 const graph=JSON.parse(raw.graph),parts=JSON.parse(raw.indexed).prefabs['dyn/battle/prefabs/enemies/'+health.enemy+'.prefab'];
 const one=(rows,predicate)=>{const matches=rows.filter(predicate);if(matches.length!==1)throw Error('Ambiguous snake line source');return matches[0];};
 const components=parts.filter(c=>c.objectName==='GlobalLineAttack').map(c=>JSON.parse(c.originalJson)),
  ability=one(components,c=>'_attackFromTop'in c),wrapper=one(components,c=>'_ignoreSilence'in c),buff=ability._activeBuffs[0];
 if(ability._attackFromTop!==1||ability._borderToPeel!==1||ability._atkScale!==0||ability._timeMode!==1||ability._affectedBySlowDown!==1
  ||ability._animKey!=='Skill_1'||ability._projectileKey!=='projectile_enemy_musnake'||wrapper._ignoreSilence!==1||wrapper._immuneStunWhenAffecting!==1
  ||buff.buffKey!=='enemy_musnake_line_buff'||buff.durationKey!=='stun'||buff.triggerInterval!==1||buff.waitFirstTriggerInterval!==1)
  throw Error('Unreviewed snake global line ability');
 const projectileRows=graph.projectiles['dyn/battle/prefabs/[uc]projectiles/'+ability._projectileKey+'.prefab'],
  parsed=projectileRows.map(r=>({...JSON.parse(r.originalJson),componentType:r.componentType})),
  selector=one(parsed,c=>'_targetSide'in c),mover=one(parsed,c=>'_speed'in c),projectile=one(parsed,c=>'_lifeTime'in c),collider=one(parsed,c=>c.componentType==='CircleCollider2D');
 if(selector._targetSide!==2||selector._targetCategory!==1||selector._targetMotion!==1||selector._ignoreTargetFree!==1||selector._maxNum!==1
  ||mover._speed!==10||mover._moveType!==4||mover._useStartDirection!==1||projectile._maxHitNum!==1||projectile._stopAfterMaxHit!==1
  ||projectile._managedBySource!==0||projectile._stopWhenSourceInvalid!==0||projectile._lifeTime!==10||collider.m_Radius!==.5)
  throw Error('Unreviewed snake line transport');
 const template=JSON.parse(graph.templates[buff.templateKey].originalJson),actions=event=>JSON.parse(template.eventToActions._items.find(e=>e.key===event).value.SerializedState),
  start=actions(0),tick=actions(2);
 if(start.length!==1||start[0]._buff.buffKey!=='stun'||!start[0]._isDerivedBuff||!start[0]._finishDerivedBuffIfParentFinish
  ||tick.length!==1||!tick[0].$type.endsWith('+FixedValueDamage')||tick[0]._damageType!=='PURE'||tick[0]._damageKey!=='value'
  ||tick[0]._skipModifierEvent||tick[0]._damageSourceType!=='SOURCE')throw Error('Unreviewed snake line impact');
 const clock=JSON.parse(raw.clock),c=clock.enemies[health.enemy],bytes=Buffer.from(c.base64,'base64');
 if(clock.source.graph.sha256!==sources.graph.sha256||sha(bytes)!==c.sha256||bytes.length!==c.bytes||sha(c.skeletonDataOriginalJson)!==c.skeletonDataSha256)
  throw Error('Unreviewed snake original clock bytes');
 const bindings=graph.prefabs['dyn/battle/prefabs/enemies/'+health.enemy+'.prefab'].map(r=>JSON.parse(r.originalJson)).filter(t=>t.skeletonDataAsset);
 if(bindings.length!==1||JSON.stringify(bindings[0].skeletonDataAsset)!==JSON.stringify(c.prefabBinding))throw Error('Unbound snake animation');
 const p=parseSkel(bytes,null,{includeExactDurations:true,includeEventPayloads:true}),events=p.eventPayloads.Skill_1.filter(e=>e.name==='OnAttack'),skill=health.record.skills.find(s=>s.prefabKey==='GlobalLineAttack');
 if(events.length!==1||events[0].time!==2.4666666984558105||p.exactDurations.Skill_1!==6||!(skill.cooldown>0&&skill.initCooldown>0&&skill.bb.value>0&&skill.bb.stun>0))
  throw Error('Unreviewed snake line clock/parameters');
 return{schemaVersion:1,testOnly:true,scope:'Source-bound snake global line cast, first-contact ground-ally transport and nonstacking impact only. No firewall, wave, stage or complete enemy support approval.',
  sources,enemy:health.enemy,record:health.record,ability,wrapper,selector,mover,projectile,collider,start,tick,
  defaults:{initialCooldown:skill.initCooldown,cooldown:skill.cooldown,hit:events[0].time,duration:p.exactDurations.Skill_1,
   speed:mover._speed,maxAge:projectile._lifeTime,radius:collider.m_Radius,interval:buff.triggerInterval,dotDuration:skill.bb.stun,damage:skill.bb.value,borderToPeel:ability._borderToPeel},
  limits:['TimeMode1 uses literal clip time affected once by live slowdown, independent of ASPD. Cooldown restarts at cast end. These are local engine mappings, not compiled/frame parity.',
   'The battle rectangle is the full canonical grid; borderToPeel removes its outer row/column on each side. Rays start on the top retained row and move down. Stage integration must verify this mapping against its retained geometry.',
   'Swept point/circle first contact is a local transport mapping. Target-free is ignored; ground-motion ops/tokens intercept including untargetability/stealth/camouflage and liftoff, which does not change motion. Devices, hidden bodies and FLY motion do not intercept.',
   'One named impact replaces its prior parent and owns a separate derived stun. Parent DOT uses world time and is not shortened by stun immunity/resistance; its derived stun uses the ordinary status pipeline.',
   'Born projectiles and impact parents outlive caster retirement. A captured source view prevents reused bodies from changing their attribution or modifiers. Battle end retires all output.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: snake-line-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-snake-line-contract.json',root),text=JSON.stringify(await snakeLineContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Snake line contract differs from retained sources');}else await writeFile(file,text);
 console.log('Verified original snake line transport and clocks; complete enemy support remains held');
}
