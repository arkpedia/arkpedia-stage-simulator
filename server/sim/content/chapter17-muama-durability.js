// SPDX-License-Identifier: GPL-3.0-or-later
import contract from '../../../data/candidates/arkpedia-ch17-muama-durability-contract.json' with {type:'json'};
import {jsonSourceDigest} from '../../../shared/arkpedia/source-digest.js';
const digest='17f6a3b75b3e774f1c2b3cf867dea8ab8d82db65a87d1b9745184914f9ffd4a2';
export function verifiedMuamaDurability(key,record,passives,source=contract){
 if(jsonSourceDigest(source)!==digest)throw Error('Unreviewed Muama durability action source');
 const proof=source.enemies[key],parents=passives?.filter(p=>p.templateKey==='enemy_muama_t[damage_resistance]');
 if(!proof||record?.key!==key||record.prefabKey!==key||record.talents?.bb?.['DamageResistance.damage_resistance']!==proof.ratio
  ||parents?.length!==1||jsonSourceDigest(parents[0])!==jsonSourceDigest(proof.parent))throw Error('Unreviewed Muama durability parent or ratio');
 return Object.freeze({parentKey:proof.parent.buffKey,ratio:proof.ratio,factor:1-proof.ratio,damageTypes:Object.freeze(['phys','arts'])});
}
