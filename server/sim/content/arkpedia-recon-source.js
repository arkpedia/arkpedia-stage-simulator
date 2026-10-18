// SPDX-License-Identifier: GPL-3.0-or-later
// Held original source inputs only: no combat, summon kit or public admission.
import e from '../../../data/arkpedia-native-operators/char_4215_buddy.json' with {type:'json'};
import {selectedCNPassiveSourceBuild} from './arkpedia-selected-cn-source.js';
export const RECON_ID='char_4215_buddy',PALAMUTE_ID='token_10063_buddy_bddg';
export const selectedReconBuild=build=>selectedCNPassiveSourceBuild(e,RECON_ID,build);
export function reconSourceComponent(group,id,pathId){const c=e[group]?.[id]?.flatMap(r=>r.components).find(c=>c.pathId===pathId);if(!c)throw Error('Missing original Rhodes Island Recon component');return c.data;}
export function reconNativeInputs(){return{ownerRoot:reconSourceComponent('characters',RECON_ID,'-5030128331884503336'),tokenRoot:reconSourceComponent('tokens',PALAMUTE_ID,'7721478156889190908'),trait:reconSourceComponent('characters',RECON_ID,'8235092643897302744'),tokenAttacks:['5452024281888551420','-1857973228909202948'].map(id=>reconSourceComponent('tokens',PALAMUTE_ID,id)),templates:e.templates,projectiles:e.projectiles};}
