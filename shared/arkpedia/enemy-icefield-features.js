// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same, passiveOutcomeBuff } from './enemy-outcome-contracts.js';
const berserkers=['enemy_1193_krgbsk','enemy_1193_krgbsk_2'];
export const isIcefieldBerserker=r=>berserkers.includes(r.prefabKey);
const warriors=['enemy_1189_krgaxe','enemy_1189_krgaxe_2'];
const drones=['enemy_1188_krgdrn','enemy_1188_krgdrn_2'];
const hounds=['enemy_1187_krghd','enemy_1187_krghd_2'];
const casters=['enemy_1192_krgscr','enemy_1192_krgscr_2'];
const zero=r=>r?.m_FileID===0&&r.m_PathID==='0';
const empty=o=>o&&Object.keys(o).length===0;
function ordinary(r,n,ids,ranged,{allowTalents=false}={}){
 if(!ids.includes(r.prefabKey)||r.skills.length||r.sp||(!allowTalents&&!empty(r.talents.bb))||!empty(r.talents.bbStr)
  ||r.applyWay!==(ranged?'RANGED':'MELEE')||r.stats.dmgType!=='phys'||r.stats.motion!==(ranged?'FLY':'WALK'))return null;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]),attack=n.$ref(mode?._combat);
 if(root?._modes.length!==1||root._commonAbilities.length!==1||root._delayToBorn!==0||!mode?._generalAbilities.every(zero)
  ||attack?.m_Script.m_PathID!=='4381884627089348317'||attack._atkScale!==1||attack._damageType!==1||attack._attackType!==1
  ||attack._activeBuffs.length||!zero(attack._selector)||attack._epDamageRatio!==0||attack._extraDamageType!==0
  ||attack._preDelay!==0||attack._timeMode!==0||attack._waitForAttackEvent!==1
  ||(ranged?mode._attack.m_PathID!==mode._combat.m_PathID:!zero(mode._attack)||!zero(mode._attackTrigger)))return null;
 return {root,mode,attack,passive:n.$ref(root._commonAbilities[0])};
}
export function icefieldWarriorNative(r,n){
 const c=ordinary(r,n,warriors,false),effect=c?.passive;
 // This exact native NoCombat component has no actions, buffs or selector.
 // Its visual effect is separate from the ordinary melee damage behavior.
 return !!c&&effect?.m_Script.m_PathID==='4865767822664548221'&&zero(effect._selector)
  &&Object.keys(effect).sort().join()===['_attachPassiveBuffsOnDummy','_forceAsDmgOrHealAbility','_ignoreIfOwnerDead','_interruptAbilityOnDetach','_metadata','_selector','m_Enabled','m_GameObject','m_Name','m_Script'].sort().join()
  &&effect._forceAsDmgOrHealAbility===0&&effect._metadata.blackboardPrefix===''&&effect._metadata.namedAsAlias==='';
}
export function icefieldResistanceNative(r,n){
 if(isIcefieldBerserker(r))return icefieldBerserkerNative(r,n);
 if(casters.includes(r.prefabKey))return icefieldCasterNative(r,n);
 const ranged=drones.includes(r.prefabKey);
 const c=ordinary(r,n,ranged?drones:hounds,ranged);
 return !!c&&permanentResistanceNative(c.passive,n);
}
export function icefieldBerserkerNative(r,n){
 const c=ordinary(r,n,berserkers,false,{allowTalents:true}),passive=n.AtkUp?.[0];
 const key='enemy_krgbsk_t[frozen].atk_scale',scale=r.talents.bb[`atkup.${key}`];
 if(!c||!permanentResistanceNative(c.passive,n)||!same(r.talents.groups,{atkup:[key]})
  ||Object.keys(r.talents.bb).join()!==`atkup.${key}`||!Number.isFinite(scale)||scale<1
  ||passive?.m_Script.m_PathID!=='3800760148018415462'||!zero(passive._selector)||passive._buffs.length!==2)return false;
 const [cold,frozen]=passive._buffs;
 if(![cold,frozen].every(b=>passiveOutcomeBuff(b)&&b.stripBlackboardParamsWithBuffKey===1&&b.blackboard.length===0)
  ||cold.buffKey!=='enemy_krgbsk_t[cold]'||cold.templateKey!==cold.buffKey
  ||frozen.buffKey!=='enemy_krgbsk_t[frozen]'||frozen.templateKey!=='e2c_frozen_atkscale')return false;
 const node=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
 const check=flag=>({$type:node('CheckAbnormalFlag'),_abnormalFlag:flag,_targetType:'TARGET',_isUnset:false});
 const multiply={$type:node('AtkScaleUp'),_filterApplyWay:false,_filterProjectileKey:'',_applyWay:'NONE',
  _defaultValue:1,_filterNoneApplyWay:false,_cancelIfAtkScaleZero:false,_atkScaleKey:'atk_scale'};
 // The Cold-only branch has no blackboard scale, so its literal default is 1.
 return same(n.$template(cold.templateKey)?.eventToActions,{ON_CALCULATE_DAMAGE:[check('COLD'),check('FROZEN'),{$type:node('IfNot')},multiply]})
  &&same(n.$template(frozen.templateKey)?.eventToActions,{ON_CALCULATE_DAMAGE:[check('FROZEN'),multiply]});
}
function permanentResistanceNative(passive,n){
 const buff=passive?._buffs?.[0],db=n.$buff('status_resistance[inf]'),mod=db?.attributes.attributeModifiers?.[0];
 return passive?.m_Script.m_PathID==='3800760148018415462'&&zero(passive._selector)&&passive._buffs.length===1
  &&buff?.buffKey==='status_resistance[inf]'&&buff.loadFromDB===1&&buff.isSilenceable===0
  &&JSON.stringify(buff.blackboard)==='[{"key":"one_minus_status_resistance","value":-0.5,"valueStr":""}]'
  &&Object.values(buff.attributes).every(v=>Array.isArray(v)&&!v.length)
  &&db?.templateKey==='empty'&&db.lifeTimeType==='INFINITY'&&!db.isSilenceable&&!db.isStunnable&&!db.isFreezable
  &&db.overrideKey==='status_resistance[bonus]'&&db.maxStackCnt===1&&db.attributes.attributeModifiers.length===1
  &&Object.entries(db.attributes).filter(([k])=>k!=='attributeModifiers').every(([,v])=>v===null)
  &&mod?.attributeType==='ONE_MINUS_STATUS_RESISTANCE'&&mod.formulaItem==='FINAL_SCALER'&&mod.loadFromBlackboard&&!mod.fetchBaseValueFromSourceEntity;
}
export function icefieldCasterNative(r,n){
 if(!casters.includes(r.prefabKey)||r.skills.length!==1||r.applyWay!=='RANGED'||r.stats.dmgType!=='arts'||r.stats.motion!=='WALK'
  ||!empty(r.talents.bb)||!empty(r.talents.bbStr))return false;
 const s=r.skills[0],root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]);
 const ordinary=n.Attack?.find(c=>'_projectileKey'in c),cold=n.ColdAttack?.find(c=>'_projectileKey'in c),wrapper=n.ColdAttack?.find(c=>'_familyMask'in c);
 if(s.prefabKey!=='coldattack'||s.spCost!==2||s.cooldown!==0||s.initCooldown!==0||s.priority!==0||Object.keys(s.bb).join()!=='freeze'
  ||!Number.isFinite(s.bb.freeze)||s.bb.freeze<=0||!empty(s.bbStr)||r.sp?.type!=='INCREASE_WHEN_ATTACK'||r.sp.maxSp!==2||r.sp.increment!==1
  ||!Number.isInteger(r.sp.initSp)||r.sp.initSp<0||r.sp.initSp>2||root?._modes.length!==1||root._commonAbilities.length!==1||mode?._generalAbilities.length!==0
  ||!permanentResistanceNative(n.$ref(root._commonAbilities[0]),n))return false;
 const keys=['projectile_enemy_krgscr','projectile_enemy_krgscr _s1'];
 for(const [i,a] of [ordinary,cold].entries()){
  const target=n.$ref(a?._selector),p=n.$projectile(keys[i]),motion=p.find(c=>'_speed'in c),life=p.find(c=>'_lifeTime'in c);
  if(a?._projectileKey!==keys[i]||a._atkScale!==1||a._damageType!==2||a._attackType!==1||a._preDelay!==0||a._timeMode!==0
   ||a._waitForAttackEvent!==1||a._useCachedAtkOnly!==0||a._extraProjectileKeys.length||a._activeBuffs.length!==i
   ||target?._maxNum!==2||target._limitTargetNum!==1||target._targetSide!==2||target._targetMotion!==1||target._targetCategory!==1
   ||target._forceIgnoreCamouflage!==0||target._ignoreTargetFree!==0
   ||motion?._speed!==10||motion._moveType!==1||motion._delayToStart!==0||motion._deltaSpeedPerSec!==0||motion._forceReachedWhenTimeup!==1
   ||life?._lifeTime!==10||life._maxHitNum!==1||life._stopWhenSourceInvalid!==0||life._hitNumType!==1||life._stopAfterMaxHit!==1
   ||life._actionController._dontAddBuffs!==0||life._actionController._extraBuffsInTheEnd.length)return false;
 }
 const buff=cold._activeBuffs[0];
 return wrapper?._familyMask===3&&wrapper._ignoreSilence===0&&zero(wrapper._trigger)&&wrapper._castLikeAttack===0&&wrapper._maxTriggerTime===-1
  &&wrapper._resetCdWaitFirstPeriod===1&&wrapper._resetMainAbilityCdWhenCastEnd===0&&wrapper._overwriteInitCooldown===-1
  &&buff.buffKey==='e2c_cold'&&buff.loadFromDB===1&&buff.statusResistable===2&&buff.isDamageMissable===0&&buff.lifeTimeType===1;
}
export const ICEFIELD_FEATURES={
 'native:icefieldWarrior':{covers:icefieldWarriorNative,nativeClaim:()=>({active:1}),note:'Ordinary physical melee; the reviewed NoCombat helper adds no combat state. Native attached effect not rendered.'},
 'ability:Gains <$ba.buffres>status resistance</>':{covers:icefieldResistanceNative,nativeClaim:()=>({active:1}),
  ability:{kind:'permanentStatusResistance',params:()=>({value:.5})}},
};
