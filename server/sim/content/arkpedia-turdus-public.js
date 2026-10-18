// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-turdus-runtime-review.json' with {type:'json'};
import {TURDUS_ID as ID} from './arkpedia-turdus-source.js';
import {prepareTurdus,TURDUS_CONTRACT} from './arkpedia-turdus.js';
function reviewed(b){const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed',candidate=b.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false||review.mechanicsPolicy!=='source-cn-chain-free-bounce-carried-scale-and-independent-heal-camouflage-v1')throw Error('Missing Ukusik runtime review or explicit held browser candidate');}
export function customizePublicTurdusKit({battle,id,unit,kit}){if(id!==ID)return;reviewed(battle);Object.assign(kit,prepareTurdus(battle,unit,{contract:TURDUS_CONTRACT}).kit);}
export function installPublicTurdus({battle,unit,def}){if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.turdus)throw Error('Missing selected Ukusik controller');unit.mem.turdus.install();}
