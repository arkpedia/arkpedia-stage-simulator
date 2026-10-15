// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-tanya-runtime-review.json' with {type:'json'};
import {TANYA_ID as ID} from './arkpedia-tanya-source.js';
import {prepareTanya,TANYA_CONTRACT} from './arkpedia-tanya.js';
function reviewed(battle){
 const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed';
 const candidate=battle.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
  ||review.mechanicsPolicy!=='source-cn-immediate-hp-recovery-permanent-def-hp-loss-erosion-v1')throw Error('Missing Crackborne runtime review or explicit held browser candidate');
}
export function customizePublicCrackborneKit({battle,id,unit,kit}){
 if(id!==ID)return;reviewed(battle);Object.assign(kit,prepareTanya(battle,unit,{contract:TANYA_CONTRACT}).kit);
}
export function installPublicCrackborne({battle,unit,def}){
 if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.tanya)throw Error('Missing selected Crackborne controller');unit.mem.tanya.install();
}
