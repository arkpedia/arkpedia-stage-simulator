// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-thumpy-runtime-review.json' with {type:'json'};
import {THUMPY_ID as ID} from './arkpedia-thumpy-source.js';
import {prepareThumpy,THUMPY_CONTRACT} from './arkpedia-thumpy.js';
function reviewed(battle){
 const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed';
 const candidate=battle.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
  ||review.mechanicsPolicy!=='source-cn-three-modes-erosion-glue-conveyor-v1')throw Error('Missing Thumpy runtime review or explicit held browser candidate');
}
export function customizePublicThumpyKit({battle,id,unit,kit}){
 if(id!==ID)return;reviewed(battle);Object.assign(kit,prepareThumpy(battle,unit,{contract:THUMPY_CONTRACT}).kit);
}
export function installPublicThumpy({battle,unit,def}){
 if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.thumpy)throw Error('Missing selected Thumpy controller');unit.mem.thumpy.install();
}
