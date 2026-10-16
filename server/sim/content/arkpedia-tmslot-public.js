// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-tmslot-runtime-review.json' with {type:'json'};
import {TMSLOT_ID as ID} from './arkpedia-tmslot-source.js';
import {prepareTimeslot,TMSLOT_CONTRACT} from './arkpedia-tmslot.js';
function reviewed(battle){
 const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed';
 const candidate=battle.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
  ||review.mechanicsPolicy!=='source-cn-owner-and-independent-drones-range-forced-overload-v1')throw Error('Missing Timeslot runtime review or explicit held browser candidate');
}
export function customizePublicTimeslotKit({battle,id,unit,kit}){
 if(id!==ID)return;reviewed(battle);Object.assign(kit,prepareTimeslot(battle,unit,{contract:TMSLOT_CONTRACT}).kit);
}
export function installPublicTimeslot({battle,unit,def}){
 if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.tmslot)throw Error('Missing selected Timeslot controller');unit.mem.tmslot.install();
}
