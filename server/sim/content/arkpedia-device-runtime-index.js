// SPDX-License-Identifier: GPL-3.0-or-later
import {stageDeviceSpec,STAGE_TOKEN_UNITS} from '../../../shared/arkpedia/device-runtime.js';
const devices=stage=>stage.devices??[];
const has=(stage,flag)=>devices(stage).some(d=>stageDeviceSpec(d)?.[flag]);
const token=(stage,behavior)=>(stage.tokens??[]).some(t=>(t.behavior??STAGE_TOKEN_UNITS[t.unitId]?.behavior)===behavior);
const ordinary=(key,flag,name,load)=>({key,selected:stage=>has(stage,flag),load,exportName:name,
  create:(m,b,stage)=>new m[name](b,devices(stage),stage.geometry)});
export const DEVICE_RUNTIME_INDEX=Object.freeze([
  ordinary('manual','manual','ManualStageDevices',()=>import('./arkpedia-stage-manual-devices.js')),
  ordinary('capturable','capturable','CapturableStageDevices',()=>import('./arkpedia-stage-capturable-devices.js')),
  {...ordinary('coils','electricCoil','ElectricCoils',()=>import('./arkpedia-stage-electric-coils.js')),
    selected:stage=>has(stage,'electricCoil')||token(stage,'electric-coil')},
  ordinary('turrets','turret','StageTurrets',()=>import('./arkpedia-stage-turrets.js')),
  ordinary('flames','flame','StageFlames',()=>import('./arkpedia-stage-flames.js')),
  ordinary('shieldguards','shieldguard','StageShieldguards',()=>import('./arkpedia-stage-shieldguards.js')),
  {...ordinary('bloodAltars','bloodAltar','StageBloodAltars',()=>import('./arkpedia-stage-blood-altars.js')),
    create:(m,b,stage)=>new m.StageBloodAltars(b,devices(stage),stage.geometry,stage)},
  ordinary('magicCircuit','magicCircuit','StageMagicCircuit',()=>import('./arkpedia-stage-magic-circuit.js')),
  ordinary('flow','flowGenerator','StageFlowGenerators',()=>import('./arkpedia-stage-flow-generators.js')),
  ordinary('gramophones','gramophone','StageGramophones',()=>import('./arkpedia-stage-gramophones.js')),
  {key:'demolition',selected:stage=>has(stage,'demolition')||token(stage,'demolition'),
    load:()=>import('./arkpedia-stage-demolition.js'),exportName:'StageDemolition',create:(m,b)=>new m.StageDemolition(b)},
  ordinary('carapaces','carapace','StageCarapaces',()=>import('./arkpedia-stage-carapaces.js')),
  {...ordinary('scenery','scenery','StageScenery',()=>import('./arkpedia-stage-scenery.js')),
    selected:stage=>has(stage,'scenery')||stage.geometry?.tileGrid?.some(row=>row.some(i=>stage.geometry.tileLegend[i]?.key==='tile_wooden_wall'))},
  {key:'powerArmor',selected:stage=>has(stage,'powerArmor'),load:()=>import('./arkpedia-stage-power-armor.js'),exportName:'StagePowerArmor',
    create:(m,b,stage)=>new m.StagePowerArmor(b,devices(stage).filter(d=>stageDeviceSpec(d)?.powerArmor))},
  {key:'twigs',selected:stage=>has(stage,'twigs'),load:()=>import('./arkpedia-stage-twigs.js'),exportName:'StageTwigs',
    create:(m,b,stage)=>new m.StageTwigs(b,devices(stage).filter(d=>stageDeviceSpec(d)?.twigs))},
  {key:'rewards',selected:stage=>has(stage,'reward'),load:()=>import('./arkpedia-stage-reward-devices.js'),exportName:'StageRewardDevices',
    create:(m,b,stage)=>new m.StageRewardDevices(b,devices(stage).filter(d=>stageDeviceSpec(d)?.reward))},
]);
