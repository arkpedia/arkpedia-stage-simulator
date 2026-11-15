// SPDX-License-Identifier: GPL-3.0-or-later
import {stageOutcomeCounter} from './arkpedia-stage-outcomes.js';
/** Shared birth-phase mapping: the source delay holds movement, targeting and
 * attacks while its original Start clip plays. This follows the existing image
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
      a.visual=`passiveBirth:${e.id}:${e.deploySeq}`;a.visualEnd=b.time+birthDuration;
      e.mem.regularFormVisual={clip:birthClip,loop:birthLoop,speed:1,playId:a.visual};
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
