// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-flux-saxophone-animations.json' with {type:'json'};
export function fluxSaxophoneNative(r,n) {
 if(!['enemy_1243_ltswar','enemy_1243_ltswar_2'].includes(r.prefabKey)||r.skills.length!==1||r.sp
  ||Object.keys(r.talents.bb).length||r.stats.dmgType!=='phys'||r.applyWay!=='ALL')return false;
 const skill=r.skills[0],rows=n.FourDirAttack??[],wrapper=rows.find(c=>'_familyMask'in c),cast=rows.find(c=>'_projectileKey'in c);
 const hook=n.$siblings(cast).find(c=>'_default'in c),root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]);
 const attack=n.$ref(mode?._attack),graphic=n.$ref(root?._animator),clock=clocks.enemies[r.prefabKey];
 const p=n.$projectile('projectile_enemy_ltswar'),motion=p.find(c=>'_speed'in c),life=p.find(c=>'_lifeTime'in c);
 const hit=p.find(c=>'_targetOptions'in c),circle=p.find(c=>'m_Radius'in c),stop=p.find(c=>'_delayCheck'in c);
 return skill.prefabKey==='FourDirAttack'&&skill.cooldown===20&&skill.initCooldown===10&&skill.spCost===0
  &&Object.keys(skill.bb).join()==='atk_scale'&&skill.bb.atk_scale===1.5&&!Object.keys(skill.bbStr).length
  &&root?._modes.length===1&&!root._commonAbilities.length&&!mode._generalAbilities.length
  &&mode._combat.m_PathID===mode._attack.m_PathID&&attack?._damageType===1&&attack._atkScale===1&&!attack._activeBuffs.length
  &&wrapper?._familyMask===3&&wrapper._ignoreSilence===0&&wrapper._maxTriggerTime===-1&&wrapper._castLikeAttack===0
  &&wrapper._resetMainAbilityCdWhenCastEnd===0&&wrapper._resetCdWaitFirstPeriod===1&&wrapper._immuneStunWhenAffecting===0
  &&n.$ref(wrapper._trigger)?.m_Script.m_PathID==='-2995189732062982133'
  &&cast?._projectileKey==='projectile_enemy_ltswar'&&cast._damageType===1&&cast._attackType===1&&cast._atkScale===1
  &&cast._atkScaleKey==='atk_scale'&&cast._allowNoTarget===1&&cast._useEightDirections===0&&cast._selector.m_PathID==='0'
  &&cast._preDelay===3&&cast._timeMode===2&&cast._waitForAttackEvent===1&&cast._escapeTime===0&&cast._affectedBySlowDown===0
  &&cast._animKey===''&&!cast._activeBuffs.length&&!cast._extraProjectileKeys.length
  &&hook?._default.beginAnim==='Skill_Begin'&&hook._default.loopAnim==='Skill_Loop'&&hook._default.endAnim==='Skill_End'
  &&hook._waitForAttachFinishEvent===0&&hook._fireAttackFinishEvent===0&&hook._delayToAnimateEndAnimation===0
  &&motion?._moveType===4&&motion._speed===9&&motion._delayToStart===0&&motion._deltaSpeedPerSec===0
  &&life?._lifeTime===60&&life._maxHitNum===1&&life._stopAfterMaxHit===1&&life._stopWhenSourceInvalid===0
  &&life._canHitSameTargetMultipleTimes===0&&!life._actionController._extraBuffsInTheEnd.length
  &&hit?._onlyCheckHitWhenReachTarget===0&&hit._goThroughWall===1&&hit._canFlyThroughTheDeathArea===0&&hit._ignoreCamouflage===0
  &&hit._targetOptions.targetSide===2&&hit._targetOptions.targetMotion===3&&hit._targetOptions.targetCategory===1&&!hit._targetOptions.ignoreTargetFree
  &&circle?.m_Radius===Math.fround(.2)&&circle.m_Offset.x===0&&circle.m_Offset.y===0
  &&stop?._delayCheck===Math.fround(.04)&&stop._delayStop===Math.fround(.04)
  &&n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID===clock.source.skeletonDataPathId
  &&['Attack','Skill_Begin','Skill_Loop','Skill_End'].every(key=>graphic._animations.some(a=>a.animKey===key&&a.animName===key&&a.speed===1&&a.loop===(key==='Skill_Loop'?1:0)))
  &&clock.durations.Attack===2.5&&clock.events.Attack?.[0]?.time===Math.fround(.8)
  &&clock.durations.Skill_Begin===Math.fround(1/3)&&clock.durations.Skill_End===Math.fround(65/30)
  &&clock.events.Skill_End?.length===1&&clock.events.Skill_End[0].name==='OnAttack'&&clock.events.Skill_End[0].time===Math.fround(.6);
}
export const FLUX_SAXOPHONE_FEATURES={
 'skill:FourDirAttack':{matchesRecord:r=>['enemy_1243_ltswar','enemy_1243_ltswar_2'].includes(r.prefabKey),covers:fluxSaxophoneNative,nativeClaim:()=>({wrappers:1}),
  explains:/^When blowing at full force, fires ranged attacks in all 4 directions, dealing high Physical damage to allies hit\. These attacks can be blocked by Realigned Flux$/,
  ability:{kind:'fluxSaxophonist',params:r=>{const c=clocks.enemies[r.prefabKey];return {
   initial:r.skills[0].initCooldown,cooldown:r.skills[0].cooldown,scale:r.skills[0].bb.atk_scale,
   begin:c.durations.Skill_Begin,charge:3,release:3+c.events.Skill_End[0].time,duration:3+c.durations.Skill_End,
   attackAnim:{dur:c.durations.Attack,hit:c.events.Attack[0].time},speed:9,lifetime:60,radius:Math.fround(.2),checkDelay:Math.fround(.04),stopDelay:Math.fround(.04)};}}},
};
