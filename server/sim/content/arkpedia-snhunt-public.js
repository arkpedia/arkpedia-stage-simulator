// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-snhunt-runtime-review.json' with {type:'json'};
import {SNHUNT_ID as ID} from './arkpedia-snhunt-source.js';
import {prepareSnhunt,SNHUNT_CONTRACT} from './arkpedia-snhunt.js';
function reviewed(battle){
 const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed';
 const candidate=battle.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
  ||review.mechanicsPolicy!=='source-cn-hunter-magazine-double-shot-and-beast-cold-v1')throw Error('Missing Snow Hunter runtime review or explicit held browser candidate');
}
export function customizePublicSnhuntKit({battle,id,unit,kit}){
 if(id!==ID)return;reviewed(battle);Object.assign(kit,prepareSnhunt(battle,unit,{contract:SNHUNT_CONTRACT}).kit);
}
export function installPublicSnhunt({battle,unit,def}){
 if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.snhunt)throw Error('Missing selected Snow Hunter controller');unit.mem.snhunt.install();
}
