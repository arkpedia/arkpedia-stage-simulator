// SPDX-License-Identifier: GPL-3.0-or-later
import { FLUX_SPLASH_RANGE } from './enemy-flux-ranges.js';
import clocks from '../../data/arkpedia-magic-circuit-animations.json' with {type:'json'};
const type=n=>`Torappu.Battle.Action.Nodes+${n}, Assembly-CSharp`;
const violin=r=>r.prefabKey.startsWith('enemy_1242_ltsmag');
function attackNative(r,n) {
  const root=n[r.prefabKey]?.find(c=>'_modes' in c),mode=n.$ref(root?._modes[0]),attack=n.$ref(mode?._attack);
  const graphic=n.$ref(root?._animator),clock=clocks.enemies[r.prefabKey],binding=graphic?._animations.find(a=>a.animKey==='Attack');
  const selector=n.$siblings(mode?._attackTrigger).find(c=>'_targetSide' in c);
  const p=n.$projectile(violin(r)?'projectile_enemy_ltsmag':'projectile_enemy_ltmage');
  const motion=p.find(c=>'_speed' in c),life=p.find(c=>'_lifeTime' in c);
  return !r.skills.length && !r.sp && r.stats.dmgType==='arts' && r.applyWay==='RANGED'
    && root?._modes.length===1 && !root._commonAbilities.length && !mode._generalAbilities.length
    && mode._combat.m_PathID===mode._attack.m_PathID && attack?._damageType===2 && attack._atkScale===1 && !attack._activeBuffs.length
    && attack._waitForAttackEvent===1 && attack._affectedBySlowDown===1 && attack._preDelay===0 && attack._timeMode===0
    && attack._selectTargetSource===(violin(r)?2:1) && attack._projectileKey===(violin(r)?'projectile_enemy_ltsmag':'projectile_enemy_ltmage')
    && selector?._targetSide===2 && selector._targetMotion===3 && selector._targetCategory===1 && selector._ignoreTargetFree===0
    && selector._postFilter===4 && selector._limitTargetNum===1 && selector._maxNum===(violin(r)?1:2) && selector._forceIgnoreCamouflage===0
    && motion?._speed===10 && motion._flyToTargetLocationOnly===0 && motion._forceReachedWhenTimeup===(violin(r)?0:1)
    && life?._lifeTime===(violin(r)?5:10) && life._maxHitNum===1 && life._stopWhenSourceInvalid===0 && life._alwaysHitTraceTargetInTheEnd===1
    && !life._canHitSameTargetMultipleTimes && !life._actionController._extraBuffsInTheEnd.length
    && !!clock && n.$ref(graphic._skeleton)?.skeletonDataAsset.m_PathID===clock.source.skeletonDataPathId
    && binding?.animName==='Attack' && binding.speed===1 && binding.loop===0
    && clock.durations.Attack===(violin(r)?2:Math.fround(1.2)) && clock.events.Attack?.length===1
    && clock.events.Attack[0].name==='OnAttack' && clock.events.Attack[0].time===(violin(r)?Math.fround(19/30):Math.fround(17/30));
}
export function fluxSplashNative(r,n) {
  if(!['enemy_1241_ltmage','enemy_1241_ltmage_2'].includes(r.prefabKey) || !attackNative(r,n)
    || Object.keys(r.talents.bb).join()!=='AOEDamage.atk_scale' || r.talents.bb['AOEDamage.atk_scale']!==1
    || Object.keys(r.talents.bbStr).join()!=='AOEDamage.range_id' || r.talents.bbStr['AOEDamage.range_id']!=='x-4')return false;
  const ability=n.AOEDamage?.find(c=>'_additiveActiveBuffs' in c),buff=ability?._additiveActiveBuffs[0];
  const actions=n.$template('enemy_ltmage_t')?.eventToActions.ON_BUFF_START,aoe=actions?.[4],child=aoe?._buffs[0];
  const damage=n.$template('apply_damage[magic][ignore_sp]')?.eventToActions.ON_BUFF_START;
  return ability?._targetFamilyMask===3 && !ability._buffs.length && ability._additiveActiveBuffs.length===1
    && buff?.templateKey==='enemy_ltmage_t' && buff.lifeTimeType===0 && !buff.isSilenceable && !buff.isDamageMissable
    && actions?.length===6 && actions[0].$type===type('CreateEffect') && actions[1].$type===type('AlwaysNext')
    && actions[2].$type===type('CheckCharacterInMagicCircuit') && actions[2]._targetType==='BUFF_OWNER' && actions[3].$type===type('IfNot')
    && aoe.$type===type('CreateBuffInRange') && aoe._sourceType==='BUFF_SOURCE' && aoe._targetType==='BUFF_OWNER'
    && aoe._targetOptions.targetSide==='ENEMY' && aoe._targetOptions.targetMotion==='ALL' && !aoe._targetOptions.ignoreTargetFree
    && aoe._excludeTarget && !aoe._limitMaxTarget && !aoe._useRadius && !aoe._useGlobalRange && !aoe._useAttackRange && aoe._rangeId==null
    && aoe._buffs.length===1 && child.templateKey==='apply_damage[magic][ignore_sp]' && !child.isSilenceable && !child.isDamageMissable
    && child.lifeTimeType==='LIMITED' && child.lifeTime===Math.fround(.1) && child.maxStackCnt===1
    && damage?.length===1 && damage[0].$type===type('AdvancedApplyDamage') && damage[0]._damageType==='MAGICAL'
    && damage[0]._atkScaleVar==='atk_scale' && damage[0]._ignoreForSp && damage[0]._applyWay==='MELEE'
    && JSON.stringify(n.$range('x-4')?.grids.map(p=>[p.row,p.col]))===JSON.stringify(FLUX_SPLASH_RANGE);
}
export function fluxViolinNative(r,n) {
  if(!['enemy_1242_ltsmag','enemy_1242_ltsmag_2'].includes(r.prefabKey) || !attackNative(r,n)
    || Object.keys(r.talents.bb).sort().join()!=='EmitProjectile.attack@atk_scale_2,EmitProjectile.attack@max_target'
    || r.talents.bb['EmitProjectile.attack@atk_scale_2']!==.5 || r.talents.bb['EmitProjectile.attack@max_target']!==2 || Object.keys(r.talents.bbStr).length)return false;
  const root=n[r.prefabKey].find(c=>'_modes' in c),mode=n.$ref(root._modes[0]);
  const target=n.$siblings(mode._attackTrigger).find(c=>'_targetSide' in c),buff=n.EmitProjectile?.find(c=>'_buffs' in c)?._buffs[0];
  if(target._secondaryFilter!==3 || target._buffKey!=='character_in_magiccircuit[normal]' || target._withoutThisBuff!==0
    || buff?.templateKey!=='empty' || buff.isSilenceable!==0 || buff.lifeTimeType!==2)return false;
  for(const name of ['projectile_enemy_ltsmag','projectile_enemy_ltsmag_forward','projectile_enemy_ltsmag_backward']){
    const p=n.$projectile(name);
    const emit=p.filter(c=>'_projectileKey' in c),expected=name==='projectile_enemy_ltsmag'?['forward','backward']:[name.endsWith('forward')?'forward':'backward'];
    if(emit.length!==expected.length)return false;
    for(const direction of expected){const e=emit.find(c=>c._projectileKey===`projectile_enemy_ltsmag_${direction}`);
      // Selectors are retained by reference, including their siblings.
      const ref=e&&n.$projectileRef(name,e._selector);
      if(!e || e._onlyCheckHitWhenReachTarget!==1 || e._hitPasserby!==0 || e._interval!==0 || ref?._maxTargetNum!==1 || ref._isBackward!==(direction==='backward'?1:0))return false;
    }
    const move=p.find(c=>'_speed' in c),life=p.find(c=>'_lifeTime' in c);
    if(move?._speed!==10 || move._forceReachedWhenTimeup!==0 || life?._lifeTime!==5 || life._maxHitNum!==1
      || life._stopWhenSourceInvalid!==0 || life._canHitSameTargetMultipleTimes!==0)return false;
  }
  return true;
}
const animation=r=>({dur:clocks.enemies[r.prefabKey].durations.Attack,hit:clocks.enemies[r.prefabKey].events.Attack[0].time});
export const FLUX_CASTER_FEATURES={
 'talent:AOEDamage':{matchesRecord:r=>['enemy_1241_ltmage','enemy_1241_ltmage_2'].includes(r.prefabKey),covers:fluxSplashNative,ability:{kind:'fluxSplashCaster',params:r=>({attackAnim:animation(r),scale:r.talents.bb['AOEDamage.atk_scale']})},
  explains:/^(?:Attacks 2 enemies simultaneously|When attacking targets outside of Realigned Flux, deals Splash damage)$/},
 'talent:EmitProjectile':{matchesRecord:r=>['enemy_1242_ltsmag','enemy_1242_ltsmag_2'].includes(r.prefabKey),covers:fluxViolinNative,ability:{kind:'fluxViolinist',params:r=>({attackAnim:animation(r),scale:r.talents.bb['EmitProjectile.attack@atk_scale_2']})},
  explains:/^Attacks can travel along Realigned Flux, dealing damage to all connected units$/},
};
