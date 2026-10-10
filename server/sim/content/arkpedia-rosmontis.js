// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-rosmontis-prefabs.json' with {type:'json'};
import { ROSMONTIS_ID, prepareRosmontisAttacks, ROSMONTIS_ATTACK_CONTRACT } from './arkpedia-rosmontis-attacks.js';
import { prepareRosmontisS2, ROSMONTIS_S2_CONTRACT } from './arkpedia-rosmontis-s2.js';
import { prepareRosmontisS3, ROSMONTIS_S3_CONTRACT } from './arkpedia-rosmontis-s3.js';
export function customizeRosmontisKit({battle,id,unit,kit}){
  if(id!==ROSMONTIS_ID)return;
  if(!evidence.enabledOperators.includes(id)||evidence.heldOperators.includes(id)
    ||evidence.runtimeMapping?.[id]!=='rosmontis')throw Error('Rosmontis lacks a full-kit runtime review');
  const prepared=unit.def.skill.id==='skchr_rosmon_3'
    ?prepareRosmontisS3(battle,unit,{contract:ROSMONTIS_S3_CONTRACT})
    :unit.def.skill.id==='skchr_rosmon_2'?prepareRosmontisS2(battle,unit,{contract:ROSMONTIS_S2_CONTRACT})
    :prepareRosmontisAttacks(battle,unit,{contract:ROSMONTIS_ATTACK_CONTRACT});
  Object.assign(kit,prepared.kit);kit.install=null;kit.talents=[];kit.trait.install=null;
  unit.mem.rosmontisController=prepared.controller;
}
export function installRosmontis({unit,def}){
  if(def.charId!==ROSMONTIS_ID)return;
  if(!unit.mem.rosmontisController)throw Error('Missing selected Rosmontis controller');
  unit.mem.rosmontisController.install();
}
