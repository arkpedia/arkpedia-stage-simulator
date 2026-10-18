// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-gallus-runtime-review.json' with {type:'json'};
import {GALLUS_ID as ID} from './arkpedia-gallus-source.js';
import {prepareGallus,GALLUS_CONTRACT} from './arkpedia-gallus.js';
function reviewed(b){const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed',candidate=b.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false||review.mechanicsPolicy!=='source-cn-passive-window-and-source-res-reduction-v1')throw Error('Missing GALLUS runtime review or explicit held browser candidate');}
export function customizePublicGallusKit({battle,id,unit,kit}){if(id!==ID)return;reviewed(battle);Object.assign(kit,prepareGallus(battle,unit,{contract:GALLUS_CONTRACT}).kit);}
export function installPublicGallus({battle,unit,def}){if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.gallus)throw Error('Missing selected GALLUS controller');unit.mem.gallus.install();}
