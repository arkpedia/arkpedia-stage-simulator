// SPDX-License-Identifier: GPL-3.0-or-later
import {projectileSingleAttack} from './arkpedia-enemy-projectiles.js';
import {timedEnemyCasts} from './arkpedia-enemy-timed-casts.js';
import {addEnemyTileTrigger,enemyTileTriggerAt} from './arkpedia-enemy-tile-triggers.js';
import {areaSelectable,absoluteRangeKeys} from '../targeting.js';
import {bodyInKeys} from '../body.js';

export function dorothyTraps(p){
  const shot=projectileSingleAttack({type:'phys',speed:p.speed,lifetime:p.shotLifetime});
  const select=(b,e)=>{
    if(e.s.flags.disarm)return[];
    const row=Math.round(e.y),col=Math.round(e.x),tile=b.grid.tile(row,col);
    if(!b.grid.inRect(row,col)||Math.hypot(e.x-col,e.y-row)>p.radius+1e-9
      ||!['MELEE','ALL'].includes(tile.build)||enemyTileTriggerAt(b,row,col)
      ||b.allyUnits.some(u=>u.alive&&u.deployed&&u.tileR===row&&u.tileC===col))return[];
    return[{row,col}];
  };
  const casts=timedEnemyCasts([{initial:p.initial,cooldown:p.cooldown,cooldownFromEnd:true,
    clip:p.skillClip,duration:p.duration,release:p.release,slowDown:true,select,
    fire(b,e,[{row,col}]){
      const snapshot=e.s.atk*p.scale,keys=new Set(absoluteRangeKeys([[0,0]],row,col,'RIGHT'));
      addEnemyTileTrigger(b,{source:e,row,col,armDelay:p.armDelay,interval:p.interval,lifetime:p.lifetime,
        select:()=>b.allies(null,{includeTargetableDevices:true}).find(u=>!u.isFlying&&areaSelectable(e,u)&&bodyInKeys(u,keys)),
        onTrigger(target){
          const amount=e.alive?e.s.atk*p.scale:snapshot;
          b.dealDamage(e,target,{amount,type:'arts',isAttack:true,isSkill:false,applyWay:'ranged',tags:['enemyTileTrap']});
          if(e.alive){
            e.mem.dorothyTrapStacks=Math.min(p.maxStacks,(e.mem.dorothyTrapStacks??0)+1);
            b.addBuff(e,{key:'lydrty[atk_up]',source:e,persist:true,refresh:'replace',mods:{atkPct:p.atk*e.mem.dorothyTrapStacks}});
          }
          if(target.alive)b.applyStatus(target,'stun',{source:e,duration:p.stun});
        }});
    }}],{canCast:(_b,e)=>!e.s.flags.disarm});
  return{
    spawn(b,e,a){shot.spawn(b,e);casts.spawn(b,e,a);e.def={...e.def,attackAnim:p.attackAnim};},
    attack:shot.attack,tick:casts.tick,status:casts.status,death:casts.death,
  };
}
