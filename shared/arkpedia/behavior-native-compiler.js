// SPDX-License-Identifier: GPL-3.0-or-later
// Build-time only. Native source fields are deliberately stricter than the
// portable runtime graph; adding a node never implicitly admits an enemy.
import {compileBuffTemplate,actionName} from './behavior.js';
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
import {prepareBehaviorProgram} from './behavior-program.js';
const type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
function fail(label){throw Error(`Unsupported native behaviour: ${label}`);}
function exact(v,w,label){if(!v||Object.keys(v).sort().join()!==Object.keys(w).sort().join()||Object.entries(w).some(([k,x])=>!same(v[k],x)))fail(label);}
function text(v){if(typeof v!=='string'||!v||v.length>256)fail('key');return v;}
const binding=v=>{const b={BUFF_OWNER:'owner',BUFF_SOURCE:'source',MODIFIER_TARGET:'target'}[v];if(!b)fail('binding');return b;};
const finite=(v,min)=>{if(!Number.isFinite(v)||v<min)fail('number');return v;};
const emptyAttributes={abnormalFlags:[],abnormalImmunes:[],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:[]};
export function compileNativeBuffProgram(entry,templateFor){
  const templates=Object.create(null),visiting=new Set();let budget=0;
  const predicate=node=>{
    if(++budget>1024)fail('node budget');
    switch(actionName(node)){
      case 'CheckContainsBuff':{
        if(!Array.isArray(node._buffKeys)||!node._buffKeys.length||node._buffKeys.length>64||typeof node.isAND!=='boolean')fail('buff keys');node._buffKeys.forEach(text);
        exact(node,{$type:type('CheckContainsBuff'),_targetType:node._targetType,_buffKeys:node._buffKeys,isAND:node.isAND,
          _loadFromBlackboard:false,_checkBuffSource:false,_buffSourceType:'BUFF_SOURCE',_checkSourceHost:false},'contains buff');
        return{op:'buff',who:binding(node._targetType),keys:[...node._buffKeys],all:node.isAND};
      }
      case 'CheckAbnormalFlag':
        if(typeof node._isUnset!=='boolean')fail('silence');
        exact(node,{$type:type('CheckAbnormalFlag'),_abnormalFlag:'SILENCED',_targetType:node._targetType,_isUnset:node._isUnset},'abnormal flag');
        return{op:'silenced',who:binding(node._targetType),unset:node._isUnset};
      case 'CheckRootTileAdvBuildableMask':
        exact(node,{$type:type('CheckRootTileAdvBuildableMask'),_ownerType:'BUFF_OWNER',_buildableMask:'NIGHT'},'night condition');
        return{op:'environmentMask',who:'owner',mask:8};
      case 'CheckUnitCurrentMode':
        if(!Number.isSafeInteger(node._checkCurModeIndex)||node._checkCurModeIndex<0||node._checkCurModeIndex>63)fail('mode index');
        exact(node,{$type:type('CheckUnitCurrentMode'),_targetType:node._targetType,_checkCurModeIndex:node._checkCurModeIndex,_loadCurModeBbKey:''},'current mode');
        return{op:'mode',who:binding(node._targetType),index:node._checkCurModeIndex};
      case 'CheckTargetProfession':{
        if(!Array.isArray(node._profession)||!node._profession.length||node._profession.some(x=>typeof x!=='string'))fail('profession');
        exact(node,{$type:type('CheckTargetProfession'),_targetType:node._targetType,_profession:node._profession,
          _readProfessionFromBlackboard:false,_checkSubProfession:false,_subProfessions:null},'profession');
        return{op:'profession',who:binding(node._targetType),values:[...new Set(node._profession.flatMap(x=>x.split(',').map(s=>s.trim())))]};
      }
      default:fail(`predicate ${actionName(node)}`);
    }
  };
  const childBuff=(buff,depth)=>{
    if(!buff)fail('child buff');
    const immediate=buff.lifeTimeType==='IMMEDIATELY';
    if(!immediate&&buff.lifeTimeType!=='LIMITED')fail('lifetime');
    if(immediate){if(buff.overrideType!=='DEFAULT')fail('immediate override');}
    else if(buff.overrideType!=='EXTEND')fail('limited override');
    if(buff.overrideEffectKey!==null&&typeof buff.overrideEffectKey!=='string')fail('effect key');
    exact(buff,{attributes:emptyAttributes,buffKey:buff.buffKey,loadFromDB:false,isDurableBuff:false,isDamageMissable:false,
      isSilenceable:false,isStunnable:false,isFreezable:false,isLevitatable:false,statusResistable:'AUTOMATIC',
      templateKey:buff.templateKey,disableOverride:false,overrideKey:null,overrideType:immediate?'DEFAULT':'EXTEND',maxStackCnt:1,
      refreshRemainingTimeWhenStackMax:false,clearAllStackCntWhenTimeUp:false,maxValidStackCnt:-1,independentCharacterSource:false,
      overrideEffectKey:buff.overrideEffectKey,overrideOnEventPriority:false,onEventPriority:'DEFAULT',audioSignal:null,
      lifeTimeType:immediate?'IMMEDIATELY':'LIMITED',takeSnapshotWhenExtend:false,durationKey:immediate?null:buff.durationKey,
      lifeTime:immediate?0:buff.lifeTime,triggerLifeType:immediate?'IMMEDIATELY':'INFINITY',triggerCnt:immediate?0:buff.triggerCnt,
      triggerInterval:immediate?-1:buff.triggerInterval,waitFirstTriggerInterval:true,firstTriggerInterval:immediate?-1:buff.firstTriggerInterval,
      priority:-1,priorityBBKeys:[],stripBlackboardParamsWithBuffKey:false,blackboard:[]},'child buff fields');
    text(buff.buffKey);text(buff.templateKey);
    if(!immediate){text(buff.durationKey);finite(buff.lifeTime,Number.MIN_VALUE);finite(buff.triggerInterval,Number.MIN_VALUE);
      finite(buff.firstTriggerInterval,0);if(buff.firstTriggerInterval>buff.triggerInterval||!Number.isSafeInteger(buff.triggerCnt)||buff.triggerCnt<0)fail('clock');}
    compile(buff.templateKey,depth+1);
    return{key:buff.buffKey,template:buff.templateKey,clock:immediate?null:{duration:buff.durationKey,interval:buff.triggerInterval,firstDelay:buff.firstTriggerInterval}};
  };
  const sequence=(nodes,depth)=>{
    if(nodes===null)return[];
    if(!Array.isArray(nodes)||depth>16)fail('node list/depth');
    const guards=[],actions=[];let actionSeen=false;
    for(const node of nodes){
      if(++budget>1024)fail('node budget');const name=actionName(node);
      if(['CheckContainsBuff','CheckAbnormalFlag','CheckTargetProfession','CheckRootTileAdvBuildableMask','CheckUnitCurrentMode'].includes(name)){
        if(actionSeen)fail('predicate after effect');guards.push(predicate(node));continue;
      }
      if(name==='IfNot'){
        exact(node,{$type:type('IfNot')},'IfNot');if(actionSeen||!guards.length)fail('unbound IfNot');
        guards.push({op:'not',value:guards.pop()});continue;
      }
      actionSeen=true;
      if(name==='IfElse'){
        exact(node,{$type:type(name),_conditionNode:node._conditionNode,_succeedNodes:node._succeedNodes,_failNodes:node._failNodes},'IfElse');
        actions.push({op:'when',condition:predicate(node._conditionNode),yes:sequence(node._succeedNodes,depth+1),no:sequence(node._failNodes,depth+1)});
      }else if(name==='SwitchMode'){
        if(!Number.isSafeInteger(node._modeIndex)||node._modeIndex<0||node._modeIndex>63)fail('mode index');
        exact(node,{$type:type(name),_modeIndex:node._modeIndex,_loadModeFromBlackboard:false,_restoreDefault:false,_restartFSM:false,_targetType:node._targetType},'mode switch');
        actions.push({op:'switchMode',who:node._targetType==='TARGET'?'target':binding(node._targetType),index:node._modeIndex});
      }else if(name==='ReleaseFromBlocker'){
        exact(node,{$type:type(name),_target:node._target},'release');actions.push({op:'release',who:binding(node._target)});
      }else if(name==='FixedValueDamage'){
        exact(node,{$type:type(name),_damageType:'PURE',_damageKey:node._damageKey,_ignoreForSp:true,_attackType:'NORMAL',
          _skipModifierEvent:true,_considerUnhurtable:false,_noSourceDamage:false,_targetType:'TARGET',_assignRealDamageToBB:false,
          _multiplierByKey:false,_multiplierKey:'cnt',_damageTargetType:'TARGET',_triggerOnCalculateDamage:false,_isEnvDamage:false,
          _ignoreCancelReasonMask:'NONE',_forceDisplayDamageNum:false},'fixed HP loss');
        actions.push({op:'loss',key:text(node._damageKey)});
      }else if(name==='AdvancedApplyDamage'){
        const damageType={PHYSICAL:'phys',MAGICAL:'arts',PURE:'true'}[node._damageType];
        if(!damageType)fail('damage type');
        exact(node,{$type:type(name),_targetType:'TARGET',_damageType:node._damageType,_atkScaleVar:node._atkScaleVar,
          _defaultAtkScale:node._defaultAtkScale,_applyWay:'ALL',_baseOnHostAtk:false,_emitSourceOnCalculateDamage:false,
          _attackType:'NORMAL',_forceUseProjectileCachedAtk:false,_ignoreForSp:false,_ignoreMissFlag:'NONE',
          _ignoreCancelReasonMask:'NONE',_modifierKey:'',_assignRealDamageToBB:false,_skipModifierEvent:false},'ordinary source damage');
        actions.push({op:'damage',type:damageType,scaleKey:text(node._atkScaleVar),defaultScale:finite(node._defaultAtkScale,0)});
      }else if(name==='InstantKill'){
        exact(node,{$type:type(name),_targetType:'TARGET',_killSource:true,_noSource:false,_withdrawIfRallyPoint:false,
          _resultIfInRallyPointMode:false,_skipReborn:false,_noReason:false,_markReachExit:false,_switchState:false},'source kill');
        actions.push({op:'kill',who:'source'});
      }else if(name==='CreateBuff'){
        exact(node,{$type:type(name),_buff:node._buff,_buffOwner:node._buffOwner,_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false},'create buff');
        actions.push({op:'create',who:binding(node._buffOwner),...childBuff(node._buff,depth)});
      }else fail(`action ${name}`);
    }
    return guards.length?[{op:'when',condition:{op:'all',terms:guards},yes:actions,no:[]}]:actions;
  };
  const compile=(key,depth=0)=>{
    text(key);if(depth>16||visiting.has(key))fail('template cycle/depth');if(Object.hasOwn(templates,key))return;
    if(Object.keys(templates).length+visiting.size>=64)fail('template budget');
    visiting.add(key);const template=templateFor(key);if(template?.templateKey!==key)fail('missing template');
    templates[key]=compileBuffTemplate(template,{dialect:t=>{
      const events={};for(const[event,nodes]of Object.entries(t.eventToActions)){
        if(!['ON_BUFF_START','ON_BUFF_TRIGGER','ON_AFTER_OUTPUT_DAMAGE','ON_BEFORE_ATTACK','ON_BUFF_DISABLE'].includes(event))fail(`event ${event}`);
        if(!Array.isArray(nodes))fail('event nodes');events[event]=sequence(nodes,depth);
      }return{events};
    }});visiting.delete(key);
  };
  compile(entry);const program={schemaVersion:1,entry,templates};
  return prepareBehaviorProgram(program).graph;
}
