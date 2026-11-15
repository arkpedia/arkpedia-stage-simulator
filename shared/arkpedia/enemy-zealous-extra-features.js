// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
const ids=['enemy_10095_crgst','enemy_10095_crgst_2'];
const blocker='env_act43side[shooting]',blockee='enemy_crgst[unblockable]',checker='enemy_crgst[blocker]';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
const action=(name,fields={})=>({$type:`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`,...fields});
const checkBuff=(target,key)=>action('CheckContainsBuff',{_targetType:target,_buffKeys:[key],isAND:true,
  _loadFromBlackboard:false,_checkBuffSource:false,_buffSourceType:'BUFF_SOURCE',_checkSourceHost:false});
export const isZealousExtra=r=>ids.includes(r.prefabKey);
function releaseTemplates(n){
  const events=n.$template(checker)?.eventToActions,outer=events?.ON_BUFF_TRIGGER?.[0],inner=outer?._failNodes?.[0];
  const create=inner?._succeedNodes?.[0],buff=create?._buff;
  return Object.keys(events??{}).join()==='ON_BUFF_TRIGGER'&&events.ON_BUFF_TRIGGER.length===1
    &&fields(outer,{$type:action('IfElse').$type,_conditionNode:checkBuff('BUFF_OWNER',blocker),_succeedNodes:null})
    &&outer._failNodes.length===1&&fields(inner,{$type:action('IfElse').$type,
      _conditionNode:checkBuff('BUFF_SOURCE',blockee),_failNodes:null})&&inner._succeedNodes.length===1
    &&fields(create,{$type:action('CreateBuff').$type,_buffOwner:'BUFF_SOURCE',_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false})
    &&empty(buff?.attributes)&&fields(buff,{buffKey:'enemy_crgst[blockee]',templateKey:'enemy_crgst[blockee]',
      loadFromDB:false,isDurableBuff:false,isDamageMissable:false,isSilenceable:false,isStunnable:false,isFreezable:false,
      isLevitatable:false,statusResistable:'AUTOMATIC',disableOverride:false,overrideKey:null,overrideType:'DEFAULT',
      maxStackCnt:1,independentCharacterSource:false,lifeTimeType:'IMMEDIATELY',triggerLifeType:'IMMEDIATELY',blackboard:[]})
    &&same(n.$template('enemy_crgst[blockee]')?.eventToActions,{ON_BUFF_START:[action('ReleaseFromBlocker',{_target:'BUFF_OWNER'})]});
}
export function zealousExtraNative(r,n){
  if(!isZealousExtra(r)||r.level!==0||r.applyWay!=='NONE'||r.stats.dmgType!=='none'||r.stats.motion!=='WALK'
    ||r.skills.length||r.sp||!same(r.talents,{bb:{},bbStr:{},groups:{}})
    ||!same(r.abilities,[{text:'Can only be blocked by allied units inside the Filming Area',format:'NORMAL'}]))return false;
  const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]),combat=n.$ref(mode?._combat);
  if(root?._modes.length!==1||root._commonAbilities?.length!==0||root._sideTypeIndex!==1||root._delayToBorn!==0
    ||root.m_Script?.m_PathID!=='-6629209555389654693'||root._idleWhenBorn!==0||root._canNotExit!==0
    ||root._blockVolume!==1||!same(root._specialBlockCondition,{_type:1,
      _buffKeyPairs:[{blockerBuffKey:blocker,blockeeBuffKey:blockee}],_filterTags:[]})
    ||!mode||mode._generalAbilities?.length!==0||!zero(mode._attack)||!zero(mode._attackTrigger)
    ||!fields(combat,{m_Script:{m_FileID:1,m_PathID:'-8178746901033412656'},m_Enabled:1,
      _forceAsDmgOrHealAbility:0,_selector:{m_FileID:0,m_PathID:'0'}}))return false;
  const markerAbility=n.unblockable?.find(c=>'_buffs'in c),marker=markerAbility?._buffs;
  const toggle=n.check?.find(c=>'_checker'in c),check=n.$ref(toggle?._checker),buff=check?._buffsToBlockee?.[0];
  const binding={m_Script:{m_FileID:1,m_PathID:'-2726233351382997147'},m_Enabled:1,_attachInDummy:0,
    _overwriteTalentKey:'',_checkValidBySkillIndex:[],_defaultModeIndex:-1,_attackBlackboardModeIndex:-1,
    _extraAttackBlackboardModeIndices:[],_applyTalentScale:0,_influenceSkillBlackboard:0,_fromRawDataToSkill:0,
    _applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0,_scaleCertainKeyFlag:0};
  if(![markerAbility,toggle].every(ability=>ability?.m_Enabled===1
    &&n.$siblings(ability).some(c=>fields(c,binding))))return false;
  const passive={loadFromDB:0,isDurableBuff:0,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,
    isGroundBoundable:0,statusResistable:2,disableOverride:0,overrideType:0,maxStackCnt:1,blackboard:[],lifeTimeType:2};
  return marker?.length===1&&empty(marker[0].attributes)&&fields(marker[0],{...passive,buffKey:blockee,templateKey:'empty',
      triggerLifeType:0,triggerCnt:0,triggerInterval:-1})
    &&fields(toggle,{m_Script:{m_FileID:1,m_PathID:'5578302910068743633'},_buffs:[],_isInverseToggle:0,
      _unmanagedBuffsWhenToggleOn:[],_buffsWhenToggleOff:[],_setToggleFalseOnDetached:1})
    &&fields(check,{m_Script:{m_FileID:1,m_PathID:'-4412927117579039591'},m_Enabled:1,_blockMinCnt:0,_blockMaxCnt:-1,_useBlockAsMin:1})
    &&check._buffsToBlockee.length===1&&empty(buff?.attributes)&&fields(buff,{...passive,buffKey:checker,templateKey:checker,
      triggerLifeType:2,triggerInterval:Math.fround(.1),waitFirstTriggerInterval:0,firstTriggerInterval:-1})&&releaseTemplates(n);
}
export const ZEALOUS_EXTRA_FEATURES={
  'ability:Can only be blocked by allied units inside the Filming Area':{matchesRecord:isZealousExtra,covers:zealousExtraNative,
    ability:{kind:'pairedBlockerBuffs',params:()=>({blockerBuffKey:blocker,blockeeBuffKey:blockee,
      checkBuffKey:checker,interval:Math.fround(.1)})}},
};
