// SPDX-License-Identifier: GPL-3.0-or-later
import {animatedProjectileAttack} from './arkpedia-enemy-projectiles.js';
import {validateEnemyAttackAnimation} from './arkpedia-enemy-attack-sequence.js';
import {timedEnemyCasts} from './arkpedia-enemy-timed-casts.js';
import {sameSideEnemyAuraTarget} from './arkpedia-enemy-aura-targets.js';
import {changeEnemyEnergy} from './arkpedia-enemy-energy.js';
import {prepareBehaviorProgram,decodeBehaviorParameters} from '../../../shared/arkpedia/behavior-program.js';
/** One attack channel composes the existing projectile and timed-cast helpers.
 * The released grant buff has its own lifetime and continues after Skill ends. */
export function energyRangedEmitter(params){
 const reward=validate(params),{attackAnimation,skillAnimation,initial,cooldown,duration,interval,radius,parentKey,blackboard,speed,lifetime,type='phys',groundOnly=true}=params;
 const shot=animatedProjectileAttack({animation:attackAnimation,type,speed,lifetime,noAir:false});
 return{
  spawn(b,e,a){
   a.shot={};a.skill={};a.grants=new Set();a.life=e.deploySeq;shot.spawn(b,e,a.shot);
   const prior=e.profile.canTarget;if(groundOnly)e.profile.canTarget=unit=>!unit.isFlying&&(!prior||prior(unit));
   const fire=(b,e)=>{
    if(!e.alive||!e.deployed||e.deploySeq!==a.life)return;
    const buff=b.addBuff(e,{key:parentKey,source:e,duration,interval,flags:{noMove:true},onTick:()=>{
     if(!e.alive||!e.deployed||e.deploySeq!==a.life||!e.buffs.includes(buff))return;
     for(const unit of [...b.units]){
      if(!e.alive||!e.deployed||e.deploySeq!==a.life||!e.buffs.includes(buff))break;
      if(!sameSideEnemyAuraTarget(e,unit)||Math.hypot(unit.x-e.x,unit.y-e.y)>radius+1e-9)continue;
      reward.run('ON_BUFF_START',{battle:b,unit,blackboard,energyService:{add:(owner,amount)=>changeEnemyEnergy(b,owner,amount)}});
     }
    },onExpire:()=>a.grants.delete(buff),onRemove:()=>a.grants.delete(buff)});
    if(buff){if(!e.alive||!e.deployed||e.deploySeq!==a.life)b.removeBuff(e,buff);else a.grants.add(buff);}
   };
   a.cast=timedEnemyCasts([{initial,cooldown,duration:skillAnimation.duration,release:skillAnimation.releases[0],clip:skillAnimation.clip,slowDown:true,select:()=>[e],fire}],
    {silenceable:false,beforeCast:()=>shot.cancel(b,e,a.shot)});
   a.cast.spawn(b,e,a.skill);
  },
  attack(c,b,e,a){shot.attack(c,b,e,a.shot);},
  tick(b,e,a,dt){a.cast.tick(b,e,a.skill,dt);shot.tick(b,e,a.shot,dt);},
  status(c,b,e,a){shot.status(c,b,e,a.shot);a.cast.status(c,b,e,a.skill);},
  death(c,b,e,a){shot.death(c,b,e,a.shot);a.cast.death(c,b,e,a.skill);for(const buff of [...a.grants])b.removeBuff(e,buff);a.grants.clear();},
 };
}
function validate(p){
 if(p.programComponent!==undefined)throw Error('Unhydrated behaviour program component');
 const{attackAnimation,skillAnimation,initial,cooldown,duration,interval,radius,parentKey,speed,lifetime,blackboard={},type='phys',groundOnly=true}=p;
 validateEnemyAttackAnimation(attackAnimation);validateEnemyAttackAnimation(skillAnimation);
 if(!['phys','arts','true'].includes(type)||typeof groundOnly!=='boolean'||skillAnimation.releases.length!==1||!Number.isFinite(initial)||initial<0||!Number.isFinite(cooldown)||cooldown<=0
  ||!Number.isFinite(duration)||duration<=0||cooldown<duration||!Number.isFinite(interval)||interval<=0||interval>duration||!Number.isFinite(radius)||radius<=0||radius>128
  ||typeof parentKey!=='string'||!parentKey||parentKey.length>256||!Number.isFinite(speed)||speed<=0||!Number.isFinite(lifetime)||lifetime<=0)throw Error('Invalid energy ranged emitter');
 const reward=prepareBehaviorProgram(p.program);reward.validateServices(['energy']);reward.validateBlackboard(blackboard);return reward;
}
energyRangedEmitter.validate=validate;
energyRangedEmitter.decodeParameters=decodeBehaviorParameters;
energyRangedEmitter.requires=Object.freeze(['native-energy']);
