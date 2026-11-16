// SPDX-License-Identifier: GPL-3.0-or-later
import {stealthOffKey} from '../targeting.js';
import {stageOutcomeCounter} from './arkpedia-stage-outcomes.js';
/** Shared birth-phase mapping: the source delay holds movement, targeting and
 * attacks while an optional original clip plays. Effect/mesh bodies can omit
 * a Spine clip instead of inventing one. This follows the existing image
 * birth mapping; it is not a claim about compiled native frame ordering. */
export function passiveEnemyBody({immunities=[],birthDelay=0,birthDuration=birthDelay,birthClip='Start',birthLoop=false,attackAnim,markerKeys=[]}){
  const clearVisual=(e,a)=>{
    if(a.visual&&e.mem.regularFormVisual?.playId===a.visual)e.mem.regularFormVisual=null;
    a.visual=null;
  };
  return {
    spawn(b,e,a){
      e.def={...e.def,immune:new Set([...e.def.immune,...immunities]),...(attackAnim?{attackAnim}: {})};
      for(const key of markerKeys)b.addBuff(e,{key,persist:true});
      if(!(birthDelay>0))return;
      if(birthClip!==null){
        a.visual=`passiveBirth:${e.id}:${e.deploySeq}`;a.visualEnd=b.time+birthDuration;
        e.mem.regularFormVisual={clip:birthClip,loop:birthLoop,speed:1,playId:a.visual};
      }
      b.addBuff(e,{key:'ab:passiveBirth',duration:birthDelay,flags:{noMove:true,disarm:true,unblockable:true,untargetable:true,invulnerable:true}});
    },
    tick(b,e,a){
      if(a.visual&&b.time+1e-9>=a.visualEnd){
        clearVisual(e,a);
      }
    },
    death(_c,_b,e,a){clearVisual(e,a);},
  };
}
export const loggedEnemyBody=p=>[passiveEnemyBody(p),stageOutcomeCounter({killedKey:p.killedKey})];

/** A removable native stealth attachment uses the engine's existing blocker
 * reveal/restoration path with its authored delay. */
export function nativeStealth(params){
 nativeStealth.validate(params);const{key,restoreDelay}=params;
 return{spawn(b,e,a){a.life=e.deploySeq;a.buff=b.addBuff(e,{key,source:e,flags:{stealth:true},data:{stealthRestore:restoreDelay},refresh:'independent',maxStacks:Infinity,admit:u=>u.alive&&u.deployed&&u.deploySeq===a.life});},
  death(_c,b,e,a){if(a.buff)b.removeBuff(e,a.buff);a.buff=null;b.removeBuff(e,stealthOffKey(key));}};
}
nativeStealth.validate=({key,restoreDelay})=>{if(typeof key!=='string'||!key||key.length>256||!Number.isFinite(restoreDelay)||restoreDelay<0)throw Error('Invalid native stealth attachment');};
