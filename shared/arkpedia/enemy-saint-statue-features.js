// SPDX-License-Identifier: GPL-3.0-or-later
import {nativeAuxiliaryReferences} from './enemy-native-auxiliaries.js';
import clocks from '../../data/arkpedia-saint-statues-animations.json' with {type:'json'};
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
const ids=['enemy_10091_hlsttu','enemy_10091_hlsttu_2','enemy_10091_hlsttu_3'];
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const node=(v,name)=>v?.$type===`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
const cosmetics=new Set(['hlsttu_t[full_effect]','hlsttu_t[not_full_effect]']);
function visualTree(v){
 if(Array.isArray(v))return v.every(visualTree);
 if(!v||typeof v!=='object')return true;
 if(v.$type){
  const type=v.$type.split('+')[1]?.split(',')[0];
  if(!['IfElse','FilterByBlackboardValue','FinishBuffsById','AlwaysNext','CheckContainsBuff','IfNot','CreateBuff'].includes(type))return false;
  if(type==='CreateBuff'&&(!cosmetics.has(v._buff?.buffKey)||v._buff.templateKey!=='empty'||!empty(v._buff.attributes)
    ||v._buff.blackboard.length||!v._isDerivedBuff||!v._finishDerivedBuffIfParentFinish))return false;
  if(type==='FinishBuffsById'&&(!cosmetics.has(v._buffKey)||v._finishHostBuff))return false;
  if(type==='CheckContainsBuff'&&!v._buffKeys?.every(key=>cosmetics.has(key)))return false;
 }
 return Object.values(v).every(visualTree);
}
function calculate(v,input,output,multiply=null,add=null,max=null){
 return node(v,'CalculateBlackboardValueViaParams')&&fields(v,{_inputKey:input,_outputKey:output,_multiplyParamKey:multiply,
  _dividedParamKey:null,_addParamKey:add,_minusParamKey:null,_minValueKey:null,_maxValueKey:max,
  _finalAbs:true,_finalCeil:false,_finalFloor:false,_finalRound:false,_useAbilityBlackboard:false,_abilityName:''});
}
function shieldTemplates(n){
 const pulse=n.$template('hlsttu_t[trigger_shield]')?.eventToActions;
 const area=pulse?.ON_BUFF_TRIGGER?.[0],to=area?._buffs?.[0];
 if(!same(Object.keys(pulse??{}),['ON_BUFF_TRIGGER'])||pulse.ON_BUFF_TRIGGER.length!==1||!node(area,'CreateBuffInRange')
  ||!fields(area,{_sourceType:'BUFF_SOURCE',_targetType:'BUFF_OWNER',_excludeTarget:false,_randomTarget:false,_limitMaxTarget:false,
   _useAttackRange:false,_useCurrentModeRange:false,_useRangeToShow:false,_useTargetRangeInsteadOfSource:false,_useRadius:true,
   _useGlobalRange:false,_radius:0,_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false})
  ||!fields(area._targetOptions,{targetSide:'ALLY',targetMotion:'ALL',targetCategory:'DEFAULT',ignoreTargetFree:true,
   ignoreAllyTargetFree:true,ignoreTargetSide:false,excludeSomeAbnormalFlags:false})
  ||area._buffs.length!==1||!fields(to,{buffKey:'hlsttu_t[to_enemy]',templateKey:'hlsttu_t[to_enemy]',lifeTimeType:'IMMEDIATELY'})||!empty(to.attributes))return false;
 const events=n.$template('hlsttu_t[to_enemy]')?.eventToActions,a=events?.ON_BUFF_START;
 if(!same(Object.keys(events??{}),['ON_BUFF_START'])||a?.length!==11
  ||!node(a[0],'CheckContainsBuff')||!fields(a[0],{_buffKeys:['enemy_hlsttu_self_mark','enemy_hlslp_self_mark'],isAND:false,_targetType:'BUFF_OWNER'})
  ||!node(a[1],'IfNot')||!node(a[2],'CheckUnitAlive')||a[2]._ownerType!=='BUFF_OWNER'||!node(a[3],'IfElse')
  ||!node(a[3]._conditionNode,'CheckContainsBuff')||!same(a[3]._conditionNode._buffKeys,['hlsttu_t[shield]'])||a[3]._succeedNodes!==null
  ||a[3]._failNodes?.length!==1||!node(a[3]._failNodes[0],'CreateBuff'))return false;
 const create=a[3]._failNodes[0],buff=create._buff;
 if(!fields(create,{_buffOwner:'BUFF_OWNER',_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false})
  ||!fields(buff,{buffKey:'hlsttu_t[shield]',templateKey:'hlsttu_t[shield]',lifeTimeType:'INFINITY',independentCharacterSource:false,
   overrideType:'DEFAULT',blackboard:[{key:'dynamic',value:0,valueStr:''}]})||!empty(buff.attributes)
  ||!node(a[4],'AssignAttributeToBB')||!fields(a[4],{_attributeType:'MAX_HP',_targetType:'BUFF_OWNER',_blackboardKey:'max_hp'})
  ||!calculate(a[5],'max_hp','limited_dynamic','shield_max_rate')||!calculate(a[6],'max_hp','add_dynamic','shield_add_rate')
  ||!node(a[7],'AssignBuffBlackboardFromOthers')||!fields(a[7],{_blackboardKey:'dynamic',_valueKey:'dynamic',_buffKey:'hlsttu_t[shield]',_filterBuffSource:false})
  ||!node(a[8],'FilterByBlackboardValue')||!fields(a[8],{_blackboardKey:'dynamic',_anotherKeyToCompare:'limited_dynamic',_condType:'LT'})
  ||!calculate(a[9],'dynamic','dynamic',null,'add_dynamic','limited_dynamic')
  ||!node(a[10],'AssignBuffBlackboard')||!fields(a[10],{_blackboardKey:'dynamic',_valueKey:'dynamic',_buffKey:'hlsttu_t[shield]'}))return false;
 const shield=n.$template('hlsttu_t[shield]')?.eventToActions,damage=shield?.ON_TAKE_DAMAGE,visual=shield?.ON_BUFF_TRIGGER;
 return same(Object.keys(shield??{}).sort(),['ON_BUFF_TRIGGER','ON_TAKE_DAMAGE'])&&damage?.length===3
  &&node(damage[0],'BlockDamage')&&fields(damage[0],{_filterDamageType:true,_damageMask:'PHYSICAL_AND_MAGICAL',_useDynamicVar:true,
   _allowNegativeDynamicVar:false,_useFixedValue:false,_filterApplyWay:false})
  &&node(damage[1],'IsBlackboardZero')&&damage[1]._var==='dynamic'&&node(damage[2],'FinishBuff')
  &&visual?.length===3&&node(visual[0],'AssignAttributeToBB')&&visual[0]._attributeType==='MAX_HP'
  &&calculate(visual[1],'max_hp','compare_limited_dynamic','shield_max_rate')&&visualTree(visual[2]);
}
export const isSaintStatue=r=>ids.includes(r.prefabKey);
export function saintStatueNative(r,n){
 const matriarch=r.prefabKey==='enemy_10091_hlsttu_3';
 if(!isSaintStatue(r)||r.level!==0||r.applyWay!=='RANGED'||r.stats.dmgType!=='arts'||r.stats.motion!=='WALK'||!r.notCountInTotal
  ||r.skills.length||r.sp||!same(r.talents.groups,{CircleShield:['interval','range_radius','shield_add_rate','shield_max_rate'],...(matriarch?{AttackTargetNum:['attack@max_target']}:{})})
  ||!same(r.talents.bb,{'CircleShield.interval':1,'CircleShield.range_radius':matriarch?3.5:2.5,'CircleShield.shield_max_rate':matriarch?1.5:.5,'CircleShield.shield_add_rate':matriarch ? .06 : .02,...(matriarch?{'AttackTargetNum.attack@max_target':3}:{})})
  ||Object.keys(r.talents.bbStr).length)return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]),attack=n.$ref(mode?._attack),passive=n.$ref(root?._commonAbilities[0]);
 if(!root||root._modes.length!==1||root._commonAbilities.length!==(matriarch?2:1)||root._sideTypeIndex!==1||root._delayToBorn!==0
  ||mode?._generalAbilities.length!==1||!zero(mode._combat)||!fields(attack,{_projectileKey:'projectile_enemy_hlsttu',_damageType:2,
   _atkScale:1,_activeBuffs:[],_waitForAttackEvent:matriarch?1:0,_preDelay:0,_timeMode:0,_projectileDestination:0})
  ||!fields(n.$ref(mode._attackTrigger),{m_Script:{m_FileID:1,m_PathID:'8607874384982393801'},_minTargetNum:1,_keepTarget:0}))return false;
 if([...root._modes,...root._commonAbilities,...mode._generalAbilities,mode._attack,mode._attackTrigger,root._animator].some(ref=>ref.m_FileID!==0))return false;
 if(nativeAuxiliaryReferences(mode._generalAbilities,n).active!==1
  ||nativeAuxiliaryReferences(root._commonAbilities.slice(1),n).active!==(matriarch?1:0))return false;
 if(matriarch&&!statueAttackTargetCount(n,attack))return false;
 const body=passive?._buffs?.[0],mark=passive?._buffs?.[1];
 if(passive?._buffs.length!==2||!fields(body,{templateKey:'empty',lifeTimeType:2,isSilenceable:0,isStunnable:0,isFreezable:0})
  ||!same(body.attributes,{abnormalFlags:[22],abnormalImmunes:[0,33,25,11,31],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[0],attributeModifiers:[]})
  ||!fields(mark,{buffKey:'enemy_hlsttu_self_mark',templateKey:'empty',lifeTimeType:2})||!empty(mark.attributes))return false;
 const aura=n.CircleShield?.find(c=>'_buffs'in c),buff=aura?._buffs[0];
 if(aura?._buffs.length!==1||!fields(buff,{buffKey:'hlsttu_t[trigger_shield]',templateKey:'hlsttu_t[trigger_shield]',lifeTimeType:2,
  triggerLifeType:2,waitFirstTriggerInterval:1,isSilenceable:0,isStunnable:0,isFreezable:0})||!empty(buff.attributes)||!shieldTemplates(n))return false;
 const graphic=n.$ref(root._animator),clock=clocks.enemies[r.prefabKey];
 if(n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID!==clock.source.skeletonDataPathId)return false;
 if(matriarch&&(!same(clock.events.Attack,[{time:Math.fround(25/30),name:'OnAttack',int:0,float:0,string:''}])
  ||clock.durations.Attack!==Math.fround(48/30)
  ||!graphic._animations.some(a=>a.animKey==='Attack'&&a.animName==='Attack'&&a.speed===1&&!a.loop)))return false;
 const p=n.$projectile('projectile_enemy_hlsttu'),life=p.find(c=>'_lifeTime'in c),move=p.find(c=>'_moveType'in c);
 return p.length===3&&p.every(c=>['-8797129986015012478','-1429203677512073985','6834194400804168919'].includes(c.m_Script?.m_PathID))
  &&fields(life?._actionController,{_addExtraBuffsWhenReached:0,_extraBuffsInTheEnd:[],_useSelfBlackboard:0,_onlyAddBuffsToTraceTarget:0})
  &&fields(life,{_lifeTime:10,_stopWhenSourceInvalid:0,_maxHitNum:1,_stopAfterMaxHit:1,_alwaysHitTraceTargetInTheEnd:1})
  &&fields(move,{_moveType:1,_speed:10,_delayToStart:0,_flyToTargetLocationOnly:0,_forceReachedWhenTimeup:1});
}
// Native target count is a talent-fed override of this attack selector,
// rather than a second attack loop or three repeated hits on one operator.
function statueAttackTargetCount(n,attack){
 const target=n.AttackTargetNum?.find(c=>c.m_Script?.m_PathID==='4865767822664548221'),binding=n.$siblings(target).find(c=>'_overwriteTalentKey'in c);
 const selector=n.$ref(attack._selector);
 return fields(target,{m_Enabled:1,_selector:{m_FileID:0,m_PathID:'0'},_interruptAbilityOnDetach:1})
  &&fields(binding,{m_Script:{m_FileID:1,m_PathID:'-2726233351382997147'},m_Enabled:1,_attachInDummy:0,_overwriteTalentKey:'',_defaultModeIndex:-1,_attackBlackboardModeIndex:-1,
   _extraAttackBlackboardModeIndices:[],_checkValidBySkillIndex:[],_applyTalentScale:0,_applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0,_influenceSkillBlackboard:0,
   _fromRawDataToSkill:0,_applyTalentRange:0,_scaleCertainKeyFlag:0,_scaleCertainKeyList:[],_scaleModeIndices:[]})
  &&fields(selector,{m_Script:{m_FileID:1,m_PathID:'7080728813803358465'},_targetSide:2,_targetMotion:1,_targetCategory:1,
   _postFilter:4,_ignoreTargetFree:0,_ignoreAllyTargetFree:0,_forceIgnoreCamouflage:0,_limitTargetNum:1,
   _maxTargetKey:'max_target',_maxNum:1,_excludeOwner:0,_needProfessionMask:0,_ignoreHitRange:0});
}
const feature={matchesRecord:isSaintStatue,covers:saintStatueNative};
export const SAINT_STATUE_FEATURES={
 'talent:AttackTargetNum':{matchesRecord:r=>r.prefabKey==='enemy_10091_hlsttu_3',covers:saintStatueNative,
  explains:text=>text==='Attacks 3 enemies simultaneously',trait:{maxTargets:3}},
 'talent:CircleShield':{...feature,explains:/^Enemies within range gain a Barrier proportionate to their Max HP every second \(capped(?: with a higher limit)?\)$/,
  ability:{kind:'rechargingBarrierAura',params:r=>({key:'hlsttu_t[shield]',interval:r.talents.bb['CircleShield.interval'],radius:r.talents.bb['CircleShield.range_radius'],
   addRate:r.talents.bb['CircleShield.shield_add_rate'],maxRate:r.talents.bb['CircleShield.shield_max_rate'],
   excludedBuffs:['enemy_hlsttu_self_mark','enemy_hlslp_self_mark'],types:['phys','arts'],ignoreTargetFree:true,ignoreAllyTargetFree:true})}},
 // This explicit mixed review owns Passive plus the exact mode-local cosmetic
 // Effect classified above. The global counter must not add that Effect again.
 'native:saintBody':{...feature,nativeClaim:(_p,n)=>({active:n.enemy_10091_hlsttu_3?3:2}),trait:{flags:{noMove:true}},ability:{kind:'passiveEnemyBody',params:r=>({
  immunities:['stun','fear','levitate','disarm','sleep'],markerKeys:['enemy_hlsttu_self_mark'],attackAnim:{dur:clocks.enemies[r.prefabKey].durations.Attack,hit:r.prefabKey==='enemy_10091_hlsttu_3'?clocks.enemies[r.prefabKey].events.Attack[0].time:0}})}},
 'native:saintAttack':{...feature,ability:r=>({kind:r.prefabKey==='enemy_10091_hlsttu_3'?'animatedProjectileAttack':'projectileSingleAttack',
  params:()=>({type:'arts',speed:10,lifetime:10,...(r.prefabKey==='enemy_10091_hlsttu_3'?{animation:{clip:'Attack',
   duration:clocks.enemies[r.prefabKey].durations.Attack,releases:clocks.enemies[r.prefabKey].events.Attack.map(e=>e.time)}}:{})})})},
};
