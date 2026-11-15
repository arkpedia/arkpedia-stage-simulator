// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-firelight-melee-animations.json' with { type: 'json' };
import { sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const ids = ['enemy_1293_duswrd','enemy_1293_duswrd_2','enemy_1293_duswrd_3'];
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
const script = (c,id) => c?.m_Script?.m_PathID === id;
const ignition = 'Ignites Reeds upon passing by them';
const combo = /^After several attacks, unleashes 5 (?:powerful )?consecutive slashes at the target$/;
export function firelightSpecOpsNative(r,n) {
  if (!ids.includes(r.prefabKey) || r.applyWay !== 'MELEE' || r.stats.dmgType !== 'phys' || r.stats.motion !== 'WALK'
    || !same(r.talents,{bb:{},bbStr:{},groups:{}}) || !same(r.sp,{type:'INCREASE_WHEN_ATTACK',maxSp:3,initSp:0,increment:1})
    || !same(r.skills,[{prefabKey:'MultiAttack',priority:0,cooldown:0,initCooldown:0,spCost:3,bb:{atk_scale:r.prefabKey.endsWith('_3')?1.2:1},bbStr:{}}])
    || r.abilities.length !== 2 || !r.abilities.some(a=>a.text===ignition) || !r.abilities.some(a=>combo.test(a.text))) return false;
  const root=n[r.prefabKey]?.[0],mode=n.$ref(root?._modes?.[0]),attack=n.$ref(mode?._combat),graphic=n.$ref(root?._animator);
  const multi=n.MultiAttack?.find(a=>'_additionalTimes'in a),wrapper=n.MultiAttack?.find(a=>'_familyMask'in a),clock=clocks.enemies[r.prefabKey];
  if (!script(root,'-6629209555389654693') || root._modes.length!==1 || root._commonAbilities.length || root._delayToBorn!==0
    || mode?._generalAbilities.length || !zero(mode._attack) || !zero(mode._attackTrigger)
    || !script(attack,'4381884627089348317') || !script(multi,'-5349745400011864685')
    || wrapper?._familyMask!==2 || wrapper._ignoreSilence!==0 || !zero(wrapper._trigger) || wrapper._maxTriggerTime!==-1 || wrapper._resetMainAbilityCdWhenCastEnd!==0
    || multi._additionalTimes!==4 || multi._waitAttackEventForAllAttacks!==1 || multi._splitDamage!==0 || multi._triggerDelta!==0
    || multi._refreshInputTargetOnCheckSpell!==0 || !zero(multi._refreshInputTargetTrigger) || multi._refreshTimesOnCheckAnotherSpell!==0
    || multi._refreshTimesOnCastStart!==0 || multi._interuptIfTargetDead!==0 || multi._maxAnimScale!==-1
    || n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID!==clock.source.skeletonDataPathId) return false;
  for(const [cast,clip] of [[attack,'Attack'],[multi,'Skill']]) {
    const bind=graphic._animations.find(a=>a.animKey===clip);
    if(cast._damageType!==1 || cast._atkScale!==1 || cast._attackType!==1 || cast._activeBuffs.length || !zero(cast._selector)
      || cast._selectTargetSource!==2 || cast._selectTargetTiming!==0 || cast._timeMode!==0 || cast._waitForAttackEvent!==1
      || cast._animKey!==clip || cast._affectedBySlowDown!==1 || cast._preDelay!==0 || cast._epDamageRatio!==0
      || bind?.animName!==clip || bind.speed!==1 || bind.loop!==0) return false;
  }
  const ignite=n.ignite?.[0],buff=ignite?._buffs?.[0];
  return ignite?._buffs.length===1 && buff.templateKey==='enemy_duswrd_ignite' && !buff.loadFromDB && !buff.isSilenceable
    && !buff.isStunnable && !buff.isFreezable && !buff.isLevitatable && !buff.isGroundBoundable && !buff.isDamageMissable
    && buff.lifeTimeType===2 && buff.triggerLifeType===2 && buff.triggerInterval===Math.fround(.1) && buff.waitFirstTriggerInterval===1
    && !buff.blackboard.length && same(n.$template('enemy_duswrd_ignite')?.eventToActions,{ON_BUFF_TRIGGER:[{
      $type:'Torappu.Battle.Action.Nodes+SwitchDynamicBuffTileMode, Assembly-CSharp',_operation:'INDEX',_modeIndex:1,
      _decBbKey:'',_useSwitchResult:false,_specifyTileType:true,_tileType:'REED_TILE',_useOwnerRootTile:false,
    }]}) && same(clock.events.Skill.map(e=>[e.name,e.time]),[.3,16/30,1,40/30,55/30].map(t=>['OnAttack',Math.fround(t)]))
    && clock.durations.Skill===Math.fround(82/30) && clock.events.Attack[0].name==='OnAttack';
}
export const FIRELIGHT_SPECOPS_FEATURES = {
  'skill:MultiAttack': { matchesRecord:r=>ids.includes(r.prefabKey),covers:firelightSpecOpsNative,nativeClaim:()=>({wrappers:1,active:0}),
    explains:text=>text===ignition||combo.test(text),
    ability:{kind:'firelightSpecOps',params:r=>{const c=clocks.enemies[r.prefabKey];return{
      cost:r.skills[0].spCost,initialSp:r.sp.initSp,maxSp:r.sp.maxSp,increment:r.sp.increment,
      scale:r.skills[0].bb.atk_scale,duration:c.durations.Skill,releases:c.events.Skill.map(e=>e.time),
      attackAnim:{dur:c.durations.Attack,hit:c.events.Attack[0].time},
    };}},
  },
};
