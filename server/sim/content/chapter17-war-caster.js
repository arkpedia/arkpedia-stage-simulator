// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/candidates/arkpedia-ch17-reviewed-war-caster.json' with {type:'json'};
import {warCaster}from'./chapter17.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function strongWarCaster(r){
 const p=review.enemies[r.key];
 if(!p||r.prefabKey!==r.key||!same(r.talents.groups,p.groups)||!same(r.talents.bb,p.bb)
  ||!same(r.skills,p.skills)||!same(r.abilities,p.abilities))throw Error('Unreviewed stronger War Caster contract');
 return warCaster(r);
}
