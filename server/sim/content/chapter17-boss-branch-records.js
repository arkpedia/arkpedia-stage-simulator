// SPDX-License-Identifier: GPL-3.0-or-later
import contract from '../../../data/candidates/arkpedia-ch17-boss-branch-contract.json' with {type:'json'};
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
freeze(contract);
export function chapter17BossBranchRecord(stage,key){
 if(stage!==contract.stage||!Object.hasOwn(contract.records,key))throw Error('Unreviewed boss branch record');
 return contract.records[key];
}
export function matchesChapter17LocalBrute(record,stage){
 return stage===contract.stage&&record?.key==='enemy_10207_mubrut_2_a'&&JSON.stringify(record)===JSON.stringify(contract.records[record.key]);
}
