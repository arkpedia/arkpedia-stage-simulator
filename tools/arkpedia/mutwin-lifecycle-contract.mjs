// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {muamaBlinkContract} from './muama-blink-contract.mjs';
const root=new URL('../../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
export async function mutwinLifecycleContract({read=readFile}={}){
 const sources={},raw={};
 for(const[name,path]of Object.entries({foundation:'data/candidates/arkpedia-ch17-muama-blink-contract.json',graph:'data/candidates/arkpedia-ch17-firewall-boss-source.json',events:'data/candidates/arkpedia-buff-event-alias-source.json',notes:'data/candidates/arkpedia-ch17-mutwin-lifecycle-notes.json'})){
  raw[name]=await read(new URL(path,root));sources[name]={path,sha256:sha(raw[name])};
 }
 const foundation=await muamaBlinkContract({read});if(!Buffer.from(JSON.stringify(foundation,null,2)+'\n').equals(raw.foundation))throw Error('Stale twin lifecycle foundation');
 const g=JSON.parse(raw.graph),events=JSON.parse(raw.events),notes=JSON.parse(raw.notes),enemies={};
 const one=(xs,f)=>{const found=xs.filter(f);if(found.length!==1)throw Error('Ambiguous twin lifecycle source');return found[0];};
 const actions=(key,event)=>JSON.parse(one(JSON.parse(g.templates[key].originalJson).eventToActions._items,e=>e.key===event).value.SerializedState),markStart=actions('enemy_mutin_mark_alive',0),markFinish=actions('enemy_mutin_mark_alive',1),healTick=actions('enemy_mutiwin_t[heal]',2),roomFinish=actions('enemy_mutwin_move_camera',1);
 if(events.events['0']?.name!=='ON_BUFF_START'||events.events['1']?.name!=='ON_BUFF_FINISH'||events.events['2']?.name!=='ON_BUFF_TRIGGER'
  ||notes.source.revision!==441736||!notes.reborn.clearsTeleportImmunity||!notes.reborn.resetsSkillCooldownsToInitial||!notes.fakeDeath.partnerLossSkipsReborn
  ||markStart.length!==1||!markStart[0]._conditionNode.$type.endsWith('+CheckUnitInRebornState')||markStart[0]._succeedNodes!==null
  ||markStart[0]._failNodes[0]._buff.buffKey!=='ally_alive'||markStart[0]._failNodes[0]._buffOwner!=='SOURCE'||!markStart[0]._failNodes[0]._isDerivedBuff||!markStart[0]._failNodes[0]._finishDerivedBuffIfParentFinish
  ||markFinish[0]._conditionNode._checkCurModeIndex!==1||!markFinish[0]._succeedNodes[0]._skipReborn||!markFinish[0]._succeedNodes[0]._killSource
  ||healTick[0]._conditionNode._buffKeys[0]!=='ally_alive'||!healTick[0]._succeedNodes[0].$type.endsWith('+HealViaMaxHpRatio')||healTick[0]._succeedNodes[0]._getMaxHpFromTarget||healTick[0]._succeedNodes[0]._ignoreHealFree||healTick[0]._succeedNodes[0]._skipModifierEvent
  ||healTick[0]._succeedNodes[1]._conditionNode._condType!=='GE'||healTick[0]._succeedNodes[1]._conditionNode._blackboardPrefix!=='target_'||healTick[0]._succeedNodes[1]._succeedNodes[0]._modeIndex!==0||!healTick[0]._succeedNodes[1]._succeedNodes[0]._restoreDefault||!healTick[0]._succeedNodes[1]._succeedNodes[0]._restartFSM
  ||!healTick[0]._failNodes[0]._skipReborn||!healTick[0]._failNodes[0]._killSource||roomFinish.length!==2||!roomFinish[0].$type.endsWith('+Mainline17MoveCameraWithWithdraw')||roomFinish[0]._offsetKey!=='boss_room'||!roomFinish[0]._loadOffsetFromBlackboard||roomFinish[0]._delay!==2.5||roomFinish[1]._branchId!=='boss'||roomFinish[1]._isLoop)throw Error('Unreviewed twin lifecycle actions');
 for(const key of ['enemy_1591_mutwin','enemy_1591_mutwin_2']){
  const rows=g.prefabs['dyn/battle/prefabs/enemies/'+key+'.prefab'],parts=rows.map(r=>({id:r.pathId,type:r.componentType,data:JSON.parse(r.originalJson)})),byId=new Map(parts.map(p=>[p.id,p.data])),names=new Map(parts.filter(p=>p.type==='GameObject').map(p=>[p.id,p.data.m_Name])),full=parts.filter(p=>p.type==='MonoBehaviour').map(p=>p.data),
   rootEnemy=one(full,c=>c._modes),reborn=one(full,c=>c._buffsRetainedWhenReborn),aura=one(full,c=>c._listenUnitRebornEvent),validator=byId.get(aura._targetValidator.m_PathID),heal=aura._passiveBuffs[0],mode=byId.get(rootEnemy._modes[1].m_PathID),normal=byId.get(rootEnemy._modes[0].m_PathID),
   camera=full.flatMap(c=>c._buffs??[]).filter(c=>c.buffKey==='enemy_mutwin_move_camera'),r=foundation.enemies[key].record,bb=r.talents.bb;
  const pathFor=data=>{let t=one(parts,p=>p.type==='Transform'&&p.data.m_GameObject.m_PathID===data.m_GameObject.m_PathID).data;const path=[];while(t){path.push(names.get(t.m_GameObject.m_PathID));t=byId.get(t.m_Father.m_PathID);}return path;};
  if(rootEnemy._modes.length!==2||mode._attack.m_PathID!=='0'||mode._combat.m_PathID!=='0'||normal._attack.m_PathID!==normal._combat.m_PathID
   ||reborn._modeIndex!==1||reborn._maxRespawnCnt!==-1||reborn._detachAbilityWhenReborn!==0||reborn._hpRechargeRatio!==.05000000074505806
   ||JSON.stringify(reborn._buffsRetainedWhenReborn)!==JSON.stringify(['enemy_mutwin_move_camera','enemy_mutwin_t[damage_resistance]','enemy_muama_t','enemy_mutwin_passiveBuff'])
   ||!pathFor(aura).includes('FakeDeath')||!pathFor(aura).includes('Body')||!pathFor(aura).includes('Modes')||!pathFor(one(full,c=>c._ignoreSilence===1&&c._maxTriggerTime===-1)).includes('Default')
   ||validator._targetId!==(key==='enemy_1591_mutwin'?'enemy_1591_mutwin_2':'enemy_1591_mutwin')||aura._listenUnitRebornEvent!==1||aura._tryRemoveBuffFirstWhenReborn!==1||aura._clearBuffsWhenDisappear!==0||aura._excludeReborningEntity!==0||aura._interval!==0
   ||aura._buffs[0].buffKey!=='enemy_mutin_mark_alive'||heal.buffKey!=='enemy_mutiwin_t[heal]'||heal.triggerInterval!==1||heal.waitFirstTriggerInterval!==1||JSON.stringify(heal.attributes.abnormalFlags)!=='[5,3,22]'
   ||bb['Reborn.duration']!==notes.reborn.duration||bb['Reborn.hp_ratio']!==notes.reborn.hpRatio||bb['FakeDeath.hp_ratio']!==notes.fakeDeath.healRatio||bb['FakeDeath.target_hp_ratio']!==notes.fakeDeath.resumeRatio
   ||camera.length!==(key==='enemy_1591_mutwin'?1:0))throw Error('Unreviewed twin lifecycle binding');
  enemies[key]={record:r,reborn,aura,validator,mode,normal,camera:camera[0]??null,defaults:{partner:validator._targetId,rebornDuration:bb['Reborn.duration'],rebornRatio:bb['Reborn.hp_ratio'],healRatio:bb['FakeDeath.hp_ratio'],resumeRatio:bb['FakeDeath.target_hp_ratio'],interval:heal.triggerInterval,retainedKeys:reborn._buffsRetainedWhenReborn,room:r.talents.bbStr['DamageResistance.boss_room']}};
 }
 return{schemaVersion:1,testOnly:true,scope:'Internal twin rebirth/fake-death recovery and source-bound partner ownership. Room handoff requires a canonical receiver; no complete enemy/stage admission.',sources,markStart,markFinish,healTick,roomFinish,enemies,
  limits:['Fatal HP loss uses an authenticated post-loss repair bridge. The engine keeps one positive HP during the short protected rebirth, then assigns the canonical rebirth ratio before entering fake-death mode. This is not a literal native death/FSM or compiled/frame proof.',
   'Only one live deployment of each exact twin prefab is registered per battle. Partner markers are source/deployment owned; a partner in rebirth or fake-death cannot qualify. Multiple simultaneous copies require a separate aura/override review.',
   'Rebirth retains the serialized four keys and explicitly marked nativeDurable instances; runtime persist alone does not prove native durability. Existing incoming-buff producers need a durability audit before full stage admission. Teleport immunity/transient controls clear, unborn actions cancel and skills reset. Root line cooldowns continue during fake-death; the initial-mode Blink cooldown pauses.',
   'The fake-death heal parent ticks on world seconds through the ordinary heal modifier/heal-free pipeline. Losing an established partner marker forces death immediately; starting without a qualifying partner is handled by the first native heal-parent tick.',
   'Mode return uses an explicit local state restart without inventing additional animation holds. Born projectiles/impacts retain their source ownership. Scripted kill/removal bypasses the HP-loss bridge; forced partner-loss kill bypasses rebirth.',
   'The first twin alone owns the native room-finish parent. Its exact camera/branch actions and room offset are passed once to a required receiver; the receiver must execute canonical stage withdrawal/camera/branch semantics before admission.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.slice(2).some(a=>a!=='--check'))throw Error('Usage: mutwin-lifecycle-contract.mjs [--check]');
 const file=new URL('data/candidates/arkpedia-ch17-mutwin-lifecycle-contract.json',root),text=JSON.stringify(await mutwinLifecycleContract(),null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(file,'utf8')!==text)throw Error('Twin lifecycle contract differs from retained sources');}else await writeFile(file,text);
 console.log('Verified twin rebirth/fake-death and partner source rules; boss/stage support remains held');
}
