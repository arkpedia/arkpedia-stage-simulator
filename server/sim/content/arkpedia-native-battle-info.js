// SPDX-License-Identifier: GPL-3.0-or-later
const stores=new WeakMap();
/** Retain SIMPLE native counter inputs for stage conditions without coupling
 * an enemy component to any particular stage or achievement controller. */
export function recordNativeBattleInfo(b,unit,{key,addition}){
 validateNativeBattleInfo({key,addition});if(!unit||typeof unit!=='object')throw Error('Invalid native battle info owner');let records=stores.get(b);if(!records)stores.set(b,records=new Map());
 let record=records.get(key);if(!record)records.set(key,record={total:0,owners:new WeakMap()});
 record.total+=addition;record.owners.set(unit,(record.owners.get(unit)??0)+addition);
 b.emit('nativeBattleInfo',{unit,key,addition,total:record.total});
}
export function nativeBattleInfo(b,key,unit=null){const record=stores.get(b)?.get(key);return unit?record?.owners.get(unit)??0:record?.total??0;}
export function validateNativeBattleInfo({key,addition}){
 if(typeof key!=='string'||!key||key.length>256||!Number.isSafeInteger(addition)||addition<0||addition>1024)throw Error('Invalid native battle info');
}
