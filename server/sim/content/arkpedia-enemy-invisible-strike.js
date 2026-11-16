// SPDX-License-Identifier: GPL-3.0-or-later
import {stealthOffKey} from '../targeting.js';

// The invisibility buff itself is on: not blocked and not switched off after a
// block. An anti-invisibility reveal does not end the buff, so it is ignored.
const invisibilityOn=e=>{const f=e.s.flags;if(!f.stealth||e.blockedBy)return false;if(!f.stealthOff)return true;
 return e.buffs.some(b=>b.flags?.stealth&&!e.findBuff(stealthOffKey(b.key)));};

/** The first attack after breaking Invisibility deals more damage.
 *
 * The native invisibility buff's template leaves a permanent mark on its owner
 * when invisibility starts, and every 0.1 s while it lasts unless the owner
 * already holds the mark or the "spent" marker. The attack skill, which needs
 * the mark, scales the next attack's ATK and swaps the mark for the "spent"
 * marker; a new start of invisibility clears the "spent" marker again. The
 * mark outlives the invisibility, so the empowered attack is the one made once
 * a block has revealed the unit. */
export function invisibleStrike(p){
 validate(p);
 const grant=(b,e)=>{if(!e.findBuff(p.markKey)&&!e.findBuff(p.spentKey))b.addBuff(e,{key:p.markKey,source:e});};
 return {
  spawn(b,e,a){a.was=false;a.clock=0;},
  tick(b,e,a,dt){
   const on=e.alive&&invisibilityOn(e);
   if(on&&!a.was){b.removeBuff(e,p.spentKey);grant(b,e);a.clock=0;}
   else if(on){a.clock+=dt;while(a.clock+1e-9>=p.interval){a.clock-=p.interval;grant(b,e);}}
   a.was=on;
  },
  hitOut(c,b,e){
   if(c.source!==e||!c.dmg.isAttack||c.dmg.tags?.includes('dot')||!e.findBuff(p.markKey))return;
   c.dmg.amount*=p.scale;
   b.removeBuff(e,p.markKey);b.addBuff(e,{key:p.spentKey,source:e});
  },
  death(_c,b,e){b.removeBuff(e,p.markKey);b.removeBuff(e,p.spentKey);},
 };
}
function validate(p){
 const key=v=>typeof v==='string'&&!!v&&v.length<=256;
 if(!p||!(Number.isFinite(p.scale)&&p.scale>0&&p.scale<=100)||!(Number.isFinite(p.interval)&&p.interval>0)||!key(p.markKey)||!key(p.spentKey)||p.markKey===p.spentKey)
  throw Error('Invalid invisible strike');
}
invisibleStrike.validate=validate;
