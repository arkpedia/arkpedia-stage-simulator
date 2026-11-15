// SPDX-License-Identifier: GPL-3.0-or-later
import {timedEnemyCasts} from './arkpedia-enemy-timed-casts.js';
import {canTargetAlly} from '../targeting.js';
import {ALLY_COLLIDER_RADIUS} from '../constants.js';
import {segmentCircleEntry,segmentRectangleEntry} from '../projectile-collision.js';

/** Four independent straight colliders. Shared transport owns slowdown, expiry
 * and interception; the source Flux field supplies its current occupied cells. */
export function fireFluxSaxophone(b,e,p) {
 const cached=e.s.atk*p.scale,attackId=++b._attackSeq;
 const size=b.regularMapSize??b.grid;
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
  b.addProjectile({from:e,source:e,to:{x:e.x+dx*p.speed*p.lifetime,y:e.y+dy*p.speed*p.lifetime},
   speed:p.speed,maxAge:p.lifetime,expireInPlace:true,visual:'arrow',data:{arkpediaTrackedVisual:true,fluxSaxophone:true},
   onMove({projectile:shot,previous,x,y}) {
    const endAge=Math.min(shot.age,shot.maxAge),elapsed=endAge-previous.age;
    let end={x,y};
    const circuit=b.stageMagicCircuit;
    if(circuit&&shot.data.fluxStopAt==null&&endAge>=p.checkDelay) {
     circuit.refresh();
     const startAge=Math.max(previous.age,p.checkDelay),fraction=elapsed>0?(startAge-previous.age)/elapsed:0;
     const from={x:previous.x+(x-previous.x)*fraction,y:previous.y+(y-previous.y)*fraction};
     let first=null;
     for(const key of circuit.field.occupied.keys()) {
      const [row,col]=key.split(',').map(Number);
      const t=segmentRectangleEntry(from,end,{minX:col-.5,maxX:col+.5,minY:row-.5,maxY:row+.5});
      if(t!=null&&(first==null||t<first))first=t;
     }
     if(first!=null) {
      shot.data.fluxStopAt=startAge+(endAge-startAge)*first+p.stopDelay;
      shot.maxAge=Math.min(shot.maxAge,shot.data.fluxStopAt);
     }
    }
    if(shot.data.fluxStopAt!=null&&shot.data.fluxStopAt<endAge&&elapsed>0) {
     const fraction=Math.max(0,(shot.data.fluxStopAt-previous.age)/elapsed);
     end={x:previous.x+(x-previous.x)*fraction,y:previous.y+(y-previous.y)*fraction};shot.x=end.x;shot.y=end.y;
    }
    const hits=b.allies(null,{includeTargetableDevices:true}).flatMap(u=>{
     if(!canTargetAlly(e,u,true))return [];
     const t=segmentCircleEntry(previous,end,u,p.radius+ALLY_COLLIDER_RADIUS);
     return t==null?[]:[{u,t}];
    }).sort((a,z)=>a.t-z.t||a.u.deploySeq-z.u.deploySeq);
    if(hits.length) {
     const {u,t}=hits[0];shot.x=previous.x+(end.x-previous.x)*t;shot.y=previous.y+(end.y-previous.y)*t;shot.removed=true;
     b.dealDamage(e,u,{amount:e.alive?e.s.atk*p.scale:cached,type:'phys',isAttack:true,applyWay:'ranged',attackId,tags:['fluxSaxophone']});
    } else if(shot.age>=shot.maxAge-1e-9||end.x<-.5||end.y<-.5||end.x>size.cols-.5||end.y>size.rows-.5)shot.removed=true;
   }});
 }
}

export function fluxSaxophonist(p) {
 const casts=timedEnemyCasts([{...p,clip:'Skill_Begin',select:()=>[true],fire:(b,e)=>fireFluxSaxophone(b,e,p)}]);
 return {...casts,
  spawn(b,e,a){casts.spawn(b,e,a);e.profile.melee=true;e.def={...e.def,attackAnim:p.attackAnim};},
  tick(b,e,a,dt){
   casts.tick(b,e,a,dt);if(!a.cast)return;
   const elapsed=a.cast.elapsed,phase=elapsed<p.begin?'Skill_Begin':elapsed<p.charge?'Skill_Loop':'Skill_End';
   e.mem.regularFormVisual={clip:phase,loop:phase==='Skill_Loop',speed:1,playId:`saxophone:${a.sequence}:${phase}`};
  },
 };
}
