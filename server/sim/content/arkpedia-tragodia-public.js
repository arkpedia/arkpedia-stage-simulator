// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-tragodia-runtime-review.json' with {type:'json'};
import {TRAGODIA_ID as ID} from './arkpedia-tragodia-source.js';
import {prepareTragodiaOwnerSkills,TRAGODIA_OWNER_SKILLS_CONTRACT} from './arkpedia-tragodia-owner-skills.js';
import {prepareTragodiaLure,TRAGODIA_LURE_CONTRACT} from './arkpedia-tragodia-lure.js';
import {prepareTragodiaCages,TRAGODIA_CAGE_CONTRACT} from './arkpedia-tragodia-cage.js';
function reviewed(){
  if(JSON.stringify(review.enabledOperators)!==JSON.stringify([ID])||review.frameParity!==false
    ||review.moduleSupport!==false||review.nativePixelParity!==false
    ||review.lurePolicy!=='source-single-lure-attraction-v1'||review.cagePolicy!=='source-captured-blockees-v1'
    ||review.cagePresentation!=='original-root-stationary-stage-origin-v1')throw Error('Tragodia lacks a complete public runtime review');
}
export function customizePublicTragodiaKit({battle,id,unit,kit}){
  if(id!==ID)return;reviewed();
  const skill=unit.def.skill.id;
  const prepared=skill==='skchr_phatm2_3'?prepareTragodiaCages(battle,unit,{contract:TRAGODIA_CAGE_CONTRACT})
    :skill==='skchr_phatm2_2'?prepareTragodiaLure(battle,unit,{contract:TRAGODIA_LURE_CONTRACT})
    :prepareTragodiaOwnerSkills(battle,unit,{contract:TRAGODIA_OWNER_SKILLS_CONTRACT});
  if(prepared.deck)prepared.controller.lure=prepared.deck;
  if(prepared.cages)prepared.controller.cages=prepared.cages;
  Object.assign(kit,prepared.kit);
}
export function installPublicTragodia({unit,def}){
  if(def.charId!==ID)return;reviewed();
  if(!unit.mem.tragodiaController)throw Error('Missing selected Tragodia controller');
  unit.mem.tragodiaController.install();
}
