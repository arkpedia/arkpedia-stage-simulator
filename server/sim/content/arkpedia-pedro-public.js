// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-pedro-runtime-review.json' with {type:'json'};
import {PEDRO_ID as ID} from './arkpedia-pedro-source.js';
import {preparePedro,PEDRO_CONTRACT} from './arkpedia-pedro.js';
function reviewed(battle){
 const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed';
 const candidate=battle.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
  ||review.mechanicsPolicy!=='source-cn-cached-arts-trigger-and-snapshot-ally-protection-v1')throw Error('Missing Pedro runtime review or explicit held browser candidate');
}
export function customizePublicPedroKit({battle,id,unit,kit}){
 if(id!==ID)return;reviewed(battle);Object.assign(kit,preparePedro(battle,unit,{contract:PEDRO_CONTRACT}).kit);
}
export function installPublicPedro({battle,unit,def}){
 if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.pedro)throw Error('Missing selected Pedro controller');unit.mem.pedro.install();
}
