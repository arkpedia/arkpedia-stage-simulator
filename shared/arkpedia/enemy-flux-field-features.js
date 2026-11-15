// SPDX-License-Identifier: GPL-3.0-or-later
import { FLUX_CUTOFF_RANGE } from './enemy-flux-ranges.js';
import clocks from '../../data/arkpedia-flux-field-animations.json' with {type:'json'};
const type=n=>`Torappu.Battle.Action.Nodes+${n}, Assembly-CSharp`;
export function fluxFieldCasterNative(r,n) {
 if(!['enemy_1244_ltssch','enemy_1244_ltssch_2'].includes(r.prefabKey)||r.skills.length||r.sp||Object.keys(r.talents.bb).length
   ||r.applyWay!=='RANGED'||r.stats.atk!==0)return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]),a=n.$ref(mode?._attack);
 const target=n.$ref(a?._sourceSelector),graphic=n.$ref(root?._animator),clock=clocks.enemies[r.prefabKey],binding=graphic?._animations.find(a=>a.animKey==='Attack');
 return root?._modes.length===1&&!root._commonAbilities.length&&!mode._generalAbilities.length
  &&mode._combat.m_PathID===mode._attack.m_PathID&&a?._enemyKey==='enemy_1245_ltseal'
  &&a._selectTargetSource===2&&a._timeMode===0&&a._waitForAttackEvent===1&&a._affectedBySlowDown===1&&a._preDelay===0
  &&a._noEndPosition===1&&a._unharmful===1&&a._alwaysCountAsKilled===1&&a._waitTime===0&&a._offset===0
  &&a._summonOnCastStart===0&&a._rootTileAsCenter===0&&a._summonToAllTile===0&&!a._buffsToEnemy.length&&!a._activeBuffs.length
  &&a._finishSummonedWhenOwnerFinish===0&&target?._targetSide===2&&target._targetMotion===3&&target._targetCategory===1
  &&target._postFilter===4&&target._ignoreTargetFree===0&&target._forceIgnoreCamouflage===0&&target._maxNum===1
  &&target._secondaryFilter===3&&target._buffKey==='character_in_magiccircuit[normal]'&&target._withoutThisBuff===0
  &&target._excludeEnemyInRootTileAtFirst==='enemy_1245_ltseal'
  &&!!clock&&n.$ref(graphic._skeleton)?.skeletonDataAsset.m_PathID===clock.source.skeletonDataPathId
  &&binding?.animName==='Attack'&&binding.speed===1&&binding.loop===0&&clock.durations.Attack===Math.fround(2.8)
  &&clock.events.Attack?.length===1&&clock.events.Attack[0].name==='OnAttack'&&clock.events.Attack[0].time===Math.fround(65/30);
}
export function crimsonFormationNative(r,n) {
 if(r.prefabKey!=='enemy_1245_ltseal'||r.skills.length||r.sp||r.applyWay!=='NONE'||r.stats.maxHp!==5||r.stats.atk!==150||r.stats.lpr!==0
  ||JSON.stringify(r.talents.bb)!=='{"Life.duration":10,"Life.hp_ratio":0.5,"Attack.hp_ratio":0.5,"Attack.duration":10}'
  ||r.talents.bbStr['Life.range_id']!=='x-5'||r.talents.bbStr['Attack.range_id']!=='0-1')return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]);
 const life=n.Life?.find(c=>'_buffs'in c)?._buffs[0],a=n.Attack?.find(c=>'_targetValidator'in c),target=n.$ref(a?._targetValidator)?._targetOptions;
 const buff=a?._buffs[0],events=n.$template('enemy_ltseal_t')?.eventToActions;
 const child=n.$template('enemy_ltseal_t[damage]')?.eventToActions.ON_BUFF_START?.[0];
 const dmg=n.$template('apply_damage[magic][on_trigger]')?.eventToActions.ON_BUFF_TRIGGER;
 return root?.m_Script.m_PathID==='-8226928637605576427'&&root._modes.length===1&&!root._commonAbilities.length
  &&mode?._combat.m_PathID==='0'&&mode._attack.m_PathID==='0'&&!mode._generalAbilities.length
  &&life?.templateKey==='enemy_ltseal_t'&&life.lifeTimeType===1&&!life.isSilenceable
  &&JSON.stringify(life.attributes.abnormalFlags)==='[13,8,3,22]'
  &&JSON.stringify(life.attributes.abnormalImmunes)==='[0,25,23,12,16]'&&JSON.stringify(life.attributes.abnormalComboImmunes)==='[0,1]'
  &&events?.ON_BUFF_START.length===2&&events.ON_BUFF_START[0].$type===type('SetMagicCircuitLikeObstacleInRange')
  &&events.ON_BUFF_START[0]._isLikeObstacle&&events.ON_BUFF_START[0]._rangeId==null
  &&events.ON_BUFF_FINISH.length===3&&!events.ON_BUFF_FINISH[0]._isLikeObstacle&&events.ON_BUFF_FINISH[2].$type===type('InstantKill')
  &&a._removeBuffWhenTargetLeave===1&&a._removeBuffWhenAbilityDetached===1&&a._onlyAddBuffOnceForEachTarget===0
  &&target?.targetSide===2&&target.targetMotion===1&&target.targetCategory===1&&target.ignoreTargetFree===0
  &&buff?.templateKey==='enemy_ltseal_t[damage]'&&!buff.isSilenceable&&!buff.isDamageMissable&&buff.lifeTimeType===1
  &&JSON.stringify(buff.attributes.abnormalFlags)==='[0]'&&child?.$type===type('CreateBuff')
  &&child._buff.templateKey==='apply_damage[magic][on_trigger]'&&child._buff.triggerInterval===1
  &&child._buff.firstTriggerInterval===Math.fround(.9)&&child._buff.waitFirstTriggerInterval
  &&dmg?.length===1&&dmg[0].$type===type('AdvancedApplyDamage')&&dmg[0]._damageType==='MAGICAL'
  &&dmg[0]._defaultAtkScale===1&&dmg[0]._applyWay==='NONE'&&dmg[0]._ignoreForSp
  &&JSON.stringify(n.$range('x-5')?.grids.map(p=>[p.row,p.col]))===JSON.stringify(FLUX_CUTOFF_RANGE);
}
export const FLUX_FIELD_FEATURES={
 'ability:Prioritizes targets on Realigned Flux, <$ba.stun>Stunning</> them and continually dealing Arts damage while cutting off nearby Realigned Flux': {
  covers:fluxFieldCasterNative,dependsOn:()=>['enemy_1245_ltseal'],ability:{kind:'fluxFieldCaster',params:r=>({
   child:'enemy_1245_ltseal',attackAnim:{dur:clocks.enemies[r.prefabKey].durations.Attack,hit:clocks.enemies[r.prefabKey].events.Attack[0].time}})}},
 'talent:Life':{covers:crimsonFormationNative,ability:{kind:'crimsonFormation',params:r=>({duration:r.talents.bb['Life.duration'],first:Math.fround(.9),interval:1})}},
};
