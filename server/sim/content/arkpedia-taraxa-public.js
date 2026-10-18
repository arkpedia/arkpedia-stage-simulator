// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-taraxa-runtime-review.json' with {type:'json'};
import {TARAXA_ID as ID} from './arkpedia-taraxa-source.js';
import {prepareTaraxaS1,TARAXA_S1_CONTRACT} from './arkpedia-taraxa-s1.js';
import {prepareTaraxaS2,TARAXA_S2_CONTRACT} from './arkpedia-taraxa-s2.js';
function reviewed(b){
 const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed';
 const candidate=b.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false
  ||review.nativePixelParity!==false||review.mechanicsPolicy!=='source-cn-taraxa-air-block-aura-and-two-flight-heal-modes-v1')
  throw Error('Missing Taraxacum runtime review or explicit held browser candidate');
}
export function customizePublicTaraxaKit({battle,id,unit,kit}){
 if(id!==ID)return;reviewed(battle);
 if(!['skchr_taraxa_1','skchr_taraxa_2'].includes(unit.def.skill?.id))throw Error('Missing selected original Taraxacum skill');
 const prepared=unit.def.skill.id==='skchr_taraxa_1'?prepareTaraxaS1(battle,unit,{contract:TARAXA_S1_CONTRACT})
  :prepareTaraxaS2(battle,unit,{contract:TARAXA_S2_CONTRACT});
 Object.assign(kit,prepared.kit,{install:null});
}
export function installPublicTaraxa({battle,unit,def}){
 if(def.charId!==ID)return;reviewed(battle);
 if(!unit.mem.taraxa)throw Error('Missing selected Taraxacum controller');unit.mem.taraxa.install();
}
