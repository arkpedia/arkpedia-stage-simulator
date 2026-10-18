// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-koromaru-runtime-review.json' with {type:'json'};
import {KOROMARU_ID as ID} from './arkpedia-koromaru-source.js';
import {prepareKoromaru,KOROMARU_CONTRACT} from './arkpedia-koromaru.js';
function reviewed(b){const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed',candidate=b.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false||review.mechanicsPolicy!=='source-cn-passive-six-slash-and-startup-protection-v1')throw Error('Missing KOROMARU runtime review or explicit held browser candidate');}
export function customizePublicKoromaruKit({battle,id,unit,kit}){if(id!==ID)return;reviewed(battle);Object.assign(kit,prepareKoromaru(battle,unit,{contract:KOROMARU_CONTRACT}).kit);}
export function installPublicKoromaru({battle,unit,def}){if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.koromaru)throw Error('Missing selected KOROMARU controller');unit.mem.koromaru.install();}
