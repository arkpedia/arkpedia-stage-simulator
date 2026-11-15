// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-is-chests-animations.json' with {type:'json'};
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
const specs=Object.freeze({
  enemy_2035_sybox:{buff:'badbox_t',template:'enemy_sybox_t[logkilled]',key:'trap_068_badbox',blackboard:[],delay:Math.fround(1.27)},
  enemy_2059_smbox:{buff:'smbbox_t',template:'log_killed',key:'trap_110_smbbox',blackboard:[{key:'key',value:0,valueStr:'trap_110_smbbox'}],delay:Math.fround(1.1)},
});
export const isLoggedChest=r=>Object.hasOwn(specs,r.prefabKey);
export function loggedChestNative(r,n){
  const p=specs[r.prefabKey];if(!p||![0,1,2].includes(r.level)||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'
    ||r.skills.length||r.sp||r.abilities.length||Object.keys(r.talents.bb).length||Object.keys(r.talents.bbStr).length||Object.keys(r.talents.groups).length)return false;
  const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]),combat=n.$ref(mode?._combat);
  const passive=n.$ref(root?._commonAbilities[0]),buff=passive?._buffs?.[0];
  if(!root||root._modes.length!==1||root._commonAbilities.length!==1||root._delayToBorn!==p.delay
    ||root._onlyDelayToBornOnTileStart!==0||root._blockVolume!==1||root._sideTypeIndex!==1||root._canNotExit!==0
    ||mode?._generalAbilities.length!==0||!zero(mode._attack)||!zero(mode._attackTrigger))return false;
  if(!fields(combat,{m_Script:{m_FileID:1,m_PathID:'4381884627089348317'},_activeBuffs:[],_animKey:'Attack',_atkScale:1,
    _damageType:1,_elementDamageType:0,_epDamageRatio:0,_extraDamageType:0,_attackType:1,_waitForAttackEvent:1,_timeMode:0,_affectedBySlowDown:1}))return false;
  if(!fields(passive,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0})
    ||passive._buffs.length!==1||!fields(buff,{buffKey:p.buff,templateKey:p.template,blackboard:p.blackboard,
      loadFromDB:0,lifeTimeType:2,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,
      maxStackCnt:1,triggerCnt:0,overrideType:0})||!same(buff.attributes,{abnormalFlags:[],abnormalImmunes:[0,16,12],
      abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:[]}))return false;
  const expected={$type:'Torappu.Battle.Action.Nodes+LogExtraBattleInfo, Assembly-CSharp',_logType:'SIMPLE',
    _key:r.prefabKey==='enemy_2035_sybox'?p.key:'killed',_loadKeyFromBlackBoard:true,_countInHostIfToken:false,
    _additionValue:1,_attributeType:'NONE',_target:'BUFF_OWNER'};
  const graphic=n.$ref(root._animator),animation=graphic?._animations;
  if(n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID!==clocks.enemies[r.prefabKey].source.skeletonDataPathId)return false;
  return same(n.$template(p.template)?.eventToActions,{ON_OWNER_KILLED:[expected]})
    &&animation?.some(a=>a.animKey==='Born'&&a.animName==='Start'&&a.speed===1&&!a.loop)
    &&animation.some(a=>a.animKey==='Attack'&&a.animName==='Attack'&&a.speed===1&&!a.loop);
}
export const LOGGED_CHEST_FEATURE={matchesRecord:isLoggedChest,covers:loggedChestNative,nativeClaim:()=>({active:1}),
  ability:{kind:'loggedEnemyBody',params:r=>{const p=specs[r.prefabKey],clock=clocks.enemies[r.prefabKey];return{
    killedKey:p.key,immunities:['stun','frozen','silence'],birthDelay:p.delay,birthDuration:clock.durations.Start,
    attackAnim:{dur:clock.durations.Attack,hit:clock.events.Attack[0].time},
  };}},note:'Native passive control immunities, original birth/attack clocks and killed-only result counter'};
