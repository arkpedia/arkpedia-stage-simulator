// SPDX-License-Identifier: GPL-3.0-or-later
// Default RuntimeAttributesSnapshot.TakeSnapshot. Native obscured-value
// conversions remain explicit; each returned value struct is copied in full.
export function fearProjectileRuntimeSnapshot({snapshot,readFp,readInt,encodeFp,encodeInt,isActive}){
 if(!snapshot||[readFp,readInt,encodeFp,encodeInt,isActive].some(fn=>typeof fn!=='function'))throw new TypeError('Fear stat snapshot requires native storage, attribute, conversion and lifecycle callers');
 const cancelled=Symbol('cancelled'),check=()=>{const active=isActive();if(typeof active!=='boolean')throw new TypeError('Fear stat snapshot requires native Boolean lifecycle results');if(!active)throw cancelled;};
 return Object.freeze({run(attributes){
  try{
   check();if(attributes==null)throw new TypeError('Fear stat snapshot dereferenced null native attributes');
   for(const [field,index,integer]of [['maxHp',0,false],['atk',1,false],['def',2,false],['magicResistance',3,false],
    ['cost',4,true],['blockCnt',5,true],['attackSpeed',7,false],['baseAttackTime',8,false],['respawnTime',21,true]]){
    const value=(integer?readInt:readFp)(attributes,index);check();
    if(integer){if(!Number.isInteger(value)||value<-(2**31)||value>=2**31)throw new TypeError('Fear stat snapshot requires native Int32 attributes');}
    else if(typeof value!=='bigint'||value<-(1n<<63n)||value>=(1n<<63n))throw new TypeError('Fear stat snapshot requires native signed FP attributes');
    const encoded=(integer?encodeInt:encodeFp)(value);check();
    if(!(encoded instanceof Uint8Array)||encoded.length!==(integer?20:40))throw new TypeError('Fear stat snapshot requires complete native obscured-value bytes');
    snapshot[field]=new Uint8Array(encoded);check();
   }
  }catch(error){if(error===cancelled)return null;throw error;}
 }});
}

// Default Buff.TakeSnapshotToBuffAttribute: source lock and Unity validity
// precede attribute access; an invalid source leaves the previous snapshot.
export function fearProjectileTakeBuffSnapshot({buff,lockSource,isDestroyedOrNull,readAttributes,takeSnapshot,isActive}){
 if(!buff||[lockSource,isDestroyedOrNull,readAttributes,takeSnapshot,isActive].some(fn=>typeof fn!=='function'))throw new TypeError('Fear buff snapshot requires native pointer, Unity, attribute and lifecycle callers');
 const cancelled=Symbol('cancelled'),check=()=>{const active=isActive();if(typeof active!=='boolean')throw new TypeError('Fear buff snapshot requires native Boolean lifecycle results');if(!active)throw cancelled;};
 return Object.freeze({run(){
  try{
   check();const source=lockSource(buff.m_source);check();
   const destroyed=isDestroyedOrNull(source);check();if(typeof destroyed!=='boolean')throw new TypeError('Fear buff snapshot requires native Boolean Unity results');
   if(destroyed)return;
   if(source==null)throw new TypeError('Fear buff snapshot dereferenced a null native source');
   const attributes=readAttributes(source);check();
   takeSnapshot(buff.m_runtimeAttributesSnapshot,attributes);check();
  }catch(error){if(error===cancelled)return null;throw error;}
 }});
}
