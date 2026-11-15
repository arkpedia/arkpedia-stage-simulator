// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-magic-circuit-animations.json' with {type:'json'};
const type=n=>`Torappu.Battle.Action.Nodes+${n}, Assembly-CSharp`;
const bow=r=>r.prefabKey.startsWith('enemy_1239_ltbow');
export function fluxAttackNative(r,n) {
  if(!['enemy_1238_ltmob','enemy_1238_ltmob_2','enemy_1239_ltbow','enemy_1239_ltbow_2'].includes(r.prefabKey)
    || r.skills.length || r.sp || Object.keys(r.talents.bbStr).length || r.stats.dmgType!=='phys'
    || r.applyWay!==(bow(r)?'RANGED':'MELEE') || Object.keys(r.talents.bb).join()!==(bow(r)?'ExAtk.times':'ExAtk.atk_scale')
    || r.talents.bb[bow(r)?'ExAtk.times':'ExAtk.atk_scale']!==(bow(r)?1:.4))return false;
  const root=n[r.prefabKey]?.find(c=>'_modes' in c),mode=n.$ref(root?._modes[0]),attack=n.$ref(mode?._attack);
  const talent=n.ExAtk?.find(c=>'_additiveActiveBuffs' in c),buff=talent?._additiveActiveBuffs[0];
  const template=bow(r)?'enemy_ltbow_t':'enemy_ltmob_t';
  if(root?._modes.length!==1 || root._commonAbilities.length || mode?._generalAbilities.length
    || mode._combat.m_PathID!==mode._attack.m_PathID || attack?._activeBuffs.length!==0
    || attack._damageType!==1 || attack._atkScale!==1 || attack._waitForAttackEvent!==1 || attack._affectedBySlowDown!==1
    || attack._preDelay!==0 || attack._timeMode!==0 || attack._selectTargetSource!==2
    || talent?._targetFamilyMask!==3 || talent._buffs.length || talent._probKey!=='' || talent._additiveActiveBuffs.length!==1
    || buff?.templateKey!==template || buff.isDamageMissable!==0 || buff.isSilenceable!==0 || buff.isStunnable!==0 || buff.lifeTimeType!==0)return false;
  const events=n.$template(template)?.eventToActions.ON_BUFF_START,branch=events?.[0],fail=branch?._failNodes;
  if(events?.length!==1 || branch.$type!==type('IfElse') || branch._conditionNode.$type!==type('CheckCharacterInMagicCircuit')
    || branch._conditionNode._targetType!=='BUFF_OWNER' || branch._succeedNodes.length!==1 || branch._succeedNodes[0].$type!==type('CreateEffect')
    || fail?.length!==3 || fail[0].$type!==type('CreateEffect') || fail[1].$type!==type('AlwaysNext'))return false;
  let damage=fail[2];
  if(bow(r)) {
    const create=fail[2],child=create._buffPair?.buff;
    if(create.$type!==type('CreateBuffs') || !create._buffPair.useBlackboard || create._isDerivedBuff
      || child?.templateKey!=='apply_damage[physical][ignore_sp]' || child.isDamageMissable || child.isSilenceable || child.lifeTimeType!=='IMMEDIATELY')return false;
    const actions=n.$template(child.templateKey)?.eventToActions.ON_BUFF_START;if(actions?.length!==1)return false;damage=actions[0];
    const selector=n.$siblings(mode._attackTrigger).find(c=>'_targetSide' in c),p=n.$projectile('projectile_enemy_ltbow');
    const motion=p.find(c=>'_speed' in c),life=p.find(c=>'_lifeTime' in c);
    if(attack._projectileKey!=='projectile_enemy_ltbow' || attack._extraProjectileKeys.length || attack._useCachedAtkOnly!==0
      || selector?._targetSide!==2 || selector._targetMotion!==3 || selector._targetCategory!==1 || selector._ignoreTargetFree!==0
      || selector._postFilter!==4 || selector._limitTargetNum!==1 || selector._forceIgnoreCamouflage!==0
      || motion?._speed!==10 || motion._flyToTargetLocationOnly!==0 || motion._forceReachedWhenTimeup!==1
      || life?._lifeTime!==5 || life._maxHitNum!==1 || life._stopWhenSourceInvalid!==0 || life._alwaysHitTraceTargetInTheEnd!==1
      || life._canHitSameTargetMultipleTimes!==0 || life._actionController._extraBuffsInTheEnd.length)return false;
  }
  const graphic=n.$ref(root._animator),clock=clocks.enemies[r.prefabKey],binding=graphic?._animations.find(a=>a.animKey==='Attack');
  return damage.$type===type('AdvancedApplyDamage') && (damage._sourceType ?? 'SOURCE')==='SOURCE' && damage._targetType==='TARGET'
    && damage._damageType===(bow(r)?'PHYSICAL':'MAGICAL') && damage._atkScaleVar==='atk_scale' && damage._defaultAtkScale===1
    && damage._applyWay==='MELEE' && damage._attackType==='NORMAL' && damage._ignoreForSp && !damage._forceUseProjectileCachedAtk
    && damage._ignoreMissFlag==='NONE' && damage._ignoreCancelReasonMask==='NONE' && !damage._skipModifierEvent
    && !damage._noSource && !damage._baseOnHostAtk && !!clock && n.$ref(graphic._skeleton)?.skeletonDataAsset.m_PathID===clock.source.skeletonDataPathId
    && clock.durations.Attack===(bow(r)?1:Math.fround(1.1)) && clock.events.Attack?.[0]?.time===(bow(r)?Math.fround(1/3):Math.fround(.4))
    && binding?.animName==='Attack' && binding.speed===1 && binding.loop===0 && clock.events.Attack?.length===1 && clock.events.Attack[0].name==='OnAttack';
}
export const MAGIC_CIRCUIT_ENEMY_FEATURES={
 'talent:ExAtk':{covers:fluxAttackNative,ability:{kind:'fluxConditionalAttack',params:r=>({ranged:bow(r),scale:bow(r)?1:r.talents.bb['ExAtk.atk_scale'],
  attackAnim:{dur:clocks.enemies[r.prefabKey].durations.Attack,hit:clocks.enemies[r.prefabKey].events.Attack[0].time}})},
  explains:/^When attacking targets outside of Realigned Flux, deals (?:a certain percentage of Arts damage|an additional hit)$/},
};

