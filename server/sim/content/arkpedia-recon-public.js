// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-recon-runtime-review.json' with {type:'json'};
import {RECON_ID as ID} from './arkpedia-recon-source.js';
import {prepareReconAttacks,RECON_ATTACK_CONTRACT} from './arkpedia-recon-attacks.js';
function reviewed(b){const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed',candidate=b.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false||review.mechanicsPolicy!=='source-cn-passive-bombs-owner-modes-and-palamute-point-v1')throw Error('Missing Recon runtime review or explicit held browser candidate');}
export function customizePublicReconKit({battle,id,unit,kit}){if(id!==ID)return;reviewed(battle);Object.assign(kit,prepareReconAttacks(battle,unit,{contract:RECON_ATTACK_CONTRACT}).kit);}
export function installPublicRecon({battle,unit,def}){if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.reconLifecycle)throw Error('Missing selected Recon/Palamute controller');unit.mem.reconLifecycle.install();}
