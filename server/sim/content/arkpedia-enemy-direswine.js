// SPDX-License-Identifier: GPL-3.0-or-later
import {areaSelectable} from '../targeting.js';
import {ALLY_COLLIDER_RADIUS} from '../constants.js';

const controlled=e=>{const f=e.s.flags;return !!(f.stun||f.freeze||f.levitate||f.noMove);};

/** Direswine rush. Every 0.1 s a free unit (not blocked, stunned, frozen,
 * levitated or bound) starts a rush with a fresh predelay; the rush's trigger
 * then fires every `interval` up to `limit` times, and each firing after the
 * predelay adds one additive Movement Speed stack (triggers during the
 * predelay use up the budget, as for the Lancers). Stun, freeze, levitate or
 * bind ends the rush; blocking does not. The first hit of an ordinary attack
 * during a rush adds a separate damage packet of `firstScale` x current
 * Movement Speed and ends the rush. While it moves under its own power, each
 * ally it touches takes `crashScale` x current Movement Speed (once per
 * contact) and an optional stun. */
export function direswineRush(p){
 validate(p);
 const stop=(b,e,a)=>{a.active=false;a.stacks=0;a.elapsed=0;a.triggers=0;b.removeBuff(e,'ab:rush');};
 // The amount is read from the current Movement Speed before anything resets it.
 const packet=(b,e,u,amount,tag)=>{if(u?.alive&&amount>0)b.dealDamage(e,u,{amount,type:'phys',isAttack:true,applyWay:'melee',noSp:true,tags:[tag]});};
 return {
  iv:.1,
  spawn(_b,_e,a){a.active=false;a.stacks=0;a.elapsed=0;a.triggers=0;a.contacts=new Map();},
  tick(b,e,a,dt){
   if(controlled(e)){if(a.active)stop(b,e,a);}
   else if(!a.active){if(!e.blockedBy){a.active=true;a.elapsed=0;a.triggers=0;a.readyAt=b.time+p.predelay;}}
   else{
    a.elapsed+=dt;
    while(a.elapsed+1e-9>=p.interval&&a.triggers<p.limit){
     a.elapsed-=p.interval;a.triggers++;
     if(b.time-a.elapsed<=a.readyAt+1e-9)continue;
     a.stacks++;b.addBuff(e,{key:'ab:rush',mods:{movePct:p.increase*a.stacks},persist:true});
    }
   }
   // Contact: allies within the crash hitbox, each once while it stays in contact.
   const near=e.alive&&e.moving?b.alliesInRadius(e.x,e.y,p.crashRadius+ALLY_COLLIDER_RADIUS).filter(u=>areaSelectable(e,u)):[];
   const present=new Set(near);for(const u of a.contacts.keys())if(!present.has(u))a.contacts.delete(u);
   for(const u of near){
    if(a.contacts.get(u)===u.deploySeq)continue;a.contacts.set(u,u.deploySeq);
    packet(b,e,u,e.s.moveSpeed*p.crashScale,'direswineCrash');
    if(p.crashStun>0&&u.alive)b.applyStatus(u,'stun',{duration:p.crashStun,source:e});
    if(!e.alive)return;
   }
  },
  dealt(c,b,e,a){
   if(!a.active||!c.dmg?.isAttack||c.dmg.tags?.some(t=>t==='direswineFirst'||t==='direswineCrash'))return;
   // As in the native template: the damage first, then the rush ends.
   const target=c.target,amount=e.s.moveSpeed*p.firstScale;stop(b,e,a);packet(b,e,target,amount,'direswineFirst');
  },
 };
}
function validate(p){
 const pos=v=>Number.isFinite(v)&&v>0,nn=v=>Number.isFinite(v)&&v>=0;
 if(!p||!pos(p.increase)||!pos(p.interval)||!Number.isSafeInteger(p.limit)||p.limit<1||p.limit>1000||!nn(p.predelay)
  ||!pos(p.firstScale)||!pos(p.crashScale)||!pos(p.crashRadius)||!nn(p.crashStun))throw Error('Invalid Direswine rush');
}
direswineRush.validate=validate;
