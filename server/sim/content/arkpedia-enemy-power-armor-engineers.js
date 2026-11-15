// SPDX-License-Identifier: GPL-3.0-or-later
import {projectileSingleAttack} from './arkpedia-enemy-projectiles.js';
import {addEnemyPulseLink} from './arkpedia-enemy-links.js';
export function powerArmorEngineer(p){
  const shot=projectileSingleAttack({speed:10,lifetime:10,type:'arts',noAir:true});
  const key='ab:powerArmorRepair';
  const valid=t=>t?.alive&&t.deployed&&t.findBuff('lypa[car_mark]');
  const finish=(b,e,a,interrupted=false)=>{
    if(a.link)a.link.removed=true;a.link=null;a.target=null;a.left=p.cooldown;a.recovery=interrupted?0:p.recovery;
    if(interrupted){b.removeBuff(e,key);e.profile.noAttack=false;}
  };
  return{
    spawn(b,e,a){shot.spawn(b,e);e.def={...e.def,attackAnim:p.attackAnim};a.left=p.initial;a.recovery=0;a.sequence=0;},
    attack:shot.attack,
    tick(b,e,a,dt){
      if(a.target&&(!e.canAct||e.s.flags.silence||!valid(a.target)))finish(b,e,a,true);
      if(a.target){
        if(a.checkFullAt!=null&&b.time+1e-9>=a.checkFullAt){
          a.checkFullAt=b.time+Math.fround(.2);if(a.target.hp>=a.target.s.maxHp)finish(b,e,a,true);
        }
        return;
      }
      if(a.recovery>0){a.recovery-=dt;if(a.recovery<=1e-9){b.removeBuff(e,key);e.profile.noAttack=false;}return;}
      a.left-=dt;
      if(a.left>1e-9||!e.canAct||e.s.flags.silence)return;
      const target=b.enemies.filter(t=>valid(t)&&t.hp<t.s.maxHp&&Math.hypot(t.x-e.x,t.y-e.y)<=e.base.rangeRadius+.5)
        .sort((x,y)=>Math.hypot(x.x-e.x,x.y-e.y)-Math.hypot(y.x-e.x,y.y-e.y)||x.deploySeq-y.deploySeq)[0];
      if(!target)return;
      a.target=target;a.checkFullAt=null;a.sequence++;e.profile.noAttack=true;e.attackControlEpoch=(e.attackControlEpoch??0)+1;
      b.addBuff(e,{key,flags:{noMove:true}});
      a.link=addEnemyPulseLink(b,{source:e,target,duration:p.duration,
        valid:()=>e.alive&&e.canAct&&!e.s.flags.silence&&a.target===target&&valid(target),
        onPulse:()=>{b.heal(e,target,target.s.maxHp*p.ratio,{isSkill:true});a.checkFullAt??=b.time+Math.fround(.2);},
        onFinish:()=>{if(a.target===target)finish(b,e,a);},data:{powerArmorRepair:true}});
    },
    status(_c,b,e,a){if(a.target&&(!e.canAct||e.s.flags.silence))finish(b,e,a,true);},
    death(_c,b,e,a){if(a.target)finish(b,e,a,true);},
  };
}
