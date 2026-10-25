// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/candidates/arkpedia-ch17-reviewed-war-caster.json' with {type:'json'};
import {warCaster}from'./chapter17.js';
import leave from '../../../data/candidates/arkpedia-war-caster-leave-contract.json' with {type:'json'};
import {jsonSourceDigest}from'../../../shared/arkpedia/source-digest.js';
import {verifyEnemyInstantKill}from'../enemy-instant-kill.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function warCasterLeaveAction(source=leave){
 if(jsonSourceDigest(source)!=='9296069a5960f2f1de5dcdbf04243bdd7da5ba28d34856262c41f3d9cdab6813')throw Error('Unreviewed War Caster Leave action source');
 return verifyEnemyInstantKill(source.actions[2]);
}
export function strongWarCaster(r){
 const p=review.enemies[r.key];
 if(!p||r.prefabKey!==r.key||!same(r.talents.groups,p.groups)||!same(r.talents.bb,p.bb)
  ||!same(r.skills,p.skills)||!same(r.abilities,p.abilities))throw Error('Unreviewed stronger War Caster contract');
 return warCaster(r,{leaveAction:warCasterLeaveAction()});
}
