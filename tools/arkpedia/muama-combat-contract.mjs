// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {snakeFirewallContract} from './snake-firewall-contract.mjs';
import {verifiedFirewallEnvironmentSource} from './firewall-environment-source.mjs';
import {parseSkel} from '../assets/skel.mjs';
import {CN_NATIVE_PIN} from './cn-native-source.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
export async function muamaCombatContract({read=readFile}={}){
 const sources={},raw={};
 for(const[name,path]of Object.entries({foundation:'data/candidates/arkpedia-ch17-snake-firewall-contract.json',graph:'data/candidates/arkpedia-ch17-firewall-boss-source.json',
  indexed:'data/candidates/arkpedia-ch17-firewall-boss-native.json',clock:'data/candidates/arkpedia-ch17-firewall-boss-animation-source.json',
  records:'data/candidates/arkpedia-enemy-records.canonical.json',environment:'data/candidates/arkpedia-ch17-firewall-environment-source.json',
  ranges:'data/candidates/arkpedia-ch17-channel-carrier-range-source.json',cnRanges:'data/arkpedia-cn-source.json',notes:'data/candidates/arkpedia-ch17-muama-mechanics-notes.json'})){
  raw[name]=await read(new URL(path,root));sources[name]={path,sha256:sha(raw[name])};
 }
 const foundation=await snakeFirewallContract({read});
 if(!Buffer.from(JSON.stringify(foundation,null,2)+'\n').equals(raw.foundation))throw Error('Stale firewall foundation');
 const environment=verifiedFirewallEnvironmentSource(raw.environment,await read(new URL('data/arkpedia-cn-native-source.json',root))),
  configs=Object.values(environment.prefabs).flat().map(r=>JSON.parse(r.originalJson)).find(c=>c._bossFirewallEffectConfigs)._bossFirewallEffectConfigs;
 const witness=JSON.parse(raw.ranges),rangeBytes=Buffer.from(witness.originalTableBase64,'base64'),cn=JSON.parse(raw.cnRanges),
  mvp=JSON.parse(await read(new URL('data/arkpedia-mvp.json',root))),range=JSON.parse(rangeBytes)['x-4'];
 if(witness.source.repository!==mvp.behaviors.source.repository||witness.source.commit!==mvp.behaviors.source.commit
  ||witness.source.gitBlob!=='c1e28a9f2c7350bb5f5de13ba27950dca49f0de7'||witness.source.sha256!=='676cedce20d46f37c46e1099b2f94907d0c84ac62b674957355c245ce16f0856'
  ||witness.source.bytes!==42868||cn.source.repository!==CN_NATIVE_PIN.repository||cn.source.commit!==CN_NATIVE_PIN.commit
  ||witness.source.path!=='en_US/gamedata/excel/range_table.json'||rangeBytes.length!==witness.source.bytes||sha(rangeBytes)!==witness.source.sha256
  ||createHash('sha1').update(`blob ${rangeBytes.length}\0`).update(rangeBytes).digest('hex')!==witness.source.gitBlob
  ||JSON.stringify(range)!==JSON.stringify(cn.tables.ranges['x-4'])||range.grids.length!==9
  ||new Set(range.grids.map(p=>`${p.row},${p.col}`)).size!==9||range.grids.some(p=>!Number.isInteger(p.row)||!Number.isInteger(p.col)||Math.abs(p.row)>1||Math.abs(p.col)>1))throw Error('Unreviewed firewall x-4 range');
 const notes=JSON.parse(raw.notes);if(notes.source.revision!==441735||!notes.sameTarget.firstAttackHasOneStack||!notes.sameTarget.resetOnTargetChange
  ||!notes.firewall.brokenSideReleasesThreeBoundaryTiles)throw Error('Unreviewed Muama corroboration');
 const graph=JSON.parse(raw.graph),indexed=JSON.parse(raw.indexed),clocks=JSON.parse(raw.clock),records=JSON.parse(raw.records),enemies={};
 if(clocks.source.graph.sha256!==sources.graph.sha256)throw Error('Unbound firewall boss clocks');
 const one=(xs,f)=>{const found=xs.filter(f);if(found.length!==1)throw Error('Ambiguous Muama combat component');return found[0];};
 for(const key of ['enemy_1590_muama','enemy_1591_mutwin','enemy_1591_mutwin_2']){
  const path='dyn/battle/prefabs/enemies/'+key+'.prefab',rows=graph.prefabs[path],parts=indexed.prefabs[path],
   names=new Map(rows.filter(c=>c.componentType==='GameObject').map(c=>[c.pathId,JSON.parse(c.originalJson).m_Name])),
   full=rows.filter(c=>c.componentType==='MonoBehaviour').map(c=>({id:c.pathId,name:names.get(JSON.parse(c.originalJson).m_GameObject?.m_PathID),data:JSON.parse(c.originalJson)}));
  const attackRow=one(parts,c=>c.objectName==='Attack'&&JSON.parse(c.originalJson)._projectileKey),attack=JSON.parse(attackRow.originalJson),
   mode=one(full,c=>c.data._attack?.m_PathID===attackRow.pathId).data,
   stack=one(full,c=>c.name==='SameTargetAtkUp'&&c.data._stackBuff).data,
   passive=full.filter(c=>['DamageResistance','PassiveBuff'].includes(c.name)).flatMap(c=>c.data._buffs??[])
    .filter(c=>c.buffKey.endsWith('_t[damage_resistance]')||c.buffKey==='enemy_mutwin_passiveBuff'||['immune_shu_blink','immune_yu_blink'].includes(c.buffKey));
  if(mode._combat.m_PathID!==mode._attack.m_PathID||attack._damageType!==(key==='enemy_1590_muama'?2:1)||attack._animKey!=='Attack'||attack._timeMode!==0||attack._maxAnimScale!==1||attack._affectedBySlowDown!==1
   ||attack._atkScale!==1||attack._selectTargetTiming!==0||attack._useCachedAtkOnly!==0||stack._ignoreOwnerAsTarget!==1||stack._onlyApplyOnFirstSpell!==0
   ||stack._stackBuff.maxStackCnt!==1||stack._stackBuff.overrideType!==1||stack._stackBuff.lifeTimeType!==2||stack._stackBuff.isSilenceable!==0
   ||stack._stackBuff.attributes.attributeModifiers[0].attributeType!==1||stack._stackBuff.attributes.attributeModifiers[0].formulaItem!==0
   ||!passive.some(p=>p.buffKey==='immune_shu_blink')||!passive.some(p=>p.buffKey==='immune_yu_blink'))throw Error('Unreviewed Muama ordinary or passive');
  const projectileRows=graph.projectiles['dyn/battle/prefabs/[uc]projectiles/'+attack._projectileKey+'.prefab'].map(c=>JSON.parse(c.originalJson)),
   mover=one(projectileRows,c=>'_speed'in c),projectile=one(projectileRows,c=>'_lifeTime'in c);
  if(mover._speed!==10||mover._moveType!==1||mover._forceReachedWhenTimeup!==1||projectile._lifeTime!==10||projectile._stopWhenSourceInvalid!==0
   ||projectile._alwaysHitTraceTargetInTheEnd!==1||projectile._maxHitNum!==1)throw Error('Unreviewed Muama ordinary projectile');
  const c=clocks.enemies[key],bytes=Buffer.from(c.base64,'base64'),binding=one(full,c=>'skeletonDataAsset'in c.data).data.skeletonDataAsset;
  if(sha(bytes)!==c.sha256||bytes.length!==c.bytes||JSON.stringify(binding)!==JSON.stringify(c.prefabBinding)||sha(c.skeletonDataOriginalJson)!==c.skeletonDataSha256)
   throw Error('Unreviewed Muama clock bytes');
  const parsed=parseSkel(bytes,null,{includeExactDurations:true,includeEventPayloads:true}),events=parsed.eventPayloads.Attack.filter(c=>c.name==='OnAttack'),r=records.enemies[key].levels[0],config=configs.find(c=>c.bossId===key);
  if(events.length!==1||config.firewallRangeId!=='x-4'||config.firewallWidth!==0||config.firewallHeight!==0||!(r.talents.bb['SameTargetAtkUp.atk']>0)
   ||r.talents.bb['SameTargetAtkUp.max_stack_cnt']!==4||r.talents.bb['DamageResistance.damage_resistance']!==.9)throw Error('Unreviewed Muama parameters');
  enemies[key]={record:{talents:r.talents,skills:r.skills,abilities:r.abilities},attack,stack,passive,config,mover,projectile,
   defaults:{hit:events[0].time,duration:parsed.exactDurations.Attack,type:attack._damageType===2?'arts':'phys',speed:mover._speed,maxAge:projectile._lifeTime,
    increment:r.talents.bb['SameTargetAtkUp.atk'],maxStacks:r.talents.bb['SameTargetAtkUp.max_stack_cnt'],resistance:r.talents.bb['DamageResistance.damage_resistance']}};
 }
 return{schemaVersion:1,testOnly:true,scope:'Muama/twin ordinary attack, target ATK ramp and source-bound three-by-three firewall only. Skills, refresh, twins fake-death/reborn, room behavior, enemy/stage admission remain separate.',
  sources,range,enemies,limits:['Target ramp is admitted before a source-owned ordinary release, including its first stack. Target identity includes deployment; idle and damage prevention do not clear the accepted count.',
   'TimeMode0 samples a capped BAT/interval rate, then uses the existing explicit affectedBySlowDown elapsed bridge. This local rate/control mapping is not compiled/frame proof.',
   'Original target-tracking output uses the shared finite projectile system and live original-source ATK. A captured view prevents source reuse from changing born output; source retirement cancels only unborn releases.',
   'The three-by-three native x-4 range agrees in the complete pinned named range table and prepared CN table. Broken sides release their three boundary tiles; a corner is released by either adjacent broken side, and the center remains excluded.',
   'Named teleport-immunity markers and private immobility parents retain their source keys. No fake-death, skill, refresh, room-camera or public support policy is synthesized by these passives.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: muama-combat-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-muama-combat-contract.json',root),text=JSON.stringify(await muamaCombatContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Muama combat contract differs from retained sources');}else await writeFile(file,text);
 console.log('Verified original Muama/twin combat and x-4 firewall; complete boss support remains held');
}
