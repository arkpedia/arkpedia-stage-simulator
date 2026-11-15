// SPDX-License-Identifier: GPL-3.0-or-later
/** Source sequence: release block, lock that target, opening strike, repeat
 * complete two-hit clips while the ten-second mark survives, then recover. */
export function heavyPowerArmor(p){
  const key='ab:heavyArmorPunch';
  const finish=(b,e,a)=>{
    a.cast=null;a.left=p.cooldown;e.profile.noAttack=false;e.mem.regularFormVisual=null;e.skillAnimUntil=b.time;
    b.removeBuff(e,key);b.removeBuff(e,'lybgpa[keep_punch]');
  };
  const enter=(b,e,a,phase)=>{
    const c=a.cast;c.phase=phase;c.elapsed=0;c.index=0;c.attackId=++b._attackSeq;
    const clip={begin:'Skill_Begin',loop:'Skill_Loop',end:'Skill_End'}[phase];
    e.mem.regularFormVisual={clip,loop:false,speed:phase==='end'?p.endClip/p.recovery:e.s.slowDownRate,playId:`heavyArmor:${++a.sequence}`};
  };
  const start=(b,e,a,target)=>{
    if(a.cast||a.left>1e-9||!e.canAct||e.s.flags.silence||!target?.alive)return false;
    a.cast={target,life:target.deploySeq,until:b.time+p.duration,last:b.time};
    e.profile.noAttack=true;e.attackControlEpoch=(e.attackControlEpoch??0)+1;
    b.addBuff(e,{key,flags:{noMove:true}});b.addBuff(e,{key:'lybgpa[keep_punch]',duration:p.duration});
    b._unblock(e);enter(b,e,a,'begin');return true;
  };
  const valid=c=>c.target.alive&&c.target.deployed&&!c.target.hidden&&c.target.deploySeq===c.life;
  return{
    spawn(_b,e,a){a.left=p.initial;a.sequence=0;e.def={...e.def,attackAnim:p.attackAnim};},
    before(c,b,e,a){if(a.cast||start(b,e,a,c.targets[0]))c.targets=[];},
    tick(b,e,a,dt){
      if(!a.cast){a.left-=dt;if(e.blockedBy)start(b,e,a,e.blockedBy);return;}
      const c=a.cast;
      if(!e.canAct||e.s.flags.silence){finish(b,e,a);return;}
      if(c.phase!=='end'&&!valid(c))enter(b,e,a,'end');
      const rate=c.phase==='end'?1:e.s.slowDownRate;c.elapsed+=(b.time-c.last)*rate;c.last=b.time;
      if(e.mem.regularFormVisual&&c.phase!=='end')e.mem.regularFormVisual.speed=rate;
      const duration=c.phase==='begin'?p.begin:c.phase==='loop'?p.loop:p.recovery;
      const releases=c.phase==='begin'?p.firstHits:c.phase==='loop'?p.loopHits:[];
      while(a.cast===c&&c.index<releases.length&&c.elapsed+1e-7>=releases[c.index]){
        c.index++;if(!valid(c)){enter(b,e,a,'end');break;}
        const target=c.target;
        b._ev(['atk',e.id,target.id,'none']);
        b.dealDamage(e,target,{amount:e.s.atk*p.scale,type:'phys',isAttack:true,isSkill:true,attackId:c.attackId,applyWay:'melee',tags:['heavyArmorPunch']});
        if(target.alive)b.applyStatus(target,'stun',{source:e,duration:p.stun});
        if(!e.alive||a.cast!==c)return;
      }
      if(a.cast!==c)return;
      e.skillAnimUntil=b.time+Math.max(0,duration-c.elapsed)/Math.max(.001,rate);
      if(c.elapsed+1e-7>=duration){
        if(c.phase==='end')finish(b,e,a);
        else enter(b,e,a,valid(c)&&b.time+1e-7<c.until?'loop':'end');
      }
    },
    status(_c,b,e,a){if(a.cast&&(!e.canAct||e.s.flags.silence))finish(b,e,a);},
    death(_c,b,e,a){if(a.cast)finish(b,e,a);},
  };
}
