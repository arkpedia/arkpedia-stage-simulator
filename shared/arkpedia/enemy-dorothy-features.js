// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-dorothy-enemy-animations.json' with {type:'json'};
import {sameOutcomeValue as same,emptyOutcomeAttributes} from './enemy-outcome-contracts.js';
const id='enemy_1257_lydrty',isDorothy=r=>r.key===id&&r.prefabKey===id;
const fields=(value,expected)=>!!value&&Object.entries(expected).every(([k,v])=>same(value[k],v));
const node=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
export function dorothyEnemyNative(r,n){
  if(!isDorothy(r)||r.skills.length!==1||r.applyWay!=='RANGED'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'
    ||r.sp||!same(r.talents,{bb:{},bbStr:{},groups:{}}))return false;
  const s=r.skills[0],root=n[id]?.[0],mode=n.$ref(root?._modes?.[0]),attack=n.$ref(mode?._attack);
  const cast=n.PlaceTrap?.find(c=>'_projectileKey'in c),wrapper=n.PlaceTrap?.find(c=>'_familyMask'in c),selector=n.$ref(cast?._selector);
  const clock=clocks.enemies[id],graphic=n.$ref(root?._animator);
  if(s.prefabKey!=='PlaceTrap'||s.priority!==1||s.cooldown!==5||s.initCooldown!==0||s.spCost!==0
    ||!same(s.bb,{stun:10,max_stack_cnt:50,atk:.1,atk_scale:1.5,projectile_delay_time:999,range_radius:.3})||Object.keys(s.bbStr).length
    ||root?._modes.length!==1||root._commonAbilities.length||mode?._generalAbilities.length
    ||!fields(wrapper,{_familyMask:3,_ignoreSilence:0,_maxTriggerTime:-1,_resetCdWaitFirstPeriod:1})
    ||!fields(n.$ref(wrapper._trigger),{_minTileNum:1})
    ||!fields(attack,{_projectileKey:'projectile_enemy_lydrty',_damageType:1,_atkScale:1,_activeBuffs:[],_waitForAttackEvent:1,
      _timeMode:0,_animKey:'Attack',_extraProjectileKeys:[]})
    ||n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID!==clock.source.skeletonDataPathId
    ||!graphic._animations.some(a=>a.animKey==='Skill'&&a.animName==='F_Skill'&&a.speed===1)
    ||!same(clock.events.F_Skill?.map(e=>[e.name,e.time]),[['OnAttack',Math.fround(19/30)]])
    ||!same(clock.events.F_Attack?.map(e=>[e.name,e.time]),[['OnAttack',Math.fround(19/30)]])
    ||clock.durations.F_Skill!==2||clock.durations.F_Attack!==2)return false;
  if(!fields(cast,{_projectileKey:'projectile_enemy_lydrty_2',_timeMode:1,_animKey:'Skill',_waitForAttackEvent:1,_atkScale:1,
    _damageType:2,_attackType:1,_selectTargetSource:1,_selectTargetTiming:0,_preDelay:0,_affectedBySlowDown:1,
    _waitForProjectileInvalid:0,_useCachedAtkOnly:0,_transferSource:0})||cast._activeBuffs.length!==2
    ||!fields(selector,{_filterType:13,_excludeAllCharacter:0,_ignoreBlackList:0,_excludeOwnerRootTile:0,_ignoreHitRange:0,
      _targetCategory:1,_targetMotion:1,_targetSide:2,_limitTargetNum:1,_maxNum:1,_extraFilterTypeList:[]})
    ||!fields(selector._options,{buildableType:1,allowNoneBuildableType:0,checkBuildableOrPassable:0,advancedBuildableMask:1,
      allowAllAdvancedBuildableMask:0,advancedBuildableMaskExcept:0,checkExtraBuildableCheckers:0}))return false;
  const [gain,stun]=cast._activeBuffs;
  if(!fields(gain,{templateKey:'enemy_lydrty[buff_to_source]',loadFromDB:0,lifeTimeType:0,blackboard:[],isDamageMissable:0})
    ||!emptyOutcomeAttributes(gain.attributes)||!fields(stun,{buffKey:'stun',loadFromDB:1,lifeTimeType:1,blackboard:[],isDamageMissable:0}))return false;
  const actions=n.$template(gain.templateKey)?.eventToActions.ON_BUFF_START,create=actions?.[0],buff=create?._buff;
  if(actions?.length!==2||!fields(create,{$type:node('CreateBuff'),_buffOwner:'BUFF_SOURCE',_isDerivedBuff:false})
    ||!fields(buff,{buffKey:'lydrty[atk_up]',templateKey:'empty',overrideType:'STACK',lifeTimeType:'INFINITY',isSilenceable:false})
    ||!same(buff.attributes.attributeModifiers,[{attributeType:'ATK',formulaItem:'MULTIPLIER',value:0,loadFromBlackboard:true,fetchBaseValueFromSourceEntity:false}])
    ||!emptyOutcomeAttributes({...buff.attributes,attributeModifiers:[]})
    ||!fields(actions[1]._conditionNode,{$type:node('FilterByBuffStackCount'),_targetType:'BUFF_SOURCE',_buffKey:'lydrty[atk_up]',_stackCountKey:'max_stack_cnt'}))return false;
  const shot=n.$projectile('projectile_enemy_lydrty'),mine=n.$projectile('projectile_enemy_lydrty_2');
  const motion=shot.find(c=>'_speed'in c),life=shot.find(c=>'_lifeTime'in c),trigger=mine.find(c=>'_forceHit'in c),dwell=mine.find(c=>'_delayTime'in c),body=mine.find(c=>'_lifeTime'in c);
  const target=n.$projectileRef('projectile_enemy_lydrty_2',trigger?._selector);
  return fields(motion,{_speed:10,_moveType:1,_delayToStart:0})&&fields(life,{_lifeTime:10,_stopWhenSourceInvalid:0,_maxHitNum:1})
    &&fields(body,{_lifeTime:1,_managedBySource:0,_stopWhenSourceInvalid:0,_maxHitNum:1,_stopAfterMaxHit:1})
    &&fields(body._actionController,{_dontAddBuffs:0,_extraBuffsInTheEnd:[],_detachAllBuffsWhenStopped:0})
    &&fields(dwell,{_delayToStart:.5,_delayTime:0,_delayAfterReached:1,_followTarget:0,_stopIfTargetDead:0,_stopIfTargetDisappeared:0})
    &&fields(trigger,{_interval:Math.fround(.2),_waitFirstPeriod:0,_forceHit:1,_hitPasserby:0})
    &&fields(target,{_targetSide:2,_targetMotion:1,_targetCategory:1,_postFilter:4,_maxNum:1,_limitTargetNum:1,_ignoreTargetFree:0})
    &&mine.some(c=>fields(c,{_rangeId:'0-1',_extendable:0,_useBlackboardRangeId:0}))
    &&same(n.$range('0-1'),{id:'0-1',direction:1,grids:[{row:0,col:0}]});
}
export const DOROTHY_ENEMY_FEATURES={
  'skill:PlaceTrap':{matchesRecord:isDorothy,covers:dorothyEnemyNative,nativeClaim:()=>({wrappers:1}),
    explains:/^Can deploy traps\. Allies who step on them will receive Arts damage and be <\$ba.stun>Stunned<\/> for some time$/,
    ability:{kind:'dorothyTraps',params:r=>{
      const s=r.skills[0],c=clocks.enemies[id];return{initial:s.initCooldown,cooldown:s.cooldown,radius:s.bb.range_radius,
        lifetime:s.bb.projectile_delay_time,scale:s.bb.atk_scale,stun:s.bb.stun,atk:s.bb.atk,maxStacks:s.bb.max_stack_cnt,
        skillClip:'F_Skill',duration:c.durations.F_Skill,release:c.events.F_Skill[0].time,armDelay:.5,interval:Math.fround(.2),
        speed:10,shotLifetime:10,attackAnim:{dur:c.durations.F_Attack,hit:c.events.F_Attack[0].time}};}},
    note:'Source tile selector, persistent single-target trap, bounded ATK stacks and normal projectile transport; original effect rendering remains separate.'},
};
