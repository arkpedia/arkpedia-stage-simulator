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
/** The two native output-scale buffs (and an optional third against the
 * opposite attribute) on any unit, each active only while its own buff is
 * attached. Enemy talents and Hui-Ming tiles attach the same pair. Returns the
 * attached buffs by key and a detach function. */
export function attachHuiMingScales(b,unit,{same,diff,sameKey,diffKey,bonus=null}){
 const life=unit.deploySeq,buffs={},keys=[sameKey,diffKey,...(bonus?[bonus.key]:[])];
 for(const key of keys){
  const buff=b.addBuff(unit,{key,source:unit,refresh:'independent',maxStacks:Infinity,admit:u=>live(u)&&u.deploySeq===life});
  if(buff&&unit.buffs.includes(buff))buffs[key]=buff;
 }
 const hook=b.on('sourceAtkScale',c=>{
  if(c.source!==unit||!live(unit)||unit.deploySeq!==life)return;
  const mine=huiMingOf(unit),theirs=huiMingOf(c.target);if(!mine||!theirs)return;
  const buff=buffs[mine===theirs?sameKey:diffKey];
  if(buff&&unit.buffs.includes(buff))c.scale*=mine===theirs?same:diff;
  // A separate native talent may add its own scale against the opposite attribute.
  const extra=bonus&&mine!==theirs?buffs[bonus.key]:null;
  if(extra&&unit.buffs.includes(extra))c.scale*=bonus.scale;
 },{owner:unit});
 return{buffs,detach(){b.off(hook);for(const buff of Object.values(buffs))if(unit.buffs.includes(buff))b.removeBuff(unit,buff);}};
}
/** A unit's native Hui-Ming talent: the start-only attribute choice and the
 * output scales, plus the optional opposite-attribute target preference. */
export function huiMingAttribute(params){
 validate(params);const {dynamic,preferOpposite=false}=params;
 return{
  spawn(b,e,a){
   const life=e.deploySeq;a.scales=attachHuiMingScales(b,e,params);a.buffs=a.scales.buffs;
   if(!live(e)||e.deploySeq!==life)return;
   if(dynamic===0)setHuiMing(b,e,'yin');else if(dynamic===1)setHuiMing(b,e,'yang');
   // Native buff-pair selector: candidates holding the attribute opposite to this unit's current one come first,
   // ahead of taunt; a unit with no attribute has no preference.
   if(preferOpposite){
    if(e.profile.targetPriority)throw Error('Target priority already installed');
    const score=u=>{const mine=huiMingOf(e),theirs=huiMingOf(u);return mine&&theirs&&mine!==theirs?0:1;};
    e.profile.targetPriority=(x,y)=>score(x)-score(y);
   }
  },
  death(_c,b,e,a){for(const buff of Object.values(a.buffs??{}))if(e.buffs.includes(buff))b.removeBuff(e,buff);a.buffs={};},
 };
}
function validate({dynamic,same,diff,sameKey,diffKey,bonus,preferOpposite}){
 if(preferOpposite!==undefined&&typeof preferOpposite!=='boolean')throw Error('Invalid Hui-Ming attribute talent');
 if(bonus!==undefined&&bonus!==null&&(typeof bonus!=='object'||Object.keys(bonus).sort().join()!=='key,scale'||typeof bonus.key!=='string'||!bonus.key||bonus.key.length>256||[sameKey,diffKey,...Object.values(HUI_MING)].includes(bonus.key)||!Number.isFinite(bonus.scale)||bonus.scale<0||bonus.scale>1e3))throw Error('Invalid Hui-Ming attribute talent');
 if(![-1,0,1].includes(dynamic)||![same,diff].every(v=>Number.isFinite(v)&&v>=0&&v<=1e3)
  ||[sameKey,diffKey].some(k=>typeof k!=='string'||!k||k.length>256||Object.values(HUI_MING).includes(k))||sameKey===diffKey)throw Error('Invalid Hui-Ming attribute talent');
}
huiMingAttribute.validate=validate;
