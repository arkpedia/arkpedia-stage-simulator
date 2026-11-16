// SPDX-License-Identifier: GPL-3.0-or-later
import {environmentConditionMask,singleEnvironmentCondition} from '../../../shared/arkpedia/environment-conditions.js';
import {ADD_KEYS,MUL_KEYS} from '../buffs.js';
const modsAllowed=new Set([...ADD_KEYS,...MUL_KEYS]);
/** Stage providers own visibility/weather/terrain. Enemies consume a native
 * condition bit and own one stat instance, including its silence behavior. */
export function environmentStatBonus(params){
 validate(params);const {conditionMask,buffKey,mods,silenceable}=params;
 const clear=(b,e,a)=>{if(a.buff)b.removeBuff(e,a.buff);a.buff=null;};
 const update=(b,e,a)=>{
  if(!e.alive||!e.deployed){clear(b,e,a);return;}
  const mask=environmentConditionMask(b,e);
  if((mask&conditionMask)!==0&&!(silenceable&&e.s.flags.silence)){
   if(!a.buff||!e.buffs.includes(a.buff))a.buff=b.addBuff(e,{key:buffKey,source:e,mods});
  }else clear(b,e,a);
 };
 return{spawn:update,tick:update,status(_c,b,e,a){update(b,e,a);},death(_c,b,e,a){clear(b,e,a);}};
}
function validate({conditionMask,buffKey,mods,silenceable}){
 if(!singleEnvironmentCondition(conditionMask)
  ||typeof buffKey!=='string'||!buffKey||typeof silenceable!=='boolean'||!mods||!Object.keys(mods).length
  ||Object.entries(mods).some(([k,v])=>!modsAllowed.has(k)||!Number.isFinite(v)))throw Error('Invalid environment stat bonus');
}
environmentStatBonus.validate=validate;
