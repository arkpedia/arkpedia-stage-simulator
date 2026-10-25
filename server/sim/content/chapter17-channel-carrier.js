// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/candidates/arkpedia-ch17-reviewed-channel-carrier.json' with {type:'json'};
import {chargeRift,deadSummon} from './chapter17.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function verify(r,kind){
 const p=review.enemies[r.key];
 if(!p||p.kind!==kind||r.prefabKey!==r.key||!same(r.talents.groups,p.groups)||!same(r.talents.bb,p.bb)
  ||!same(r.abilities,p.abilities)||!same(r.skills,p.skills))throw Error('Unreviewed stronger channel/carrier contract');
}
export function strongChannel(r){verify(r,'channel');return chargeRift(r);}
export function strongCarrier(r){verify(r,'carrier');return deadSummon(r);}
