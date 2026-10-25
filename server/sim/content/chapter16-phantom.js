// SPDX-License-Identifier: GPL-3.0-or-later
// Exact Army Phantom candidate: native neutral-only weapon, one miner
// movement engagement and army mark. The generic trait owns unblockability.
import {blockMcreep}from'./chapter16-engagement.js';
import review from'../../../data/candidates/arkpedia-ch16-reviewed-phantom.json'with{type:'json'};
export function armyPhantom(r){
  const proof=review.enemies[r.key];
  if(!proof||r.prefabKey!==r.key||JSON.stringify(r.talents.groups)!==JSON.stringify(proof.groups)
    ||JSON.stringify(r.talents.bb)!==JSON.stringify(proof.bb)||JSON.stringify(r.abilities)!==JSON.stringify(proof.abilities)
    ||JSON.stringify(r.skills)!==JSON.stringify(proof.skills))throw Error('Unreviewed Army Phantom contract');
  return blockMcreep({cnt:r.talents.bb['BlockMcreep.block_mcreep_cnt'],range:r.talents.bb['BlockMcreep.range_radius'],
    rangeAdd:r.talents.bb['BlockMcreep.range_radius_add'],attackRange:review.defaults.attackRange,markArmy:true});
}
