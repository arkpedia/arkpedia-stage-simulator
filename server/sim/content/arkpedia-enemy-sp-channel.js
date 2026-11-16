// SPDX-License-Identifier: GPL-3.0-or-later
import {animatedProjectileAttack} from './arkpedia-enemy-projectiles.js';
import {timedEnemyCasts} from './arkpedia-enemy-timed-casts.js';
import {addDeviceSp,selectedDeviceSpTargets} from './arkpedia-device-sp.js';
import {prepareBehaviorProgram,decodeBehaviorParameters} from '../../../shared/arkpedia/behavior-program.js';
import {validateEnemyAttackAnimation} from './arkpedia-enemy-attack-sequence.js';
/** Ordinary projectiles and a timed channel reuse the same cast scheduler.
 * A native trigger condition gates entry; it does not terminate a running cast. */
export function channelledSpEmitter(params){
 const program=validate(params),{attack,channel,selector,blackboard}=params;
 const shot=animatedProjectileAttack(attack);
 const clean=(b,e,a)=>{for(const buff of a.channelBuffs??[])b.removeBuff(e,buff);a.channelBuffs=[];};
 const spec={initial:channel.initial,cooldown:channel.cooldown,duration:channel.duration,release:0,clip:channel.begin.clip,slowDown:false,
  select:(_b,e)=>e.findBuff(channel.excludedBuff)?[]:[e],fire:()=>{},
  start(b,e,_cast,a){a.channelBuffs=[];const life=e.deploySeq;
   for(const key of [channel.buffKey,...channel.markerKeys]){
    const buff=b.addBuff(e,{key,source:e,refresh:'independent',maxStacks:Infinity,admit:u=>u.alive&&u.deployed&&u.deploySeq===life,
     ...(key===channel.buffKey?{interval:channel.interval,onTick:()=>{
      if(!e.alive||!e.deployed||e.deploySeq!==life)return;
      for(const target of selectedDeviceSpTargets(b,e,selector))program.run('ON_BUFF_START',{battle:b,unit:e,target,source:e,blackboard,spService:{add:(u,n)=>addDeviceSp(b,u,n)}});
     }}:{})});if(buff)a.channelBuffs.push(buff);
   }
  },finish(b,e,_cast,a){clean(b,e,a);},
  visual(_b,e,c){
   const edge=channel.begin.duration+channel.end.duration,scale=Math.min(1,channel.duration/edge),begin=channel.begin.duration*scale,end=channel.end.duration*scale;
   const part=c.elapsed<begin?'begin':c.elapsed<channel.duration-end?'loop':'end',clip=channel[part].clip;
   if(e.mem.regularFormVisual?.clip!==clip)e.mem.regularFormVisual={clip,loop:part==='loop',speed:part==='loop'?1:1/scale,playId:`spChannel:${e.id}:${e.deploySeq}:${c.visualSequence=(c.visualSequence??0)+1}:${part}`};
  }};
 const casts=timedEnemyCasts([spec],{beforeCast:(b,e,_index,a)=>shot.cancel(b,e,a.shot)});
 return{spawn(b,e,a){a.shot={};a.channelBuffs=[];shot.spawn(b,e,a.shot);casts.spawn(b,e,a);const prior=e.profile.canTarget;e.profile.canTarget=u=>(!u.isFlying||u===e.blockedBy)&&(!prior||prior(u));},
  attack(c,b,e,a){shot.attack(c,b,e,a.shot);},tick(b,e,a,dt){casts.tick(b,e,a,dt);shot.tick(b,e,a.shot,dt);},
  status(c,b,e,a){casts.status(c,b,e,a);shot.status(c,b,e,a.shot);},death(c,b,e,a){casts.death(c,b,e,a);shot.death(c,b,e,a.shot);clean(b,e,a);}};
}
function validate({attack,channel,selector,blackboard={},program,programComponent}){
 if(programComponent!==undefined)throw Error('Unhydrated behaviour program component');
 validateEnemyAttackAnimation(attack?.animation);
 if(!attack||!['phys','arts','true'].includes(attack.type)||!Number.isFinite(attack.speed)||attack.speed<=0||!Number.isFinite(attack.lifetime)||attack.lifetime<=0||attack.noAir!==false
  ||!channel||!Number.isFinite(channel.initial)||channel.initial<0||!Number.isFinite(channel.cooldown)||channel.cooldown<=0||!Number.isFinite(channel.duration)||channel.duration<=0||!Number.isFinite(channel.interval)||channel.interval<=0
  ||[channel.buffKey,channel.excludedBuff].some(k=>typeof k!=='string'||!k||k.length>256)||!Array.isArray(channel.markerKeys)||channel.markerKeys.length>16||new Set([channel.buffKey,...channel.markerKeys]).size!==channel.markerKeys.length+1||channel.markerKeys.some(k=>typeof k!=='string'||!k||k.length>256)
  ||['begin','end'].some(k=>!channel[k]||typeof channel[k].clip!=='string'||!channel[k].clip||!Number.isFinite(channel[k].duration)||channel[k].duration<=0)||!channel.loop||typeof channel.loop.clip!=='string'||!channel.loop.clip
  ||!selector||Object.keys(selector).sort().join()!=='maxTargets,side,tag'||typeof selector.tag!=='string'||!selector.tag||!['both','same','opposing'].includes(selector.side)||!Number.isSafeInteger(selector.maxTargets)||selector.maxTargets<1||selector.maxTargets>16)throw Error('Invalid SP channel');
 const p=prepareBehaviorProgram(program);p.validateServices(['sp']);p.validateBlackboard(blackboard);return p;
}
channelledSpEmitter.validate=validate;channelledSpEmitter.decodeParameters=decodeBehaviorParameters;
