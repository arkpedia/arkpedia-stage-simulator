// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same,nativeKillLog,passiveOutcomeBuff} from './enemy-outcome-contracts.js';
const ids=['enemy_1178_dscorp','enemy_1178_dscorp_2'];
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
export const NIGHT_CRAWLER_DESCRIPTION='When in areas with no visibility, Movement Speed increases';
const isNightCrawler=r=>ids.includes(r.prefabKey);
export function nightCrawlerNative(r,n){
 if(!isNightCrawler(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.notCountInTotal
  ||r.skills.length||r.sp||!same(r.talents,{bb:{'NightBuff.move_speed':.3},bbStr:{},groups:{NightBuff:['move_speed']}})
  ||!same(r.abilities,[{text:NIGHT_CRAWLER_DESCRIPTION,format:'NORMAL'}]))return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes?.[0]),combat=n.$ref(mode?._combat);
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_blockVolume:1,
  _specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_idleWhenBorn:0,_canNotExit:0})||root._modes.length!==1
  ||!mode||!same(mode._generalAbilities,[])||!zero(mode._attack)||!zero(mode._attackTrigger)
  ||!fields(combat,{m_Script:{m_FileID:1,m_PathID:'4381884627089348317'},_selector:{m_FileID:0,m_PathID:'0'},_activeBuffs:[],
   _atkScale:1,_damageType:1,_extraDamageType:0,_elementDamageType:0,_epDamageRatio:0,_attackType:1}))return false;
 const toggle=n.NightBuff?.find(c=>'_checker'in c),buff=toggle?._buffs?.[0],checker=n.$ref(toggle?._checker);
 if(!fields(toggle,{m_Script:{m_FileID:1,m_PathID:'5578302910068743633'},_selector:{m_FileID:0,m_PathID:'0'},
  _interruptAbilityOnDetach:0,_ignoreIfOwnerDead:0,_unmanagedBuffsWhenToggleOn:[],_setToggleFalseOnDetached:0,_isInverseToggle:0,_buffsWhenToggleOff:[]})
  ||toggle._buffs.length!==1||!fields(checker,{m_Script:{m_FileID:1,m_PathID:'1349972819923973658'},_condition:{_toggleOnMask:8}})
  ||!fields(buff,{buffKey:'dscorp_night_buff',templateKey:'empty',loadFromDB:0,isSilenceable:1,isStunnable:0,isFreezable:0,
   isLevitatable:0,isGroundBoundable:0,lifeTimeType:2,lifeTime:0,maxStackCnt:1,overrideType:0,blackboard:[]})
  ||!same(buff.attributes,{abnormalFlags:[],abnormalImmunes:[],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:[
   {attributeType:6,formulaItem:1,value:0,loadFromBlackboard:1,fetchBaseValueFromSourceEntity:0}]})
  ||!same(n.$template('empty')?.eventToActions,{}))return false;
 if(r.prefabKey.endsWith('_2'))return same(root._commonAbilities,[]);
 const passive=n.$ref(root._commonAbilities?.[0]),log=passive?._buffs?.[0];
 return root._commonAbilities.length===1&&fields(passive,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},
  _selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0})&&passive._buffs.length===1
  &&passiveOutcomeBuff(log)&&log.buffKey==='enemy_dscorp_log'&&log.templateKey==='log_killed'&&same(log.blackboard,[])&&nativeKillLog(n);
}
const feature={matchesRecord:isNightCrawler,covers:nightCrawlerNative};
export const NIGHT_CRAWLER_FEATURES={
 'talent:NightBuff':{...feature,explains:text=>text===NIGHT_CRAWLER_DESCRIPTION,
  ability:{kind:'environmentStatBonus',params:r=>({conditionMask:8,buffKey:'dscorp_night_buff',mods:{movePct:r.talents.bb['NightBuff.move_speed']},silenceable:true})}},
 'native:nightCrawlerLog':{...feature,nativeClaim:()=>({active:1}),ability:{kind:'stageOutcomeCounter',params:()=>({killedKey:'killed'})}},
};
