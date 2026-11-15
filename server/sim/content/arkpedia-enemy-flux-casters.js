// SPDX-License-Identifier: GPL-3.0-or-later
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
import { areaSelectable } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { absoluteRangeKeys } from '../targeting.js';
import { FLUX_SPLASH_RANGE as splashRange } from '../../../shared/arkpedia/enemy-flux-ranges.js';
export function fluxSplashCaster({attackAnim,scale}) {
  const shot=projectileSingleAttack({speed:10,lifetime:10,type:'arts',onImpact(b,e,target,{amount,attackId}){
    if(b.stageMagicCircuit?.contains(target))return;
    const keys=new Set(absoluteRangeKeys(splashRange,Math.round(target.y),Math.round(target.x),'RIGHT'));
    for(const u of b.allies(null,{includeTargetableDevices:true})) {
      if(u===target || !areaSelectable(e,u) || !bodyInKeys(u,keys))continue;
      b.addBuff(u,{key:'enemy_ltmage_t[aoe]',source:e,duration:Math.fround(.1)});
      b.dealDamage(e,u,{amount:amount*scale,type:'arts',isAttack:true,noSp:true,applyWay:'melee',attackId,tags:['fluxSplash']});
    }
  }});
  return {spawn(b,e){shot.spawn(b,e);e.def={...e.def,attackAnim};e.profile.maxTargets=2;},attack:shot.attack};
}
export function fluxViolinist({attackAnim,scale}) {
  const launch=(b,e,from,target,attackId,amount,direction,visited)=>{
    visited.add(target);
    b.addProjectile({from,target,source:e,speed:10,maxAge:5,expireInPlace:true,visual:'arts',
      onHit({target:u,x,y}){
        if(!u?.alive || !u.deployed || Math.hypot(x-u.x,y-u.y)>1e-6)return;
        const raw=e.alive?e.s.atk:amount;
        b.dealDamage(e,u,{amount:raw*(direction?scale:1),type:'arts',isAttack:true,applyWay:'ranged',attackId,
          tags:[direction?'fluxPropagation':'enemyProjectile']});
        for(const d of direction?[direction]:[1,-1]) {
          const next=b.stageMagicCircuit?.nextConnected(u,d,visited);
          if(next)launch(b,e,u,next,attackId,amount,d,visited);
        }
      }});
  };
  return {spawn(_b,e){e.profile.deferHit=true;e.profile.shot='none';e.def={...e.def,attackAnim};
      e.profile.targetPriority='withBuff';e.profile.priorityBuff='character_in_magiccircuit[normal]';},
    attack(c,b,e){for(const target of c.targets)launch(b,e,e,target,b._attackSeq,e.s.atk,0,new Set());}};
}
