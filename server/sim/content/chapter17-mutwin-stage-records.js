// SPDX-License-Identifier: GPL-3.0-or-later
import contract from '../../../data/candidates/arkpedia-ch17-mutwin-stage-record-contract.json' with {type:'json'};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
freeze(contract);
export function chapter17StagedTwinRecord(stage,key){
 if(stage!==contract.stage||!contract.enemies[key])throw Error('Unreviewed staged twin selection');
 return contract.enemies[key].record;
}
export function matchesChapter17MuamaRecord(e,proof,stage){
 const r=e?.def?.raw;
 if(!proof||r?.key!==e.defId||r.prefabKey!==e.defId)return false;
 if(stage!==undefined)return stage===contract.stage&&!!contract.enemies[e.defId]&&same(r,contract.enemies[e.defId].record);
 return same(r.talents,proof.record.talents)&&same(r.skills,proof.record.skills)&&same(r.abilities,proof.record.abilities);
}
