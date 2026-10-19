// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-makoto-runtime-review.json' with{type:'json'};
import{MAKOTO_ID as ID,MAKOTO_SKILLS}from'./arkpedia-makoto-source.js';
import{prepareMakotoOwner,MAKOTO_OWNER_CONTRACT}from'./arkpedia-makoto-owner.js';
function reviewed(b){
 const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed';
 const candidate=b.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
  ||review.mechanicsPolicy!=='source-cn-makoto-persona-owned-forms-fatal-free-recast-and-allout-v1')throw Error('Missing Makoto runtime review or explicit held browser candidate');
}
export function customizePublicMakotoKit({battle,id,unit,kit}){
 if(id!==ID)return;reviewed(battle);if(!MAKOTO_SKILLS.includes(unit.def.skill?.id))throw Error('Missing original selected Makoto skill');
 const prepared=prepareMakotoOwner(battle,unit,{contract:MAKOTO_OWNER_CONTRACT});Object.assign(kit,prepared.kit);unit.mem.makotoOwner=prepared.controller;
}
export function installPublicMakoto({battle,unit,def}){if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.makotoOwner)throw Error('Missing selected Makoto owner');unit.mem.makotoOwner.install();}
