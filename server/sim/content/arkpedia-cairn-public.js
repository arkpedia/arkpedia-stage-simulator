// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-cairn-runtime-review.json' with {type:'json'};
import {CAIRN_ID as ID} from './arkpedia-cairn-source.js';
import {prepareCairn,CAIRN_CONTRACT} from './arkpedia-cairn.js';
function reviewed(battle){
 const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed';
 const candidate=battle.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
  ||review.mechanicsPolicy!=='source-cn-hp-mode-shield-snapshot-dot-and-blocked-injury-v1')throw Error('Missing Cairn runtime review or explicit held browser candidate');
}
export function customizePublicCairnKit({battle,id,unit,kit}){
 if(id!==ID)return;reviewed(battle);Object.assign(kit,prepareCairn(battle,unit,{contract:CAIRN_CONTRACT}).kit);
}
export function installPublicCairn({battle,unit,def}){
 if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.cairn)throw Error('Missing selected Cairn controller');unit.mem.cairn.install();
}
