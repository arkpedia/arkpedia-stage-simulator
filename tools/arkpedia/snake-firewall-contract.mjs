// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {snakeHealthContract} from './snake-health-contract.mjs';
import {verifiedFirewallEnvironmentSource} from './firewall-environment-source.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
export async function snakeFirewallContract({read=readFile}={}){
 const sources={},raw={};
 for(const[name,path]of Object.entries({health:'data/candidates/arkpedia-ch17-snake-health-contract.json',graph:'data/candidates/arkpedia-ch17-firewall-boss-source.json',
  indexed:'data/candidates/arkpedia-ch17-firewall-boss-native.json',environment:'data/candidates/arkpedia-ch17-firewall-environment-source.json',
  notes:'data/candidates/arkpedia-ch17-boss-mechanics-notes.json',events:'data/candidates/arkpedia-buff-event-alias-source.json',
  damageEvents:'data/candidates/arkpedia-war-caster-event-alias-source.json'})){
  raw[name]=await read(new URL(path,root));sources[name]={path,sha256:sha(raw[name])};
 }
 const health=await snakeHealthContract({read});
 if(!Buffer.from(JSON.stringify(health,null,2)+'\n').equals(raw.health))throw Error('Stale snake health foundation');
 if(JSON.parse(raw.events).events['1']?.name!=='ON_BUFF_FINISH'||JSON.parse(raw.damageEvents).events['10']?.name!=='ON_TAKE_DAMAGE')
  throw Error('Uncorroborated firewall callbacks');
 const environment=verifiedFirewallEnvironmentSource(raw.environment,await read(new URL('data/arkpedia-cn-native-source.json',root))),
  config=Object.values(environment.prefabs).flat().map(c=>JSON.parse(c.originalJson)).find(c=>c._bossFirewallEffectConfigs)._bossFirewallEffectConfigs.find(c=>c.bossId===health.enemy);
 const graph=JSON.parse(raw.graph),path='dyn/battle/prefabs/enemies/'+health.enemy+'.prefab',parts=JSON.parse(raw.indexed).prefabs[path],
  buffs=parts.flatMap(c=>JSON.parse(c.originalJson)._buffs??[]),parent=buffs.find(b=>b.buffKey==='enemy_musnake_t[damage_resistance]'),init=buffs.find(b=>b.buffKey==='enemy_musnake_init_fire_button');
 const actions=(key,event)=>JSON.parse(JSON.parse(graph.templates[key].originalJson).eventToActions._items.find(e=>e.key===event).value.SerializedState);
 const damage=actions(parent.templateKey,10),initial=actions(init.templateKey,1);
 if(parent.isSilenceable!==0||parent.isStunnable!==0||parent.isFreezable!==0||parent.isLevitatable!==0||parent.lifeTimeType!==2||JSON.stringify(parent.attributes.abnormalFlags)!=='[22]'
  ||damage.length!==2||!damage[0].$type.endsWith('+CheckFirewallDamageSource')||damage[0]._targetType!=='BUFF_OWNER'
  ||!damage[1].$type.endsWith('+DamageScale')||damage[1]._damageMask!=='PHYSICAL_AND_MAGICAL'||!damage[1]._filterDamageType||!damage[1]._isOneMinus||damage[1]._isStackable
  ||initial.length!==1||!initial[0].$type.endsWith('+CreateFirewallVulnerabilityButton')||!initial[0]._createForAllWalls||initial[0]._radiationSourceType!=='SOURCE'
  ||init.lifeTime!==.5||init.lifeTimeType!==1||init.isSilenceable!==0||config.firewallRangeId!==''||config.firewallWidth!==7||config.firewallHeight!==4
  ||config.vulnerabilityButtonDuration!==5||config.vulnerabilityRequiredClickCount!==3)throw Error('Unreviewed snake firewall configuration');
 const all=graph.prefabs[path].map(c=>({...JSON.parse(c.originalJson),componentType:c.componentType})),owner=all.find(c=>c._locateRange),
  locate=all.find(c=>c.m_GameObject?.m_PathID===owner.m_GameObject.m_PathID&&'_useBlackboardRangeId'in c),
  boxes=all.filter(c=>c.componentType==='BoxCollider2D'&&c.m_GameObject.m_PathID===owner.m_GameObject.m_PathID);
 if(boxes.length!==1||locate._useBlackboardRangeId!==0||owner._locateRange.m_PathID!==graph.prefabs[path].find(c=>JSON.parse(c.originalJson)._useBlackboardRangeId===0)?.pathId
  ||boxes[0].m_Size.x!==config.firewallWidth||boxes[0].m_Size.y!==config.firewallHeight||boxes[0].m_Offset.x!==0||boxes[0].m_Offset.y!==0)
  throw Error('Unreviewed snake hit-body binding');
 const resistance=health.record.bb['DamageResistance.damage_resistance'],notes=JSON.parse(raw.notes);
 if(!(resistance>0&&resistance<1)||notes.sources?.snake?.revision!==441734)throw Error('Unreviewed snake firewall semantics');
 return{schemaVersion:1,testOnly:true,scope:'Snake firewall incoming damage, native hit body, direct-placement exclusion and initial side interaction only. No complete enemy/stage/wave or compiled/frame approval.',
  sources,enemy:health.enemy,record:health.record,config,parent,init,damage,initial,collider:boxes[0],
  body:{w:boxes[0].m_Size.x,h:boxes[0].m_Size.y,dx:boxes[0].m_Offset.x,dy:boxes[0].m_Offset.y},
  defaults:{width:config.firewallWidth,height:config.firewallHeight,duration:config.vulnerabilityButtonDuration,clicks:config.vulnerabilityRequiredClickCount,
   resistance,initialDelay:init.lifeTime,initialSides:[0,1,3]},
  corroboration:{source:notes.sources.snake,initialSides:'BOTTOM, RIGHT, LEFT; TOP has no initial vulnerability in the canonical snake encounter'},
  limits:['Wall geometry is committed at construction/explicit environment refresh; moving the body alone does not guess an environment rebuild. Teleport/refresh parity remains unverified.',
   'Rectangle segment crossing uses point positions, strict interior endpoints and an explicit epsilon. Any remaining wall crossed applies the source nonstacking multiplier once after DEF/RES and before shields.',
   'Direct placement checks use tile centers strictly inside the committed snake rectangle. Snake side breaks remove reduction, without borrowing Muama\'s separate three-tile directional release. Automatic conjures/forced movement are not inferred to perform direct-placement checks.',
   'Native root BoxCollider2D maps to the existing huge-unit range body. Collision/targeting frame parity and the original visual shape remain separate.',
   'The native all-walls action and revision-pinned first-hand snake research bind three initial sides after the source half-second buff. Local input generations and exact-instance cleanup preserve ownership; canonical stage integration is still required.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: snake-firewall-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-snake-firewall-contract.json',root),text=JSON.stringify(await snakeFirewallContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Snake firewall contract differs from retained sources');}else await writeFile(file,text);
 console.log('Verified original snake firewall and body; complete stage support remains held');
}
