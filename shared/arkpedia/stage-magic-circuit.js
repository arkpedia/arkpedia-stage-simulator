// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const type = name => `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
import { FLUX_REFLECTOR_PORTS } from './flux-reflector-ports.js';
export { FLUX_REFLECTOR_PORTS } from './flux-reflector-ports.js';
export { fluxReflectorTurns, traceMagicCircuits } from './magic-circuit-routing.js';
export function fluxReflectorNativeReviewed(e = native) {
  const rows=e.prefabs.trap_063_magicturn?.components ?? [], by=new Map(rows.map(c=>[c.pathId,c.data]));
  const root=rows.find(c=>c.object==='trap_063_magicturn'&&'_modes'in c.data)?.data;
  const mode=by.get(root?._modes?.[0]?.m_PathID), passive=by.get(mode?._generalAbilities?.[0]?.m_PathID),buff=passive?._buffs?.[0];
  const events=e.templates.trap_magicturn_t?.eventToActions,start=events?.ON_BUFF_START,end=events?.ON_BUFF_FINISH;
  const enter=events?.ON_ENTER_MAGICCIRCUIT,leave=events?.ON_LEAVE_MAGICCIRCUIT;
  return root?._sideType===1&&root._category===2&&root._occupiedRemainingCharacterCnt===0&&root._withdrawable===0
    &&root._rewriteTileOptions===0&&root._modes.length===1&&root._commonAbilities.length===0&&root._isFixedRotation===1
    &&mode?._combat.m_PathID==='0'&&mode._attack.m_PathID==='0'&&mode._attackTrigger.m_PathID==='0'&&mode._generalAbilities.length===1
    &&passive?._buffs.length===1&&passive._selector.m_PathID==='0'&&buff.templateKey==='trap_magicturn_t'
    &&buff.lifeTimeType===2&&buff.isSilenceable===0&&buff.isStunnable===0&&buff.isFreezable===0
    &&JSON.stringify(buff.attributes.abnormalFlags)==='[5,6]'&&!buff.attributes.attributeModifiers.length&&!buff.blackboard.length
    &&Object.keys(events).sort().join()==='ON_BUFF_FINISH,ON_BUFF_START,ON_ENTER_MAGICCIRCUIT,ON_LEAVE_MAGICCIRCUIT'
    &&start?.length===1&&start[0].$type===type('RegisterMagicCircuitSpAffect')&&start[0]._targetType==='BUFF_OWNER'&&start[0]._isTwoEntriesOnly===true
    &&end?.length===1&&end[0].$type===type('UnregisterMagicCircuitSpAffect')&&end[0]._targetType==='BUFF_OWNER'
    &&enter?.length===1&&enter[0].$type===type('CreateBuff')&&enter[0]._buffOwner==='BUFF_OWNER'&&enter[0]._isDerivedBuff
    &&enter[0]._buff.templateKey==='empty'&&!enter[0]._buff.attributes.attributeModifiers.length&&!enter[0]._buff.attributes.abnormalFlags.length
    &&leave?.length===1&&leave[0].$type===type('FinishDerivedBuff');
}
export function magicCircuitNativeReviewed(e = native) {
  const rows=e.prefabs.trap_062_magicstart?.components.map(c=>c.data) ?? [], root=rows.find(c=>'_modes' in c);
  const mode=rows.find(c=>'_combat' in c), buff=rows.find(c=>c._buffs?.[0]?.templateKey==='trap_magic_circuit_source')?._buffs[0];
  const template=e.templates.trap_magic_circuit_source?.eventToActions;
  const start=template?.ON_BUFF_START, end=template?.ON_BUFF_FINISH;
  return root?._sideType===1 && root._category===2 && root._occupiedRemainingCharacterCnt===0 && root._withdrawable===0
    && root._rewriteTileOptions===0 && root._modes.length===1 && root._commonAbilities.length===0
    && mode?._combat.m_PathID==='0' && mode._attack.m_PathID==='0' && mode._generalAbilities.length===1
    && buff?.lifeTimeType===2 && buff.isSilenceable===0 && buff.isStunnable===0 && buff.isFreezable===0
    && JSON.stringify(buff.attributes.abnormalFlags)==='[5,6]' && buff.attributes.attributeModifiers.length===0
    && start?.length===1 && start[0].$type===type('RegisterMagicCircuitRoute') && start[0]._targetType==='BUFF_OWNER'
    && end?.length===1 && end[0].$type===type('UnregisterMagicCircuitRoute') && end[0]._targetType==='BUFF_OWNER';
}
export function resonatorNativeReviewed(e = native) {
  const rows=e.prefabs.trap_064_magiccircle?.components.map(c=>c.data) ?? [], root=rows.find(c=>'_modes' in c);
  const mode=rows.find(c=>'_combat' in c), buff=rows.find(c=>c._buffs?.[0]?.templateKey==='trap_magiccircle_t')?._buffs[0];
  const events=e.templates.trap_magiccircle_t?.eventToActions, start=events?.ON_BUFF_START, end=events?.ON_BUFF_FINISH;
  const enter=events?.ON_ENTER_MAGICCIRCUIT, leave=events?.ON_LEAVE_MAGICCIRCUIT;
  const skill=e.prefabs.sktok_magiccircle?.components.map(c=>c.data) ?? [], cast=skill.find(c=>'_preDelay' in c);
  const finish=e.templates.trap_magiccircle_skill?.eventToActions.ON_BUFF_START;
  return root?._sideType===1 && root._category===2 && root._occupiedRemainingCharacterCnt===0 && root._withdrawable===0
    && root._rewriteTileOptions===0 && root._modes.length===1 && root._commonAbilities.length===0
    && mode?._combat.m_PathID==='0' && mode._attack.m_PathID==='0' && mode._generalAbilities.length===1
    && buff?.lifeTimeType===2 && buff.isSilenceable===0 && buff.isStunnable===0 && buff.isFreezable===0
    && JSON.stringify(buff.attributes.abnormalFlags)==='[5,6]' && buff.attributes.attributeModifiers.length===0
    && start?.length===5 && start[0].$type===type('SetMagicCircuitLikeObstacleInRange') && start[0]._isLikeObstacle
    && start[0]._rangeId==='0-1' && start[0]._targetType==='BUFF_OWNER'
    && start[1].$type===type('RegisterMagicCircuitSpAffect') && !start[1]._isTwoEntriesOnly && start[1]._targetType==='BUFF_OWNER'
    && start[2].$type===type('CheckCharacterInMagicCircuit') && start[2]._targetType==='BUFF_OWNER' && start[3].$type===type('IfNot')
    && start[4].$type===type('CreateBuff') && JSON.stringify(start[4]._buff.attributes.abnormalFlags)==='["SP_RECOVER_STOPPED"]'
    && end?.length===2 && end[0].$type===type('SetMagicCircuitLikeObstacleInRange') && !end[0]._isLikeObstacle
    && end[0]._rangeId==='0-1' && end[1].$type===type('UnregisterMagicCircuitSpAffect')
    && enter?.length===2 && enter[0].$type===type('FinishDerivedBuff') && enter[1]._buff.templateKey==='empty'
    && leave?.length===2 && leave[0].$type===type('CreateBuff')
    && JSON.stringify(leave[0]._buff.attributes.abnormalFlags)==='["SP_RECOVER_STOPPED"]'
    && leave[1].$type===type('FinishBuffsById') && leave[1]._buffKey==='trap_magiccircle_sprecover[effect]'
    && cast?._preDelay===0 && cast._escapeTime===0 && cast._waitForCasting===0 && cast._passiveBuffs.length===0
    && cast._buffs.length===1 && cast._buffs[0].templateKey==='trap_magiccircle_skill' && cast._buffs[0].isSilenceable===0
    && finish?.length===2 && finish[0].$type===type('Withdraw') && finish[0]._withdrawSource && !finish[0]._switchToDeadState
    && finish[0]._force && finish[1].$type===type('CreateTileEffect');
}
export function magicCircuitDefinition(instance, key='trap_062_magicstart') {
  if(key==='trap_063_magicturn') {
    const record=tables.devices[key];
    if(!fluxReflectorNativeReviewed()||!instance||!Number.isInteger(instance.level)||instance.level<1||instance.level>30
      ||instance.skillLevel!==1||!FLUX_REFLECTOR_PORTS[instance.direction]||record?.skills.length!==0
      ||record.phases[0].attributesKeyFrames.some(f=>f.data.maxHp!==100||f.data.blockCnt!==0))throw Error('Unsupported original Whisperer instance');
    return {kind:'magic-circuit',reflector:true,surfaceOnly:true,passive:true,retreatable:false,hp:100,direction:instance.direction,range:[],
      statusLabel:`Open ${FLUX_REFLECTOR_PORTS[instance.direction].map(d=>d.toLowerCase()).join(' / ')}`,
      description:'Connects the two open ends of its fixed corner. Realigned Flux entering either opening leaves through the other; this device does not emit a beam of its own.'};
  }
  if (key==='trap_064_magiccircle') {
    const record=tables.devices[key], skill=tables.skills.sktok_magiccircle?.levels[0];
    if (!resonatorNativeReviewed() || !instance || !Number.isInteger(instance.level) || instance.level<1 || instance.level>30
      || instance.skillLevel!==1 || record?.skills.length!==1 || record.skills[0].skillId!=='sktok_magiccircle'
      || record.phases[0].attributesKeyFrames.some(f=>f.data.maxHp!==100 || f.data.blockCnt!==0 || f.data.spRecoveryPerSec!==1)
      || skill?.skillType!=='AUTO' || skill.spData.spType!=='INCREASE_WITH_TIME' || skill.spData.initSp!==0
      || skill.spData.spCost!==20 || skill.spData.increment!==1 || skill.blackboard.length) throw Error('Unsupported original Resonator instance');
    return {kind:'magic-circuit',resonator:true,passive:true,retreatable:false,hp:100,spCost:20,range:[],
      description:'Charges at 1 SP/s while reached by Realigned Flux. At 20 SP the device disappears and frees its tile. A targetable ally deployed there emits a new beam.'};
  }
  if(key!=='trap_062_magicstart')throw Error('Unknown Flux device');
  const record=tables.devices.trap_062_magicstart;
  if (!magicCircuitNativeReviewed() || !instance || !Number.isInteger(instance.level) || instance.level<1 || instance.level>30
    || instance.skillLevel!==1 || !['UP','RIGHT','DOWN','LEFT'].includes(instance.direction)
    || record?.skills.length!==0 || record.phases[0].attributesKeyFrames.some(f=>f.data.maxHp!==100 || f.data.blockCnt!==0))
    throw Error('Unsupported original Tuba instance');
  return {kind:'magic-circuit',passive:true,retreatable:false,hp:100,direction:instance.direction,range:[],
    description:'Emits Realigned Flux. Operators on the beam redirect it toward their deployment direction. Connected allies gain the stage’s SP recovery bonus.'};
}
