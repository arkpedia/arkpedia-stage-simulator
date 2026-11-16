// SPDX-License-Identifier: GPL-3.0-or-later
import {OwnedStageAura} from './arkpedia-stage-auras.js';
import {ADD_KEYS,MUL_KEYS} from '../buffs.js';
import {bodyInRadius} from '../body.js';
/** Native same-side circle grants share one named effect. Multiple owners
 * retain independent membership, so removing one owner restores the survivor. */
export function nativeCircleStatAura(params){
 validate(params);const{key,radius,mods,strength,includeDevices,silenceable}=params;
 const update=(b,e,a)=>{
  if(!a.aura)return;
  const active=e.alive&&e.deployed&&!e.hidden&&!e.removed&&e.deploySeq===a.life&&!(silenceable&&e.s.flags.silence);
  a.aura.update(active?b.units.filter(u=>u!==e&&u.side===e.side&&u.alive&&u.deployed&&!u.hidden&&!u.removed
   &&(u.kind!=='device'||includeDevices&&!u.obstacle)&&!u.s.flags.untargetable&&!u.s.flags.isolated&&!u.s.flags.sleep
   &&bodyInRadius(u,e.x,e.y,radius)):[]);
  if(!e.alive||!e.deployed||e.deploySeq!==a.life)a.aura.clear();
 };
 return{
  spawn(b,e,a){a.life=e.deploySeq;a.aura=new OwnedStageAura(b,e,{key,strength,mods});update(b,e,a);
   for(const event of ['enemySpawn','deploy'])b.on(event,()=>update(b,e,a),{owner:e});
   b.on('removed',({unit})=>{if(unit===e)a.aura.clear();},{owner:e});
  },
  tick:update,status(_c,b,e,a){update(b,e,a);},death(_c,_b,_e,a){a.aura?.clear();},
 };
}
function validate({key,radius,mods,strength,includeDevices,silenceable}){
 if(typeof key!=='string'||!key||key.length>256||!Number.isFinite(radius)||radius<=0||radius>128||!Number.isFinite(strength)
  ||typeof includeDevices!=='boolean'||typeof silenceable!=='boolean'||!mods||typeof mods!=='object'||Array.isArray(mods)||!Object.keys(mods).length
  ||Object.entries(mods).some(([k,v])=>![...ADD_KEYS,...MUL_KEYS].includes(k)||!Number.isFinite(v)))throw Error('Invalid native circle stat aura');
}
nativeCircleStatAura.validate=validate;
