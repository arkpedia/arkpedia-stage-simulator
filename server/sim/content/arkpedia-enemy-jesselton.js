// SPDX-License-Identifier: GPL-3.0-or-later
import { ordinaryEnemyAttackSequence } from './arkpedia-enemy-attack-sequence.js';
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
import { rebornAbility } from './enemies.js';
import { canTargetAlly, sortAllyTargets } from '../targeting.js';
import { liberatePrisoners } from './arkpedia-enemy-prisoner.js';
export function jesselton(p) {
  let attackState;
  const mode = { killer: false, reborn: false };
  const normal = projectileSingleAttack({ type: 'arts', speed: p.speed, lifetime: p.lifetime, noAir: true });
  const stun = projectileSingleAttack({ type: 'arts', speed: p.speed, lifetime: p.lifetime, noAir: true,
    onImpact: (b,e,u) => b.applyStatus(u,'stun',{duration:p.stun,source:e}) });
  const sequence = ordinaryEnemyAttackSequence((_b,_e,a) => p.animations[mode.killer ? a.charged ? 3 : 2 : a.charged ? 1 : 0],
    (b,e,u,c) => {
      if (c.animation.melee) b.dealDamage(e,u,{amount:e.s.atk,type:'phys',isAttack:true,isSkill:c.animation.skill,
        defIgnorePct:c.animation.skill?p.penetration:0,attackId:c.attackId,applyWay:'melee'});
      else (c.animation.skill?stun:normal).attack({targets:[u],attackId:c.attackId},b,e);
    });
  const form = e => {
    const suffix = mode.killer ? 'C2' : 'C1', idle = `${suffix}_Idle`, move = `${suffix}_Move`, die = `${suffix}_Die`;
    return { clip:e.moving?move:idle,idle,move,die,replace:true };
  };
  const attackClock = e => {
    const c=p.animations[mode.killer?2:0];e.def={...e.def,attackAnim:{dur:c.duration,hit:c.releases[0]}};
  };
  const controller = { ...sequence,
    spawn(b,e,a) {
      attackState=a;sequence.spawn(b,e,a);a.sp=p.initialSp;attackClock(e);e.profile.dmgType='arts';e.profile.melee=false;
      e.profile.canTarget=u=>!u.isFlying&&!u.s.flags.liftoff&&(mode.killer||!u.tags.has('prison'));
      b.addBuff(e,{key:'ab:jesseltonForm',persist:true,mods:{resFlat:p.res}});
    },
    before(c,b,e,a) {
      a.charged=a.sp>=p.cost&&!e.s.flags.silence;
      if(a.charged&&!mode.killer) {
        const targets=b.alliesInRadius(e.x,e.y,e.base.rangeRadius+.25,null)
          .filter(u=>canTargetAlly(e,u,true)&&e.profile.canTarget(u));
        sortAllyTargets(e,targets);c.targets=targets.slice(0,p.maxTargets);
      }
    },
    attack(c,b,e,a) {
      a.sp=a.charged?a.sp-p.cost:e.s.flags.noSp?a.sp:Math.min(p.cost,a.sp+p.increment);
      sequence.attack(c,b,e,a);
    },
    tick(b,e,a) {
      sequence.tick(b,e,a);
      if(mode.reborn) e.mem.regularFormVisual={clip:'C1_Die',die:'C1_Die',loop:false,replace:true,playId:'jesseltonRebirth'};
      else if(!a.cast)e.mem.regularFormVisual=form(e);
    },
    killed(_c,b,e,a) { sequence.cancel(b,e,a); },
    death(c,b,e,a) {sequence.death(c,b,e,a);const die=form(e).die;e.mem.regularFormVisual={clip:die,die,loop:false};},
  };
  const reborn = rebornAbility({dur:p.rebirth,
    onKo(b,e) {
      mode.reborn=true;liberatePrisoners(b,e);
    },
    onReborn(b,e) {
      mode.reborn=false;mode.killer=true;
      attackState.sp=0;attackState.charged=false;
      e.profile.dmgType='phys';e.profile.melee=true;
      b.removeBuff(e,'ab:jesseltonForm');b.addBuff(e,{key:'ab:jesseltonForm',persist:true,
        mods:{atkFlat:p.atk,defFlat:p.def,batFlat:p.bat,moveFlat:p.move}});
      attackClock(e);e.mem.regularFormVisual=form(e);
    },
  });
  return [controller,reborn];
}
