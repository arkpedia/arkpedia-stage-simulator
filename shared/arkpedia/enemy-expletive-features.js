// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-expletives-animations.json' with{type:'json'};
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
import {ordinaryMeleePacketNative} from './enemy-ordinary-body-contract.js';
const ids=['enemy_10053_cjman','enemy_10053_cjman_2'];
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const isExpletive=r=>ids.includes(r.prefabKey);
export const EXPLETIVE_DESCRIPTION='Can use long-ranged weapons to attack <Sapidity>';
const event=time=>[{time,name:'OnAttack',int:0,float:0,string:''}];
export function expletiveNative(r,n){
 if(!isExpletive(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.notCountInTotal
  ||r.skills.length||r.sp||!same(r.talents,{bb:{},bbStr:{},groups:{}})||!same(r.abilities,[{text:EXPLETIVE_DESCRIPTION,format:'NORMAL'}]))return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes?.[0]),combat=n.$ref(mode?._combat),attack=n.$ref(mode?._attack),trigger=n.$ref(mode?._attackTrigger);
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_commonAbilities:[],_sideTypeIndex:1,_delayToBorn:0,
  _onlyDelayToBornOnTileStart:0,_blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_idleWhenBorn:0,_canNotExit:0})
  ||root._modes.length!==1||!same(mode?._generalAbilities,[])||!ordinaryMeleePacketNative(combat,{interruptOnDetach:1})
  ||!ordinaryMeleePacketNative(attack,{interruptOnDetach:1,clip:'Skill'})
  ||!fields(trigger,{m_Script:{m_FileID:1,m_PathID:'8607874384982393801'},_keepTarget:0,_minTargetNum:1,_overrideSearchTargetTick:-1}))return false;
 const siblings=n.$siblings(trigger),range=siblings.find(c=>'_scaleble'in c),filter=siblings.find(c=>'_buffKey'in c),circle=siblings.find(c=>'m_Radius'in c),transform=siblings.find(c=>'m_LocalScale'in c);
 if(!fields(range,{m_Script:{m_FileID:1,m_PathID:'6185056810787956083'},_useBlackboardRangeId:0,_extendable:0,_scaleble:1})
  ||!fields(circle,{m_Radius:1,m_Enabled:1,m_Offset:{x:0,y:0}})||!fields(transform,{m_LocalScale:{x:1,y:1,z:1},m_LocalPosition:{x:0,y:0,z:0}})
  ||!fields(filter,{m_Script:{m_FileID:1,m_PathID:'6959540303033999559'},_targetSide:2,_targetMotion:1,_targetCategory:1,_postFilter:4,
   _ignoreTargetFree:0,_onlyIgnoreSomeOfTargetFreeCase:0,_abnormalFlag:37,_abnormalCombo:2,_ignoreAllyTargetFree:0,_ignoreHealFree:0,
   _ignoreMotionMode:0,_forceIgnoreCamouflage:0,_needProfessionMask:0,_professionMask:0,_excludeSomeAbnormalFlags:0,_excludeAbnormalFlag:46,
   _limitTargetNum:1,_maxTargetKey:'max_target',_maxNum:1,_excludeOwner:0,_sortByTauntAtLast:0,_ignoreHitRange:0,_checkUnitType:0,_unitTypeMask:0,
   _abilityInputTargetAsSortSource:0,_tagExcluded:0,_filterTag:'',_filterTagList:[],_buffKeyExcluded:0,_buffKey:'enemy_cjgfod[mark]',_buffs:[],
   _checkOrInsteadOfAnd:0,_filterBuffSource:0,_filterTokenHost:0}))return false;
 const clock=clocks.enemies[r.prefabKey],graphic=n.$ref(root._animator);
 return n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&['Attack','Skill'].every(clip=>graphic._animations.some(a=>a.animKey===clip&&a.animName===clip&&a.speed===1&&!a.loop))
  &&clock.durations.Attack===Math.fround(50/30)&&clock.durations.Skill===1.5
  &&same(clock.events.Attack,event(Math.fround(28/30)))&&same(clock.events.Skill,event(Math.fround(23/30)));
}
const animation=(r,clip)=>({clip,duration:clocks.enemies[r.prefabKey].durations[clip],releases:clocks.enemies[r.prefabKey].events[clip].map(e=>e.time)});
export const EXPLETIVE_FEATURE={matchesRecord:isExpletive,covers:expletiveNative,
 ability:{kind:'markedRangedMeleeAttack',params:r=>({radius:1,markerKey:'enemy_cjgfod[mark]',groundOnly:true,
  meleeAnimation:animation(r,'Attack'),rangedAnimation:animation(r,'Skill')})},
 note:'Shared native ordinary blocker melee and marked ground-target direct-hit mode; Sapidity creation/ownership remains with the stage device.'};
