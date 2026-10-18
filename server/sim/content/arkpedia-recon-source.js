// SPDX-License-Identifier: GPL-3.0-or-later
// Held original source inputs only: no combat, summon kit or public admission.
import e from '../../../data/arkpedia-native-operators/char_4215_buddy.json' with {type:'json'};
import {selectedCNPassiveSourceBuild} from './arkpedia-selected-cn-source.js';
export const RECON_ID='char_4215_buddy',PALAMUTE_ID='token_10063_buddy_bddg';
export const selectedReconBuild=build=>selectedCNPassiveSourceBuild(e,RECON_ID,build);
export function reconSourceComponent(group,id,pathId){const c=e[group]?.[id]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);if(!c)throw Error('Missing original Rhodes Island Recon component');return c.data;}
export function reconNativeInputs(){return{ownerRoot:reconSourceComponent('characters',RECON_ID,'-5030128331884503336'),tokenRoot:reconSourceComponent('tokens',PALAMUTE_ID,'7721478156889190908'),tokenAnimator:reconSourceComponent('tokens',PALAMUTE_ID,'7173132144346362364'),trait:reconSourceComponent('characters',RECON_ID,'8235092643897302744'),tokenAttacks:['5452024281888551420','-1857973228909202948'].map(id=>reconSourceComponent('tokens',PALAMUTE_ID,id)),templates:e.templates,projectiles:e.projectiles};}
export function reconOwnerAttackInputs(){
 const rows=e.characters[RECON_ID],get=id=>reconSourceComponent('characters',RECON_ID,id);
 const ids={ordinaryCombat:['-5889427822170317096','-2067958571245281576'],ordinaryAttack:['3070067287519289048','-1302749032545952040'],fallbackCombat:['-5543200227914588456','-2701956245408620840'],fallbackAttack:['3145975255684767448','2212762542594940632'],bombCombat:['-5513968034308202792'],bombAttack:['-8346449222603743528']};
 const shots=Object.fromEntries(Object.entries(ids).map(([key,ids])=>[key,ids.map(id=>{const row=rows.find(r=>r.components.some(c=>c.pathId===id)),ability=get(id);return{id,ability,animator:row.components.find(c=>c.data._oneshotAnim)?.data,selector:get(ability._selector.m_PathID)};})]));
 return{root:reconNativeInputs().ownerRoot,modes:['7458498282236108504','6028356647921213144'].map(get),shots,
  groups:['-4014373505673437480','1249713407881469656','1207453111600832216','-1590983004720177448','-6400508463124488488','1684409015065861848'].map(get),
  unmarked:get('-8333502059022426408'),marked:get('794266941582958296'),animator:reconSourceComponent('artworkHierarchy',RECON_ID,'-4228522375265238063')};
}
