// SPDX-License-Identifier: GPL-3.0-or-later
/** Shared Hui-Ming (yin/yang) attribute account. The attribute is the unit's
 * own native marker buff, `buff_yin` or `buff_yang`, never a second store, so
 * enemies, operators, tiles and devices all read and write the same fact.
 * Starting one marker finishes the other and leaves the native derived
 * presentation marker, which ends with its parent. */
export const HUI_MING=Object.freeze({yin:'buff_yin',yang:'buff_yang'});
const other={yin:'yang',yang:'yin'};
const live=u=>!!u&&u.alive&&u.deployed&&!u.removed;
export function huiMingOf(unit){
 if(!unit?.findBuff)return null;
 return unit.findBuff(HUI_MING.yin)?'yin':unit.findBuff(HUI_MING.yang)?'yang':null;
}
/** Native buff start: an existing opposite marker is finished first and the
 * transition marker is used; otherwise the plain marker. Re-applying the
 * current attribute keeps the existing buff. Returns the attached buff. */
export function setHuiMing(b,unit,attribute,{source=unit}={}){
 if(!Object.hasOwn(HUI_MING,attribute))throw Error('Invalid Hui-Ming attribute');
 if(!live(unit))return null;
 const current=unit.findBuff(HUI_MING[attribute]);if(current)return current;
 const life=unit.deploySeq,from=other[attribute],switched=!!unit.findBuff(HUI_MING[from]);
 let effect=null;
 const clear=()=>{const e=effect;effect=null;if(e&&unit.buffs.includes(e))b.removeBuff(unit,e);};
 // The new attribute starts first; its start then finishes the opposite one.
 // A refused start therefore leaves the previous attribute in place.
 const buff=b.addBuff(unit,{key:HUI_MING[attribute],source,visible:true,refresh:'keep',onRemove:clear,onExpire:clear,admit:u=>live(u)&&u.deploySeq===life});
 if(!buff||!unit.buffs.includes(buff))return null;
 if(switched)b.removeBuff(unit,HUI_MING[from]);
 if(!live(unit)||unit.deploySeq!==life||!unit.buffs.includes(buff))return null;
 effect=b.addBuff(unit,{key:switched?`buff_${from}_to_${attribute}[effect]`:`${HUI_MING[attribute]}[effect]`,source,refresh:'independent',maxStacks:Infinity});
 if(effect&&!unit.buffs.includes(buff))clear();
 return buff;
}
/** Native `buff_yinyang_switch`: a unit without an attribute stays without one. */
export function switchHuiMing(b,unit,options){
 const current=huiMingOf(unit);return current?setHuiMing(b,unit,other[current],options):null;
}
/** A unit's native Hui-Ming talent: the start-only attribute choice and two
 * independent output scales. Each scale applies to damage this unit deals to
 * a recipient holding the same, or the opposite, attribute, and only while
 * its own parent buff is still attached. */
export function huiMingAttribute(params){
 validate(params);const {dynamic,same,diff,sameKey,diffKey,bonus=null}=params,keys=[sameKey,diffKey,...(bonus?[bonus.key]:[])];
 return{
  spawn(b,e,a){
   const life=e.deploySeq;a.buffs={};
   for(const key of keys){
    const buff=b.addBuff(e,{key,source:e,refresh:'independent',maxStacks:Infinity,admit:u=>live(u)&&u.deploySeq===life});
    if(buff&&e.buffs.includes(buff))a.buffs[key]=buff;
   }
   if(!live(e)||e.deploySeq!==life)return;
   if(dynamic===0)setHuiMing(b,e,'yin');else if(dynamic===1)setHuiMing(b,e,'yang');
   b.on('sourceAtkScale',c=>{
    if(c.source!==e||!live(e)||e.deploySeq!==life)return;
    const mine=huiMingOf(e),theirs=huiMingOf(c.target);if(!mine||!theirs)return;
    const key=mine===theirs?sameKey:diffKey,buff=a.buffs[key];
    if(buff&&e.buffs.includes(buff))c.scale*=mine===theirs?same:diff;
    // A separate native talent may add its own scale against the opposite attribute.
    const extra=bonus&&mine!==theirs?a.buffs[bonus.key]:null;
    if(extra&&e.buffs.includes(extra))c.scale*=bonus.scale;
   },{owner:e});
  },
  death(_c,b,e,a){for(const buff of Object.values(a.buffs??{}))if(e.buffs.includes(buff))b.removeBuff(e,buff);a.buffs={};},
 };
}
function validate({dynamic,same,diff,sameKey,diffKey,bonus}){
 if(bonus!==undefined&&bonus!==null&&(typeof bonus!=='object'||Object.keys(bonus).sort().join()!=='key,scale'||typeof bonus.key!=='string'||!bonus.key||bonus.key.length>256||[sameKey,diffKey,...Object.values(HUI_MING)].includes(bonus.key)||!Number.isFinite(bonus.scale)||bonus.scale<0||bonus.scale>1e3))throw Error('Invalid Hui-Ming attribute talent');
 if(![-1,0,1].includes(dynamic)||![same,diff].every(v=>Number.isFinite(v)&&v>=0&&v<=1e3)
  ||[sameKey,diffKey].some(k=>typeof k!=='string'||!k||k.length>256||Object.values(HUI_MING).includes(k))||sameKey===diffKey)throw Error('Invalid Hui-Ming attribute talent');
}
huiMingAttribute.validate=validate;
