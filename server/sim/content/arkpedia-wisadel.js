// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-wisadel-prefabs.json' with {type:'json'};
import { WISADEL_ID,prepareWisadelAttacks,WISADEL_ATTACK_CONTRACT } from './arkpedia-wisadel-attacks.js';
import { prepareWisadelS2,WISADEL_S2_CONTRACT } from './arkpedia-wisadel-s2.js';
import { prepareWisadelS3,WISADEL_S3_CONTRACT } from './arkpedia-wisadel-s3.js';
import { WisadelShadows,WISADEL_SHADOW_CONTRACT } from './arkpedia-wisadel-shadows.js';

export function customizeWisadelKit({battle,id,unit,kit}){
  if(id!==WISADEL_ID)return;
  if(!evidence.enabledOperators.includes(id)||evidence.heldOperators.includes(id)
    ||evidence.runtimeMapping?.[id]!=='wisadel')throw Error('Wisadel lacks a full-kit runtime review');
  const prepared=unit.def.skill.id==='skchr_wisdel_3'
    ?prepareWisadelS3(battle,unit,{contract:WISADEL_S3_CONTRACT})
    :unit.def.skill.id==='skchr_wisdel_2'?prepareWisadelS2(battle,unit,{contract:WISADEL_S2_CONTRACT})
    :prepareWisadelAttacks(battle,unit,{contract:WISADEL_ATTACK_CONTRACT});
  const controller=prepared.controller;
  controller.shadows??=new WisadelShadows(controller,{contract:WISADEL_SHADOW_CONTRACT});
  Object.assign(kit,prepared.kit);kit.install=null;kit.talents=[];kit.trait.install=null;
  unit.mem.wisadelController=controller;
}
export function installWisadel({unit,def}){
  if(def.charId!==WISADEL_ID)return;
  if(!unit.mem.wisadelController)throw Error('Missing selected Wisadel controller');
  unit.mem.wisadelController.install();
}
