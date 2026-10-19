// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-yukari-runtime-review.json' with{type:'json'};
import{YUKARI_ID as ID}from'./arkpedia-yukari-source.js';
import{prepareYukariS1,YUKARI_S1_CONTRACT}from'./arkpedia-yukari-s1.js';
import{prepareYukariS2,YUKARI_S2_CONTRACT}from'./arkpedia-yukari-s2.js';
function reviewed(b){
 const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([ID])&&review.verification.browser.status==='passed';
 const candidate=b.regularReviewCandidates?.includes(ID)&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
 if((!approved&&!candidate)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
  ||review.mechanicsPolicy!=='source-cn-yukari-four-arrow-final-levitation-and-delayed-next-skill-arts-v1')throw Error('Missing Yukari runtime review or explicit held browser candidate');
}
export function customizePublicYukariKit({battle,id,unit,kit}){
 if(id!==ID)return;reviewed(battle);if(!['skchr_yukari_1','skchr_yukari_2'].includes(unit.def.skill?.id))throw Error('Missing original selected Yukari skill');
 const prepared=unit.def.skill.id==='skchr_yukari_1'?prepareYukariS1(battle,unit,{contract:YUKARI_S1_CONTRACT}):prepareYukariS2(battle,unit,{contract:YUKARI_S2_CONTRACT});Object.assign(kit,prepared.kit);
}
export function installPublicYukari({battle,unit,def}){if(def.charId!==ID)return;reviewed(battle);if(!unit.mem.yukari)throw Error('Missing selected Yukari controller');unit.mem.yukari.install();}
