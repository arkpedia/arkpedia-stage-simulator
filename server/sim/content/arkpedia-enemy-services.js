// SPDX-License-Identifier: GPL-3.0-or-later
/** Factories may name actor-local services supplied by earlier components.
 * This checks the whole ordered plan before traits or spawn hooks mutate it. */
export function validateEnemyServices(factories){
 if(!factories.some(make=>make?.requires!==undefined||make?.provides!==undefined))return;
 const available=new Set();
 const list=keys=>{if(!Array.isArray(keys)||keys.length>64||keys.some(k=>typeof k!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(k)))throw Error('Invalid enemy runtime service declaration');return keys;};
 for(const make of factories){
  for(const key of list(make?.requires??[]))if(!available.has(key))throw Error(`Missing earlier enemy runtime service: ${key}`);
  for(const key of list(make?.provides??[]))available.add(key);
 }
}
