// SPDX-License-Identifier: GPL-3.0-or-later
// Exact internal stage composition; normal catalogue admission stays separate.
import source from '../../../data/candidates/arkpedia-stage-17-14-source.json' with {type:'json'};
import {jsonSourceDigest} from '../../../shared/arkpedia/source-digest.js';
import {stage17_14MechanicsPlan,assertStage17_14ClosurEnemies} from '../../../shared/arkpedia/stage17-14-mechanics.js';
import {installClosurPredefined,selectedClosurPredefined,CLOSUR_PREDEFINED_CONTRACT} from './arkpedia-closur-predefined.js';
export function stage17_14Preparation(stage,input=source){
 if(jsonSourceDigest(input)!=='967ac6770a5aa5af05318e1ef20f68ac7b73c5d3925a4e30188a1f7f9790ad9e')throw Error('Unreviewed 17-14 stage source');
 const same=(a,b)=>a!==undefined&&jsonSourceDigest(a)===jsonSourceDigest(b);
 if(stage?.code!=='17-14'||stage.testOnly!==true||!same(stage.battle,input.stage.battle)||!same(stage.geometry,input.geometry)||!same(stage.devices,input.devices)
  ||stage.pathing?.moveScale!==input.rawLevel.options.moveMultiplier||!Array.isArray(stage.tokens)||stage.tokens.length||stage.fixedSquad?.length)
  throw Error('Unreviewed 17-14 workspace stage selection');
 const p=selectedClosurPredefined(input,{contract:CLOSUR_PREDEFINED_CONTRACT});
 return Object.freeze({code:'17-14',kind:'selected-with-preset',selectable:true,support:true,excludedOperators:Object.freeze([p.build.id]),
  visible:Object.freeze([Object.freeze({build:Object.freeze({...p.build}),row:p.row,col:p.col,dir:p.dir,skillNumber:input.rawLevel.predefines.characterInsts[0].skillIndex+1})]),hasReinforcements:false});
}
export function prepareStage17_14Mechanics(input,selection){
 if(jsonSourceDigest(source)!=='967ac6770a5aa5af05318e1ef20f68ac7b73c5d3925a4e30188a1f7f9790ad9e')throw Error('Unreviewed 17-14 stage source');
 if(selection?.operators?.some(b=>b.id==='char_4228_closur')||selection?.support?.id==='char_4228_closur')throw Error('17-14 excludes a player or support Closure');
 const plan=stage17_14MechanicsPlan();
 const data={...input,enemies:plan.records,stage:{...structuredClone(source.stage),testOnly:true,geometry:structuredClone(source.geometry),devices:structuredClone(source.devices),tokens:[],pathing:{moveScale:plan.moveScale}}};
 assertStage17_14ClosurEnemies(data);
 return{data,layout:plan.layout,selectableSquad:true,timeLimit:source.rawLevel.options.maxPlayTime===0?Infinity:source.rawLevel.options.maxPlayTime,
  install(b){
   const closur=installClosurPredefined(b,{contract:CLOSUR_PREDEFINED_CONTRACT,candidateStage:'17-14'});
   Object.defineProperty(b,'internalStageMechanics',{value:Object.freeze({code:'17-14',testOnly:true,admitted:false,closur})});
  },
 };
}
