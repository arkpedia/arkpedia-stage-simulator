// SPDX-License-Identifier: GPL-3.0-or-later
/** Attack-recovery skill with multiple native animation events. One locked
 * target/life and one attack ID survive the sequence; control cancels future
 * strikes, and source Slow Down scales the cast rather than its SP recovery. */
export function chargedMeleeSequence({cost,initialSp,maxSp,increment,scale,duration,releases,clip='Skill'}) {
  const key='ab:chargedMeleeCast';
  const finish=(b,e,a)=>{
    a.cast=null;e.profile.noAttack=a.priorNoAttack;e.mem.regularFormVisual=null;e.skillAnimUntil=b.time;b.removeBuff(e,key);
    // The reviewed wrapper does not reset the ordinary attack cooldown.
  };
  return{
    spawn(_b,_e,a){a.charge=initialSp;a.sequence=0;},
    before(c,b,e,a){
      if(a.cast){c.targets=[];return;}
      if(a.charge<cost||e.s.flags.silence||!e.canAct||!c.targets[0])return;
      const target=c.targets[0];a.charge-=cost;a.priorNoAttack=e.profile.noAttack;
      a.cast={target,life:target.deploySeq,elapsed:0,last:b.time,index:0,attackId:++b._attackSeq};a.sequence++;
      e.profile.noAttack=true;b.addBuff(e,{key,flags:{noMove:true}});
      e.mem.regularFormVisual={clip,loop:false,speed:e.s.slowDownRate,playId:`chargedMelee:${a.sequence}`};
      e.skillAnimUntil=b.time+duration/Math.max(.001,e.s.slowDownRate);c.targets=[];
    },
    attack(_c,_b,_e,a){a.charge=Math.min(maxSp,a.charge+increment);},
    tick(b,e,a){
      const c=a.cast;if(!c)return;
      if(!e.canAct){finish(b,e,a);return;}
      c.elapsed+=(b.time-c.last)*e.s.slowDownRate;c.last=b.time;
      e.mem.regularFormVisual.speed=e.s.slowDownRate;
      while(a.cast===c&&c.index<releases.length&&c.elapsed+1e-7>=releases[c.index]){
        c.index++;const u=c.target;
        if(u.alive&&u.deployed&&!u.hidden&&u.deploySeq===c.life){
          b._ev(['atk',e.id,u.id,'none']);
          b.dealDamage(e,u,{amount:e.s.atk*scale,type:'phys',isAttack:true,isSkill:true,attackId:c.attackId,applyWay:'melee',tags:['chargedMelee']});
        }
        if(!e.alive)return;
      }
      if(a.cast!==c)return;
      e.skillAnimUntil=b.time+Math.max(0,duration-c.elapsed)/Math.max(.001,e.s.slowDownRate);
      if(c.elapsed+1e-7>=duration)finish(b,e,a);
    },
    status(_c,b,e,a){if(a.cast&&!e.canAct)finish(b,e,a);},
    death(_c,b,e,a){if(a.cast)finish(b,e,a);},
  };
}