export function fluxColossusNative(r,n) {
  if(!['enemy_1240_ltgint','enemy_1240_ltgint_2'].includes(r.prefabKey) || r.skills.length || r.sp
    || r.applyWay!=='MELEE' || r.stats.dmgType!=='phys' || Object.keys(r.talents.bbStr).length
    || Object.keys(r.talents.bb).sort().join()!=='Weak.def,Weak.magic_resistance'
    || r.talents.bb['Weak.def']!==(r.prefabKey.endsWith('_2')?-1200:-1000) || r.talents.bb['Weak.magic_resistance']!==-50)return false;
  const root=n[r.prefabKey]?.find(c=>'_modes' in c),mode=n.$ref(root?._modes[0]),attack=n.$ref(mode?._combat);
  const ability=n.Weak?.find(c=>'_buffs' in c),buff=ability?._buffs[0];
  const events=n.$template('enemy_ltgint_t')?.eventToActions,enter=events?.ON_ENTER_MAGICCIRCUIT,leave=events?.ON_LEAVE_MAGICCIRCUIT;
  const create=enter?.[0],child=create?._buff,mods=child?.attributes.attributeModifiers;
  return root?._blockVolume===2 && root._modes.length===1 && !root._commonAbilities.length && !mode._generalAbilities.length
    && mode._attack.m_PathID==='0' && mode._attackTrigger.m_PathID==='0' && attack?._damageType===1 && attack._atkScale===1 && !attack._activeBuffs.length
    && ability?._buffs.length===1 && buff?.templateKey==='enemy_ltgint_t' && buff.lifeTimeType===2
    && buff.isSilenceable===0 && buff.isStunnable===0 && buff.isFreezable===0 && !buff.attributes.attributeModifiers.length
    && Object.keys(events).sort().join()==='ON_ENTER_MAGICCIRCUIT,ON_LEAVE_MAGICCIRCUIT'
    && enter?.length===1 && create.$type===type('CreateBuff') && create._buffOwner==='BUFF_OWNER' && create._isDerivedBuff
    && child.buffKey==='enemy_ltgint_t[weak]' && child.templateKey==='empty' && child.lifeTimeType==='INFINITY'
    && !child.isSilenceable && !child.isStunnable && child.maxStackCnt===1 && mods?.length===2
    && mods[0].attributeType==='DEF' && mods[1].attributeType==='MAGIC_RESISTANCE'
    && mods.every(m=>m.formulaItem==='ADDITION'&&m.loadFromBlackboard&&!m.fetchBaseValueFromSourceEntity)
    && leave?.length===1 && leave[0].$type===type('FinishDerivedBuff');
}
MAGIC_CIRCUIT_ENEMY_FEATURES['talent:Weak']={covers:fluxColossusNative,
 ability:{kind:'fluxColossus',params:r=>({def:r.talents.bb['Weak.def'],res:r.talents.bb['Weak.magic_resistance']})},
 explains:/^When in Realigned Flux, DEF and RES are greatly reduced$/};
