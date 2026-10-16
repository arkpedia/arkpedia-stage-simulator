// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-mcnist-runtime-review.json' with {type:'json'};
import {MCNIST_ID as ID} from './arkpedia-mcnist-source.js';
import {prepareMechanist,MCNIST_CONTRACT} from './arkpedia-mcnist.js';
function reviewed(battle){
 const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed',
  candidate=battle.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
  ||review.mechanicsPolicy!=='source-cn-owner-mcgraf-barriers-ammo-cross-and-fresh-charge-v1')throw Error('Missing Mechanist runtime review or explicit held browser candidate');
}
export function customizePublicMechanistKit({battle,id,unit,kit}){if(id!==ID)return;reviewed(battle);Object.assign(kit,prepareMechanist(battle,unit,{contract:MCNIST_CONTRACT}).kit);}
export function installPublicMechanist({battle,unit,def}){if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.mcnist)throw Error('Missing selected complete Mechanist controller');unit.mem.mcnist.install();}
