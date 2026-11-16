// SPDX-License-Identifier: GPL-3.0-or-later
import {aggroCmp} from '../targeting.js';
const providers=new WeakMap();
const live=(u,life)=>u?.alive&&u.deployed&&!u.removed&&u.deploySeq===life;
const entries=b=>{let map=providers.get(b);if(!map)providers.set(b,map=new WeakMap());return map;};
/** A native device exposes its existing SP gauge through callbacks. No second
 * gauge is created; ordinary SkillRuntime receivers use their own gainSp. */
export function registerDeviceSp(b,unit,{get,add}){
 if(!unit||typeof unit!=='object'||!b.units?.includes(unit)||!live(unit,unit.deploySeq)||typeof get!=='function'||typeof add!=='function')throw Error('Invalid device SP provider');
 const map=entries(b),old=map.get(unit);if(old&&live(unit,old.life))throw Error('Duplicate device SP provider');
 const entry={life:unit.deploySeq,get,add};map.set(unit,entry);return()=>{if(map.get(unit)===entry)map.delete(unit);};
}
export function deviceSp(b,unit){
 const entry=providers.get(b)?.get(unit);if(!b.units?.includes(unit)||!live(unit,entry?.life??unit?.deploySeq))return null;
 const value=entry?entry.get():unit.skill?.noSkill?null:unit.skill?.sp;
 if(value===null||value===undefined)return null;if(!Number.isFinite(value)||value<0)throw Error('Invalid device SP value');return value;
}
export function addDeviceSp(b,unit,amount){
 if(!Number.isFinite(amount)||amount<0||amount>1e6)throw Error('Invalid device SP addition');
 const entry=providers.get(b)?.get(unit);if(!b.units?.includes(unit)||!live(unit,entry?.life??unit?.deploySeq)||unit.s.flags.noSp)return 0;
 const changed=entry?entry.add(amount):unit.skill?.gainSp(amount,'nativeBuff')??0;
 if(!Number.isFinite(changed)||changed<0)throw Error('Invalid device SP result');return changed;
}

/** Shared native tagged-device acquisition, independent of the trigger event. */
export function selectedDeviceSpTargets(b,e,selector){
 return b.units.filter(u=>u.kind==='device'&&u.tags?.has(selector.tag)&&u.alive&&u.deployed&&!u.hidden&&!u.removed
  &&(selector.side==='both'||(selector.side==='same')===(u.side===e.side))&&!u.s.flags.untargetable&&!u.s.flags.isolated&&!u.s.flags.sleep
  &&!(u.side!==e.side&&(u.s.flags.targetFree||u.s.flags.stealth||u.s.flags.camou))).sort(aggroCmp).slice(0,selector.maxTargets);
}
