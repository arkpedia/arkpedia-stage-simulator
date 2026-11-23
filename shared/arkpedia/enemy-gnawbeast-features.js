// SPDX-License-Identifier: GPL-3.0-or-later
import {nativeBuffProgram,nativeBuffProgramSupported} from './native-buff-programs.js';
import {isVesperwing,VESPERWING_BLOODHIT} from './enemy-holy-escort-features.js';
import clocks from '../../data/arkpedia-gnawbeasts-animations.json' with {type:'json'};
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
const ids=['enemy_1335_bldrat','enemy_1335_bldrat_2'];
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
const action=(name,fields={})=>({$type:`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`,...fields});
export const isGnawbeast=r=>ids.includes(r.prefabKey);
function bleedTemplates(n){
  const actions=n.$template('bldrat_t_1[blood]')?.eventToActions;
  if(!actions||Object.keys(actions).join()!=='ON_AFTER_OUTPUT_DAMAGE'||actions.ON_AFTER_OUTPUT_DAMAGE.length!==4)return false;
  const [silence,profession,invert,create]=actions.ON_AFTER_OUTPUT_DAMAGE,buff=create?._buff;
  return same(silence,action('CheckAbnormalFlag',{_abnormalFlag:'SILENCED',_targetType:'BUFF_OWNER',_isUnset:true}))
    &&same(profession,action('CheckTargetProfession',{_targetType:'MODIFIER_TARGET',_profession:['TOKEN, TRAP'],
      _readProfessionFromBlackboard:false,_checkSubProfession:false,_subProfessions:null}))
    &&same(invert,action('IfNot'))
    &&fields(create,{$type:action('CreateBuff').$type,_buffOwner:'MODIFIER_TARGET',_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false})
    &&empty(buff?.attributes)&&fields(buff,{buffKey:'blood_dec',templateKey:'blood_dec',loadFromDB:false,isDurableBuff:false,
      isDamageMissable:false,isSilenceable:false,isStunnable:false,isFreezable:false,isLevitatable:false,statusResistable:'AUTOMATIC',
      disableOverride:false,overrideKey:null,overrideType:'EXTEND',maxStackCnt:1,refreshRemainingTimeWhenStackMax:false,
      clearAllStackCntWhenTimeUp:false,maxValidStackCnt:-1,independentCharacterSource:false,lifeTimeType:'LIMITED',
      durationKey:'blood_duration',lifeTime:Math.fround(4.15),triggerLifeType:'INFINITY',triggerCnt:5,triggerInterval:1,
      waitFirstTriggerInterval:true,firstTriggerInterval:Math.fround(.1),blackboard:[]})
    &&same(n.$template('blood_dec')?.eventToActions,{ON_BUFF_TRIGGER:[action('FixedValueDamage',{
      _damageType:'PURE',_damageKey:'blood_value',_ignoreForSp:true,_attackType:'NORMAL',_skipModifierEvent:true,
      _considerUnhurtable:false,_noSourceDamage:false,_targetType:'TARGET',_assignRealDamageToBB:false,_multiplierByKey:false,
      _multiplierKey:'cnt',_damageTargetType:'TARGET',_triggerOnCalculateDamage:false,_isEnvDamage:false,
      _ignoreCancelReasonMask:'NONE',_forceDisplayDamageNum:false})]});
}
export function gnawbeastNative(r,n){
  if(!isGnawbeast(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'
    ||!same(r.talents,{bb:{},bbStr:{},groups:{}})||r.skills.length!==1
    ||!same(r.abilities,[{text:'Inflicts Bleed on allied Operators after several attacks',format:'SILENCE'}])
    ||!same(r.sp,{type:'INCREASE_WHEN_ATTACK',maxSp:1,initSp:0,increment:1}))return false;
  const skill=r.skills[0];
  if(!fields(skill,{prefabKey:'BloodHit',priority:0,cooldown:0,initCooldown:0,spCost:1,bbStr:{},
    bb:{blood_value:r.prefabKey.endsWith('_2')?30:20,blood_duration:5}}))return false;
  const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]);
  if(root?._modes.length!==1||root._commonAbilities?.length!==0||root._blockVolume!==1||root._delayToBorn!==0
    ||root._sideTypeIndex!==1||root._idleWhenBorn!==0||root._canNotExit!==0
    ||!mode||mode._generalAbilities?.length!==0||!zero(mode._attack)||!zero(mode._attackTrigger))return false;
  const ordinary=n.$ref(mode._combat),rows=n.BloodHit??[],charged=rows.find(c=>'_damageType'in c);
  const melee={m_Script:{m_FileID:1,m_PathID:'4381884627089348317'},_damageType:1,_atkScale:1,_atkScaleKey:'atk_scale',_attackType:1,
    _elementDamageType:0,_epDamageRatio:0,_extraDamageType:0,_activeBuffs:[],_animKey:'Attack',_endAnimKey:'Idle',
    _waitForAttackEvent:1,_selectTargetSource:2,_selectTargetTiming:0,_alwaysIncludeTarget:1,_allowNoTarget:0,
    _preDelay:0,_timeMode:0,_affectedBySlowDown:1,_useDynamicAttackType:0};
  if(!fields(ordinary,melee)||!fields(charged,melee))return false;
  const wrapper=rows.find(c=>'_familyMask'in c),payload=n.$siblings(charged).find(c=>c.m_Script?.m_PathID==='1339719624887862345');
  const buff=payload?._buffs?.[0];
  if(!fields(wrapper,{_familyMask:2,_maxTriggerTime:-1,_resetMainAbilityCdWhenCastEnd:0,_resetCdWaitFirstPeriod:1,
      _overwriteInitCooldown:-1,_ignoreSilence:1,_castLikeAttack:0})||!zero(wrapper._trigger)
    ||payload?._buffs?.length!==1||!empty(buff?.attributes)||!fields(buff,{buffKey:'bldrat_t_1[blood]',
      templateKey:'bldrat_t_1[blood]',loadFromDB:0,lifeTimeType:2,isSilenceable:0,isStunnable:0,isFreezable:0,
      isLevitatable:0,isGroundBoundable:0,statusResistable:2,overrideType:0,maxStackCnt:1,blackboard:[]}))return false;
  const animator=n.$ref(root._animator),clock=clocks.enemies[r.prefabKey];
  return animator?._animations.some(a=>a.animKey==='Attack'&&a.animName==='Attack'&&a.speed===1&&!a.loop)
    &&n.$ref(animator._skeleton)?.skeletonDataAsset.m_PathID===clock.source.skeletonDataPathId
    &&clock.durations.Attack===Math.fround(31/30)
    &&same(clock.events.Attack,[{time:Math.fround(13/30),name:'OnAttack',int:0,float:0,string:''}])&&bleedTemplates(n)&&nativeBuffProgramSupported('bldrat_t_1[blood]',n);
}
// The Vesperwings share BloodHit and its Bleed line: they dispatch to their own contract (enemy-holy-escort-features.js).
const feature={matchesRecord:r=>isGnawbeast(r)||isVesperwing(r),covers:(r,n)=>isVesperwing(r)?VESPERWING_BLOODHIT.covers(r,n):gnawbeastNative(r,n),
  explains:(text,r)=>isVesperwing(r)&&VESPERWING_BLOODHIT.explains(text,r)};
export const GNAWBEAST_FEATURES={
  'ability:Inflicts Bleed on allied Operators after several attacks':feature,
  'skill:BloodHit':{...feature,nativeClaim:()=>({wrappers:1}),ability:r=>isVesperwing(r)?VESPERWING_BLOODHIT.ability(r):({kind:'chargedMeleeBuffProgram',params:r=>({
    initialSp:r.sp.initSp,maxSp:r.sp.maxSp,increment:r.sp.increment,cost:r.skills[0].spCost,
    program:nativeBuffProgram('bldrat_t_1[blood]'),blackboard:{...r.skills[0].bb},silenceBlocksSpend:false,
    attackAnim:{dur:clocks.enemies[r.prefabKey].durations.Attack,hit:clocks.enemies[r.prefabKey].events.Attack[0].time}})})},
};
